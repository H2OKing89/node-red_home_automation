// Node-RED Function Node: WAN vs DNS A Record Check, build HTTP POST for Pushover (with HTML formatting)
const DOMAIN = env.get('DDNS_HOSTNAME') || "ddns.kingpaging.com";
const DOH_URL = "https://cloudflare-dns.com/dns-query";
const IPIFY_URL = "https://api.ipify.org";
const REQUEST_TIMEOUT = 5000;

const axios = global.get('axios');
const PO_USER = env.get('PO_USER_ADMIN');
const PO_TOKEN = env.get('PO_TOKEN_ADMIN');

// Simple x-www-form-urlencoded builder
const qs = obj => Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

node.log("Validating Pushover credentials...");
if (!PO_USER || !PO_TOKEN) {
    node.error("Missing Pushover credentials (PO_USER_ADMIN or PO_TOKEN_ADMIN)");
    return null;
}
node.log("Pushover credentials found, proceeding with check.");

(async () => {
    let wanIp, dnsIp;
    try {
        node.log(`Requesting WAN IP from ${IPIFY_URL}`);
        const ipResp = await axios.get(IPIFY_URL, { timeout: REQUEST_TIMEOUT });
        wanIp = ipResp.data.trim();
        node.log(`Received WAN IP: ${wanIp}`);
        if (!wanIp) throw new Error("Empty WAN IP response");
    } catch (err) {
        node.error(`Failed to retrieve WAN IP: ${err.message}`);
        return null;
    }

    try {
        node.log(`Requesting DNS A record for ${DOMAIN} via DoH: ${DOH_URL}`);
        const params = { name: DOMAIN, type: "A" };
        const dohResp = await axios.get(DOH_URL, {
            headers: { 'accept': 'application/dns-json' },
            params,
            timeout: REQUEST_TIMEOUT
        });
        node.log(`DoH response data: ${JSON.stringify(dohResp.data)}`);
        const answers = dohResp.data.Answer || [];
        const aRecord = answers.find(a => a.type === 1);
        if (!aRecord) throw new Error(`No A record found for ${DOMAIN}`);
        dnsIp = aRecord.data.trim();
        node.log(`Received DNS IP: ${dnsIp}`);
    } catch (err) {
        node.error(`Failed to retrieve DNS A record: ${err.message}`);
        return null;
    }

    node.log(`Comparing WAN IP and DNS IP: WAN=${wanIp}, DNS=${dnsIp}`);
    if (wanIp !== dnsIp) {
        node.warn(`WAN/DNS mismatch detected: WAN=${wanIp}, DNS=${dnsIp}`);

        // Build a bold, colorized HTML message for Pushover
        const htmlMessage = [
            '<font color="#d32f2f"><b>🚨 DDNS ALERT: WAN & DNS Mismatch</b></font><br><br>',
            '<b>🖥️ Domain:</b> <font color="#1976d2">', DOMAIN, '</font><br>',
            '<b>🌐 WAN IP:</b> <font color="#ff6f00">', wanIp, '</font><br>',
            '<b>📦 DNS A Record:</b> <font color="#43a047">', dnsIp, '</font><br>',
            '<br><i>Please check OPNsense DDNS or Cloudflare settings.</i>'
        ].join('');

        msg.method = "POST";
        msg.url = "https://api.pushover.net/1/messages.json";
        msg.headers = { "Content-Type": "application/x-www-form-urlencoded" };
        msg.payload = qs({
            token: PO_TOKEN,
            user: PO_USER,
            title: "🚨 OPNsense DDNS ALERT 🚨",
            message: htmlMessage,
            html: 1,
            sound: "alien",
            priority: 2,
            retry: 60,
            expire: 3600
        });
        node.log(`Prepared HTTP request for Pushover: ${msg.payload}`);
        node.send(msg);
    } else {
        node.debug(`WAN matches DNS: ${wanIp}`);
        node.log("No mismatch detected, no alert will be sent.");
    }
    node.log("WAN vs DNS check completed with no mismatch");
    return null;
})();
node.log("Function execution ended.");
return null;

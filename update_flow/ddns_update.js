/**
 * Script Name: DDNS WAN vs DNS A Record Monitor
 * Version: 2.1.0
 * Date: 2025-10-16
 * Changelog:
 * - 2.1.0: Added structured logging helper, improved msg preservation,
 *          added error metadata, aligned with practical guide patterns
 * - 2.0.0: Added node.status(), improved error handling with try/finally,
 *          added logging toggle, ensured node.done() always called
 * - 1.0.0: Initial implementation
 */

const DOMAIN = env.get('DDNS_HOSTNAME') || "ddns.kingpaging.com";
const DOH_URL = "https://cloudflare-dns.com/dns-query";
const IPIFY_URL = "https://api.ipify.org";
const REQUEST_TIMEOUT = 5000;
const LOGGING_ENABLED = true;  // Toggle for production

const axios = global.get('axios');
const PO_USER = env.get('PO_USER_ADMIN');
const PO_TOKEN = env.get('PO_TOKEN_ADMIN');

// Simple x-www-form-urlencoded builder
const qs = obj => Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

// Structured logger helper (Practical Guide §9.7)
function createLogger(prefix) {
    return {
        log: (m) => LOGGING_ENABLED && node.log(`[${prefix}] ${m}`),
        warn: (m) => LOGGING_ENABLED && node.warn(`[${prefix}] ${m}`),
        error: (m, err) => LOGGING_ENABLED && node.error(`[${prefix}] ${m}`, err || msg),
        debug: (obj) => LOGGING_ENABLED && node.debug(`[${prefix}] ${JSON.stringify(obj, null, 2)}`)
    };
}

const logger = createLogger('DDNS-Monitor');

// Initial status
node.status({ fill: 'blue', shape: 'dot', text: 'Checking credentials...' });

logger.log("Validating Pushover credentials...");
if (!PO_USER || !PO_TOKEN) {
    node.status({ fill: 'red', shape: 'ring', text: 'Missing credentials' });
    node.error("Missing Pushover credentials (PO_USER_ADMIN or PO_TOKEN_ADMIN)", msg);
    node.done();
    return;
}
logger.log("Pushover credentials found, proceeding with check.");

(async () => {
    let wanIp, dnsIp;
    
    try {
        // Get WAN IP
        node.status({ fill: 'blue', shape: 'dot', text: `Fetching WAN IP...` });
        logger.log(`Requesting WAN IP from ${IPIFY_URL}`);
        
        const ipResp = await axios.get(IPIFY_URL, { timeout: REQUEST_TIMEOUT });
        wanIp = ipResp.data.trim();
        
        logger.log(`Received WAN IP: ${wanIp}`);
        if (!wanIp) throw new Error("Empty WAN IP response");

        // Get DNS A Record
        node.status({ fill: 'blue', shape: 'dot', text: `Querying DNS for ${DOMAIN}...` });
        logger.log(`Requesting DNS A record for ${DOMAIN} via DoH: ${DOH_URL}`);
        
        const params = { name: DOMAIN, type: "A" };
        const dohResp = await axios.get(DOH_URL, {
            headers: { 'accept': 'application/dns-json' },
            params,
            timeout: REQUEST_TIMEOUT
        });
        
        logger.debug({ dohResponse: dohResp.data });
        const answers = dohResp.data.Answer || [];
        const aRecord = answers.find(a => a.type === 1);
        
        if (!aRecord) throw new Error(`No A record found for ${DOMAIN}`);
        
        dnsIp = aRecord.data.trim();
        logger.log(`Received DNS IP: ${dnsIp}`);

        // Compare IPs
        node.status({ fill: 'blue', shape: 'dot', text: 'Comparing IPs...' });
        logger.log(`Comparing WAN IP and DNS IP: WAN=${wanIp}, DNS=${dnsIp}`);
        
        if (wanIp !== dnsIp) {
            node.status({ fill: 'yellow', shape: 'ring', text: `Mismatch: WAN≠DNS` });
            logger.warn(`WAN/DNS mismatch detected: WAN=${wanIp}, DNS=${dnsIp}`);

            // Build a bold, colorized HTML message for Pushover
            const htmlMessage = [
                '<font color="#d32f2f"><b>🚨 DDNS ALERT: WAN & DNS Mismatch</b></font><br><br>',
                '<b>🖥️ Domain:</b> <font color="#1976d2">', DOMAIN, '</font><br>',
                '<b>🌐 WAN IP:</b> <font color="#ff6f00">', wanIp, '</font><br>',
                '<b>📦 DNS A Record:</b> <font color="#43a047">', dnsIp, '</font><br>',
                '<br><i>Please check OPNsense DDNS or Cloudflare settings.</i>'
            ].join('');

            // Preserve original msg properties (Practical Guide §1.1)
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
            
            // Add metadata for tracking (Practical Guide §9.6)
            msg.ddnsMeta = {
                timestamp: Date.now(),
                domain: DOMAIN,
                wanIp: wanIp,
                dnsIp: dnsIp,
                mismatch: true
            };
            
            logger.debug({ pushoverPayload: msg.payload });
            node.send(msg);
        } else {
            node.status({ fill: 'green', shape: 'dot', text: `Match: ${wanIp}` });
            logger.debug({ status: 'match', ip: wanIp });
            logger.log("No mismatch detected, no alert will be sent.");
        }
        
        logger.log("WAN vs DNS check completed");
        
    } catch (err) {
        node.status({ fill: 'red', shape: 'ring', text: `Error: ${err.message}` });
        
        // Add error metadata for Catch node processing (Practical Guide §9.6)
        msg.errorMeta = {
            timestamp: Date.now(),
            domain: DOMAIN,
            wanIp: wanIp || 'unknown',
            dnsIp: dnsIp || 'unknown',
            errorMessage: err.message,
            errorStack: err.stack
        };
        
        logger.error(`DDNS check failed: ${err.message}`, err);
        node.error(`DDNS check failed: ${err.message}`, msg);
    } finally {
        // Always call node.done() - critical for async completion tracking (Practical Guide §2.2)
        node.done();
    }
})();

return;  // Don't return msg synchronously

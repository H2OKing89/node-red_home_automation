// Determine how details are displayed; default to blockquote
const DETAIL_FORMAT = global.get('detailFormat') || 'blockquote';
// Configurable NWS zone and URL
const WEATHER_ZONE = global.get('weatherZone') || 'NEZ066';
const NWS_URL = `https://forecast.weather.gov/MapClick.php?zoneid=${WEATHER_ZONE}`;

// Regex patterns for parsing description lines
const CITY_REGEX = /THIS INCLUDES THE CITIES OF (.*)/i;
const REGION_HDR = /^IN [A-Z ]+ (IA|IOWA|NE|NEBRASKA|KS|KANSAS|MO|MISSOURI)$/;
const MULTI_SPACE = /\s{2,}/g;

// Mapping of events to emoji art sequences
const artMap = {
    'Severe Thunderstorm Warning': ['⛈️⛈️', '🌩️🌩️', '⚡⚡'],
    'Flash Flood Warning': ['🌊🌊', '💧💧']
};
// Array of random quips for human touch
const quips = [
    'Hold onto your hats! 🧢',
    'Time to batten down the hatches! 🏠',
    'Don’t let your picnic plans get washed out! 🧺',
    'Mother Nature’s putting on a show. 🌪️'
];

// Helper: prefix each line with a bullet character
function bullets(arr, bullet = '-') {
    return arr.map(l => `${bullet} ${l}`);
}
// Helper: convert lines to blockquote format
function blockQuotes(arr) {
    return arr.map(l => `> ${l}`);
}
// Helper: inline bullet formatting
function inlineBullet(arr) {
    return [`• ${arr.join(' • ')}`];
}

// Format ISO date string into Chicago-localized human date/time
function formatDateTime(dateStr) {
    const d = new Date(dateStr);
    const df = new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
    const tf = new Intl.DateTimeFormat('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Chicago' });
    return `${df.format(d)}, at ${tf.format(d)}`;
}

// Parse description into formatted lines and extract city names
function parseDescription(txt = '') {
    const raw = txt.split('\n').map(l => l.trim()).filter(Boolean);
    const lines = [];
    const cities = [];
    raw.forEach(line => {
        // If line names cities, split and collect
        const cityMatch = CITY_REGEX.exec(line);
        if (cityMatch) {
            cityMatch[1].split(/[,;]/).map(s => s.trim()).filter(Boolean).forEach(c => cities.push(c));
            return;
        }
        // Bold any region header lines
        if (REGION_HDR.test(line)) {
            lines.push(`**${line}**`);
            return;
        }
        // Collapse multi-space county rows into comma list
        if (MULTI_SPACE.test(line)) {
            lines.push(line.replace(MULTI_SPACE, ', ').trim());
            return;
        }
        // Default passthrough
        lines.push(line);
    });
    return { lines, cities };
}

// Choose decoration based on DETAIL_FORMAT setting
function decorateLines(arr) {
    if (DETAIL_FORMAT === 'inline') return inlineBullet(arr);
    if (DETAIL_FORMAT === 'blockquote') return blockQuotes(arr);
    if (DETAIL_FORMAT === 'bold') return arr.map(l => (REGION_HDR.test(l) ? l : `- ${l}`));
    return bullets(arr);
}

// Format instruction text into italicized bullet points
function formatInstructions(txt = '') {
    const rows = txt.split('\n').map(l => l.trim()).filter(Boolean);
    if (!rows.length) return ['- No instructions provided.'];
    return rows.map(r => `- *${r.replace(/^\*+/, '')}*`);
}

// Identify nearby counties and check for Lancaster inclusion
function formatAreas(txt = '') {
    const neighbors = ['Lancaster', 'Seward', 'Saunders', 'Butler', 'Otoe', 'Gage', 'Saline'];
    const items = txt.replace(/[()]/g, ',').replace(/\band\b/gi, ',').split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    const relevant = items.filter(c => neighbors.some(n => new RegExp(`\\b${n}\\b`, 'i').test(c)));
    const lines = relevant.length ? bullets(relevant) : ['- No nearby counties affected.'];
    const includesLancaster = relevant.some(c => /Lancaster/i.test(c));
    return { lines, includesLancaster };
}

// Convert certainty/status keywords into emoji-coded labels
function emojiCertainty(c = '') {
    const l = c.toLowerCase();
    return l === 'observed' ? '✅ Observed' : l === 'likely' ? '⚠️ Likely' : l === 'possible' ? '⚠️ Possible' : '❓ Unknown';
}
function emojiStatus(s = '') {
    const l = s.toLowerCase();
    return l === 'actual' ? '✅ Actual' : (l === 'test' || l === 'exercise') ? '🧪 Test' : s;
}
// Map priority number to Gotify priority scale
function prioMap(n) {
    return n === 3 ? 10 : n === 2 ? 8 : n === 1 ? 5 : 2;
}

// Build full markdown message for a single alert
function buildMarkdown(alert) {
    // Select random art and quip for this alert
    const artArr = artMap[alert.Event] || ['ℹ️'];
    const art = artArr[Math.floor(Math.random() * artArr.length)];
    const quip = quips[Math.floor(Math.random() * quips.length)];
    // Prepare TL;DR using expiration or sent time
    const expires = alert.Expires || alert.Sent;
    const tldrTime = formatDateTime(expires);
    const tldr = `🚨 **TL;DR:** ${alert.Event} in Lancaster County until ${tldrTime} — stay safe! ${art}`;

    // Meta-information table rows
    const issued = formatDateTime(alert.Sent);
    const expText = alert.Expires ? formatDateTime(alert.Expires) : 'No expiration';
    const meta = [
        '**Meta** | **Value**',
        '---|---',
        `Issued | ${issued}`,
        `Expires | ${expText}`,
        `Severity | ${alert.Severity}`,
        `Certainty | ${emojiCertainty(alert.Certainty)}`,
        `Status | ${emojiStatus(alert.Status)}`
    ].join('\n');

    // Sections: where, details, cities, instructions
    const { lines: whereLines, includesLancaster } = formatAreas(alert.AreasAffected || '');
    const { lines: descLines, cities } = parseDescription(alert.Description || '');
    const details = decorateLines(descLines).join('\n');
    const instructions = formatInstructions(alert.Instruction || '').join('\n');

    // Assemble all parts and filter out empty/null entries
    const parts = [
        tldr,
        '',
        `### ${art} Weather Alert: ${alert.Event} ${art}`,
        '---',
        `> _${quip}_`,
        '',
        meta,
        '',
        '**📍 Where**',
        ...whereLines,
        '',
        '**🔍 What’s Happening**',
        `> ${alert.Event} for Lancaster & nearby counties.`,
        includesLancaster && `> 🚨 **Lancaster County is INCLUDED** – please pay extra attention.`,
        '',
        '**📝 Details**',
        details,
        cities.length && '',
        cities.length && '**🏙️ Cities**',
        cities.length && `- ${cities.join(', ')}`,
        '',
        '**☑️ Instructions**',
        instructions,
        '',
        '---',
        `🔗 **[Full NWS details](${NWS_URL})**`
    ];

    return parts.filter(Boolean).join('\n');
}

// Main loop: process each alert into a Gotify payload
const rawAlerts = msg.data?.event?.new_state?.attributes?.Alerts || [];
const outputs = rawAlerts.map(alert => {
    try {
        const markdown = buildMarkdown(alert);
        const { includesLancaster } = formatAreas(alert.AreasAffected || '');
        const priority = prioMap(includesLancaster ? 2 : 0);
        return {
            payload: {
                title: alert.Event,
                message: markdown,
                priority,
                extras: { 'client::display': { contentType: 'text/markdown' } }
            }
        };
    } catch (err) {
        node.error(`ALERT_BUILD_ERROR: ${err.message}`);
        return null;
    }
}).filter(o => o);

// Return null if no alerts, else output array
return outputs.length ? outputs : null;

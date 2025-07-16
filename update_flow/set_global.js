if (typeof msg.payload === "object" && msg.payload !== null && !Array.isArray(msg.payload)) {
    for (var key in msg.payload) {
        global.set(key, msg.payload[key], 'file');
    }
    node.warn('Set global keys from payload: ' + Object.keys(msg.payload).join(', '));
} else {
    node.warn('payload is not an object! Not updating globals.');
}
return msg;

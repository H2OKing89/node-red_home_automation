# 🧠 Node-RED Function Node — Practical Guide (Quentin Edition)

**Purpose:** A concise, opinionated reference for writing robust Function nodes in Node-RED—covering
lifecycle, messages, async patterns, context, logging/status, timeouts, and *how external modules
actually work*.

**Audience:** Builders who already know Node-RED basics and want production-ready patterns (Home
Assistant-friendly but platform-agnostic).

**Version markers:**

* NR ≥ 1.0 — `node.done()`
* NR ≥ 1.1 — On Start / On Stop code
* NR ≥ 1.3 — `node.outputCount`, Function External Modules UI
* NR ≥ 3.1 — Function timeout (Setup tab)

---

## 0) TL;DR

* **Return a message** (or `null`) for sync work. For async, **use `node.send()`** + **`node.done()`**. ([Node-RED][1])
* Use **context**: `context` (node), `flow`, `global`. Keep it small. Prefer schema’d objects. ([Node-RED][1])
* **Routing:** arrays → multiple outputs & fan-out. `node.outputCount` lets you write generic logic. ([Node-RED][1])
* **External modules:** prefer **Function External Modules** (NR ≥ 1.3). For global/shared modules, use
  **`functionGlobalContext`** in `settings.js`. ([Node-RED][1])
* **Status & logs:** `node.status()` + `node.log|warn|error|debug|trace()`; use **Catch** node via `node.error(err, msg)`.
* **Complete** nodes can watch when your Function finishes via `node.done()`.
* **Timeouts:** set on Setup tab (NR ≥ 3.1). ([Node-RED][1])
* **Promote** big Functions (≥150 LOC or heavy I/O) to Subflows/Services.

---

## 1) Messages & Return Semantics

### 1.1 Shape

* Every input is a **plain object** `msg`. By convention it carries `msg.payload`.
* Other nodes add properties (e.g., HTTP In adds `msg.req`, `msg.res`). **If you construct a brand-new
  object, you’ll lose these.** Prefer mutating the incoming `msg` unless you *intentionally* replace it. ([Node-RED][1])

**HTTP In/Response preservation (safe patterns):**

```js
// Keep req/res by mutating msg
msg.payload = transform(msg.payload);
return msg;

// or, if constructing fresh, copy req/res forward explicitly:
return { ...msg, payload: transform(msg.payload) };
```

([Node-RED][1])

### 1.2 Returning

```js
// simplest
return msg;            // pass through
return null;           // stop this path

// replace payload but keep other props
msg.payload = transform(msg.payload);
return msg;

// build a new message (be careful to preserve critical props if needed)
const out = { payload: msg.payload.length, _msgid: msg._msgid };
return out;
```

> **Rule of thumb:** In flows that involve HTTP In/Response or MQTT request/reply patterns, **preserve**
> the original `msg` (esp. `msg.req`, `msg.res`, correlation IDs).

### 1.3 Multiple Outputs

```js
if (msg.topic === "banana") {
  return [null, msg];  // to output 2
}
return [msg, null];    // to output 1
```

([Node-RED][1])

**Generic routing (NR ≥ 1.3):**

```js
const messages = new Array(node.outputCount);
messages[Math.floor(Math.random()*node.outputCount)] = msg;
return messages;
```

([Node-RED][1])

### 1.4 Multiple Messages per Output (fan-out)

```js
const m1 = { payload: "first" };
const m2 = { payload: "second" };
return [[m1, m2]]; // both go to output 1 in order
```

([Node-RED][1])

---

## 2) Async Work (The Right Way)

> **Critical Rule:** If your Function uses **`node.send()`** (async pattern), you **MUST** call
> **`node.done()`** when finished. This tells Node-RED the message is complete and enables proper
> flow tracking. Synchronous functions that `return msg` do NOT need `node.done()`.

### 2.1 Callback style

```js
doSomethingAsync(msg, (err, result) => {
  if (err) { node.error(err, msg); return node.done(); }
  msg.payload = result;
  node.send(msg);
  node.done();
});
return;  // do not return a message synchronously
```

*Node-RED clones each message passed to `node.send()`; you can skip cloning the **first**
message by calling `node.send(msg, false)` (use sparingly).*

> **Completion events:** `node.done()` marks the message as finished and triggers any **Complete** nodes
> targeting this Function. Errors passed to `node.done(err)` or raised with `node.error(err, msg)` will
> trigger **Catch** nodes.
>
> **Why it matters:** Without `node.done()`, the Node-RED runtime cannot track when async work completes.
> This breaks flow completion tracking, prevents **Complete** nodes from firing, and can cause issues
> with flow lifecycle management (especially during redeployment).

### 2.2 Async/Await pattern (RECOMMENDED)

```js
(async () => {
  try {
    const data = await fetchThing(msg.payload.id);  // your own promise
    msg.payload = data;
    node.send(msg);
  } catch (e) {
    node.error(e, msg);
  } finally {
    node.done();  // ✅ ALWAYS in finally block - guarantees execution
  }
})();
return;
```

### Comparison: Sync vs Async

```js
// ✅ SYNC - return msg, NO node.done() needed
msg.payload = msg.payload.toUpperCase();
return msg;

// ✅ ASYNC - use node.send() + node.done()
(async () => {
  try {
    msg.payload = await fetchData();
    node.send(msg);
  } finally {
    node.done();  // REQUIRED!
  }
})();
return;

// ❌ WRONG - async work but forgot node.done()
setTimeout(() => {
  node.send(msg);  // sent but Node-RED thinks it's still processing!
}, 1000);
return;
```

([Node-RED][2])

### 2.3 Timers & cleanup

```js
const id = setTimeout(() => node.send({payload: "tick"}), 5000);
context.set("timerId", id);

node.on('close', () => {
  const t = context.get("timerId");
  if (t) clearTimeout(t);
});
```

> **Note:** `setTimeout` and `setInterval` timers are **automatically cleared** when the flow is
> redeployed or the node is stopped. However, you should still clean them up explicitly in
> `node.on('close')` for proper async work tracking and to avoid race conditions during shutdown.

([Node-RED][1])

---

## 3) Context & State

**Scopes:**

* `context` — node-local, reset when node redeploys
* `flow` — shared across nodes in the same tab/flow
* `global` — shared across the runtime

**Synchronous access:**

```js
const n = (context.get('count')||0) + 1;
context.set('count', n);
msg.count = n;
return msg;
```

**Batch get/set (NR ≥ 0.19):**

```js
const [a, b, c] = flow.get(["count", "colour", "temperature"]);
flow.set(["count", "colour"], [123, "red"]);
```

**Asynchronous stores (some backends only):**

```js
flow.get("count", (err, v) => {
  if (err) return node.error(err, msg);
  flow.set("count", (v||0)+1, err2 => {
    if (err2) node.error(err2, msg); else node.send(msg);
  });
});
return;
```

**Multiple stores (file vs memory):**

```js
const val = flow.get("count", "file");
flow.set("count", 123, "file");
```

**Listing all keys:**

```js
const allKeys = flow.keys();  // returns array of all keys in flow context
node.log(`Flow has ${allKeys.length} keys: ${allKeys.join(', ')}`);
```

> **Guidance:** Keep context **small and structured**. Use a stable schema and prune regularly (e.g., keep
> last N items). Persist only what you *need*. ([Node-RED][1])

---

## 4) Lifecycle: On Start / On Stop (NR ≥ 1.1)

**On Start** — initialize state, pre-warm caches, validate config.

```js
// On Start tab
if (context.get("init") !== true) {
  context.set("messageCounter", 0);
  context.set("init", true);
}
// You can return a Promise here; incoming msgs queue until resolved.
```

**Main Function** — normal message handling (may read what you set above).

**On Stop** — cleanup timers, sockets, and flush metrics.

```js
// On Stop tab
const timers = context.get("timers") || [];
timers.forEach(clearTimeout);
context.set("timers", []);
```

**Timeout (NR ≥ 3.1):** Set a per-node max execution time on the Setup tab. The runtime will error if exceeded. ([Node-RED][1])

---

## 5) Logging, Status, and Errors

**Logs:**

```js
node.log("info");
node.warn("heads-up");
node.error("boom");
node.debug("dev details");
node.trace("very verbose");
```

**Status badge:**

```js
node.status({ fill: "green", shape: "dot", text: "connected" });
node.status({}); // clear
```

*(Status updates can also be consumed by the **Status** node for reactive flows.)* ([Node-RED][4])

**Catchable errors:**

```js
try {
  risky();
} catch (e) {
  node.error(e, msg); // triggers Catch node on same tab
  return null;
}
```

([Node-RED][1])

> **Tip:** Wrap a tiny logger helper with consistent prefixes and optional JSON pretty-printing for debug builds.

---

## 6) Using External Modules (the complete picture)

You have **two** supported paths to make extra Node.js modules available inside Function nodes:

### 6.1 `functionGlobalContext` (global modules via settings.js)

* **Where:** `~/.node-red/settings.js` (or your mounted settings path)
* **What:** Pre-loads objects into **global context** for all Function nodes.
* **How:**

```js
// settings.js
functionGlobalContext: {
  osModule: require('os'),
  // moment: require('moment'),       // example
  // myUtil: require('./lib/my-util') // local file
}
```

Then in a Function node:

```js
const os = global.get('osModule');
msg.platform = os.platform();
return msg;
```

(Forum example: `const moment = global.get('moment')`.) ([Node-RED Forum][5])

* **Pros:** Centralized, explicit, works even if Function External Modules UI is disabled.
* **Cons:** Requires server access/edit; everything is shared (versioning/updates affect all functions).

> **Docker note:** Install modules in the same directory as `settings.js` (commonly `/data` or
> `/usr/src/node-red`). Persist that volume so modules survive restarts. ([Node-RED][6])

### 6.2 Function External Modules UI (NR ≥ 1.3)

**Enable first:** In `~/.node-red/settings.js`, set `functionExternalModules: true`, then **restart** Node-RED. ([Node-RED][6])

* **Use:** In the Function node editor, add external modules under the **Modules** section. You supply
  the **module name** (e.g., `dayjs`) and the **variable name** you’ll use in code (e.g., `dayjs`).
* **What happens:** On deploy, Node-RED **auto-installs** the modules under `~/.node-red/node_modules/`
  and wires them into the Function’s sandbox with the variable names you chose. ([Node-RED][1])

**Code:**

```js
// after adding { module: "dayjs", var: "dayjs" } in the editor
msg.now = dayjs().toISOString();
return msg;
```

* **Pros:** Per-function declaration, self-documenting, no server edits.
* **Cons:** Still installs to the runtime’s `node_modules`; version drift possible if you use ranges—**pin versions**.

#### 6.2.1 Version pinning & reproducibility

* Prefer **exact versions** in the editor, e.g., `dayjs@1.11.13`. (FlowFuse notes the
auto-install behavior mirrors core.) ([FlowFuse][7])
* For air-gapped/CI builds, pre-install into the userDir and keep
`functionExternalModules` enabled for resolution. ([Node-RED][6])

#### 6.2.2 ESM vs CommonJS

Function nodes run in a CommonJS sandbox. Many libs ship CJS builds; for ESM-only libs
you can often use **dynamic `import()`**, but success depends on the runtime Node version
and the package's build. Test locally before committing. ([Node-RED][6])

#### 6.2.3 Security & governance

Only enable `functionExternalModules` if you trust flow authors; consider pre-baking
allowed libs and using read-only images where appropriate. ([Node-RED][6])

### 6.3 Choosing a path

* **Single source of truth for shared utilities?** `functionGlobalContext`.
* **Per-Function portability & clarity?** External Modules UI.
* **Strict reproducibility?** Pre-install + pin versions. ([Node-RED][6])

---

## 7) Timeouts (NR ≥ 3.1)

Set a per-Function **timeout** (seconds) in the Setup tab. If exceeded, Node-RED raises
an error—handy for catching infinite loops/hung I/O. Pair with a defensive wrapper:

```js
const withTimeout = (p, ms) => Promise.race([
  p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
]);
```

([Node-RED][1])

---

## 8) Performance & Reliability Checklist

### Do

* Cap arrays in context (e.g., keep last N items only).
* Debounce/throttle noisy sensors before heavy work.
* Keep `msg` light; send references/URLs for large blobs.
* Use consistent `node.status` colors/text for quick triage.
* Add one **Complete**, **Catch**, and **Status** “observability” trio per tab wired to your logger. ([FlowFuse][8])

### Don't

* Blast 50MB Buffers across six outputs and expect it to be free—cloning costs CPU/RAM. ([Node-RED][3])
* Replace `msg` in HTTP flows without copying `req`/`res`. ([Node-RED][1])

> **Promotion rule:** if a Function surpasses ~150 LOC, pulls multiple modules, or does
> heavy I/O → **Subflow** or **external service**.

---

## 9) Patterns & Snippets (grab-and-go)

### 9.1 Conditional Router (2 outputs)

```js
// out1: normal, out2: priority
return [ msg.priority ? null : msg, msg.priority ? msg : null ];
```

### 9.2 Fan-out (N outputs, NR ≥ 1.3)

```js
const outs = new Array(node.outputCount).fill(null);
const clones = myArray.map(x => ({ payload: x }));
outs[0] = clones;            // many → output 1
return outs;
```

([Node-RED][1])

### 9.3 Async fetch + status

```js
node.status({ fill: 'yellow', shape: 'dot', text: 'fetching…' });
(async () => {
  try {
    const data = await doFetch(msg.url);
    msg.payload = data;
    node.status({ fill: 'green', shape: 'dot', text: 'ok' });
    node.send(msg);
  } catch (e) {
    node.status({ fill: 'red', shape: 'dot', text: e.message });
    node.error(e, msg);
  } finally { node.done(); }
})();
return;
```

([Node-RED][4])

### 9.4 Context counter with rotation

```js
const key = 'events';
const max = 100;
let list = context.get(key) || [];
list.push({ t: Date.now(), topic: msg.topic });
if (list.length > max) list = list.slice(-max);
context.set(key, list);
return msg;
```

### 9.5 Timer auto-off (store & clear)

```js
const room = msg.room || 'living_room';
const delay = 5 * 60 * 1000; // 5m
const existing = context.get(room);
if (existing) clearTimeout(existing);
const id = setTimeout(() => node.send({ payload: { off: room } }), delay);
context.set(room, id);
return null;
```

### 9.6 Error → Catch with context snapshot

```js
try {
  risky(msg.payload);
  return msg;
} catch (e) {
  msg.errorMeta = { ts: Date.now(), payloadType: typeof msg.payload };
  node.error(e, msg);
  return null;
}
```

### 9.7 Professional Logger Helper

```js
function createLogger(prefix) {
  return {
    log: (msg) => node.log(`[${prefix}] ${msg}`),
    warn: (msg) => node.warn(`[${prefix}] ${msg}`),
    error: (msg, err) => node.error(`[${prefix}] ${msg}`, err),
    debug: (obj) => node.debug(`[${prefix}] ${JSON.stringify(obj, null, 2)}`)
  };
}

const logger = createLogger('MyFunction');
logger.log('Processing started');
logger.debug({ payload: msg.payload, topic: msg.topic });
logger.error('Operation failed', new Error('boom'));
```

> **Tip:** Use consistent prefixes to filter logs across multiple Function nodes in production.

### 9.8 Deep Cloning Messages (Multiple Independent Outputs)

```js
// When you need to send multiple different versions of a message
const original = msg;
const clone1 = RED.util.cloneMessage(msg);
const clone2 = RED.util.cloneMessage(msg);

clone1.payload.route = 'A';
clone2.payload.route = 'B';
original.payload.route = 'C';

return [[clone1, clone2, original]];  // All get independent copies
```

> **Use case:** Fan-out processing where each path needs to mutate the message differently without
> affecting others. Without cloning, all would share the same payload object reference.

---

## 10) API Quick Reference

**`node`**
`id`, `name`, `outputCount` •
`log|warn|error|debug|trace(fn)` •
`status(obj)` •
`on(event, fn)` •
`send(msg | [msgs], cloneFirst? )` •
`done()`

**`context / flow / global`**
`get(key | [keys], [store], [cb])` •
`set(key,val, [store], [cb])` •
`keys()`

**`RED`**
`RED.util.cloneMessage(obj)`

**`env`**
`env.get('NAME')`

**Built-ins**
`Buffer`, `console`, `util`, `setTimeout/clearTimeout`, `setInterval/clearInterval` (cleared automatically on redeploy)

---

## 11) Home-Automation-Friendly Conventions (Optional but Recommended)

* **Message schema:** document required fields for each Function (`msg.topic`, `msg.payload.{…}`, context keys touched).
* **Status discipline:** consistent colors/text so you can triage a flow at a glance.
* **Env vars:** `env.get("HA_BASE_URL")`, tokens, topic prefixes—never hardcode secrets.
* **Observability:** single **Catch** + **Status** + **Complete** per tab, wired to a central logger/notification. ([Node-RED][4])

---

## 12) Decision Guide — Where should this logic live?

* **Function node:** light glue, ≤150 LOC, no heavy deps, fast path.
* **Subflow:** reusable, parameterized logic used 2+ places, still light deps.
* **Custom node:** you need a proper Node-RED UI, config panels, and packaging.
* **External service (Python/Node app):** heavy I/O, complex modules, needs tests, or long-running compute.

---

## 13) Appendix — External Modules Cookbook

### 13.1 Enable External Modules UI

1. Open `~/.node-red/settings.js`
2. Set: `functionExternalModules: true`
3. **Restart** Node-RED
4. In a Function node → **Modules** section → add `module` and `var` names
5. Deploy (Node-RED installs modules if needed) ([Node-RED][6])

### 13.2 Pin versions

* In the module field, include a version: `dayjs@1.11.13`. ([FlowFuse][7])

### 13.3 Docker persistence

* Install to the Node-RED **userDir** (commonly `/data`) and **persist** it so
`node_modules` and `settings.js` survive restarts. ([Node-RED][6])

### 13.4 Fallback: functionGlobalContext

* Put shared utilities in `functionGlobalContext` and call via `global.get('name')` to avoid per-Function declarations. ([Node-RED][1])

---

### End

Short, sharp, and production-minded. Extend this with your own **templates** (copy-pasteable
Functions) and a **schema doc** listing your `flow`/`global` keys.

---

**Key sources:** Node-RED “Writing Functions” user guide (multiple sections), runtime configuration docs,
*Knowing when a node is done* blog, *Cloning messages in a flow* blog, and docs/pages for Status/Complete nodes. ([Node-RED][1])

[1]: https://nodered.org/docs/user-guide/writing-functions?utm_source=chatgpt.com "Writing Functions"
[2]: https://nodered.org/blog/2019/09/20/node-done?utm_source=chatgpt.com "Knowing when a node is done"
[3]: https://nodered.org/blog/2019/09/13/cloning-messages?utm_source=chatgpt.com "Cloning messages in a flow"
[4]: https://nodered.org/docs/creating-nodes/status?utm_source=chatgpt.com "Node status"
[5]: https://discourse.nodered.org/t/using-an-external-js-library-in-function-node-im-sure-its-easy/32481/1?utm_source=chatgpt.com "Using an external JS library in function node, I'm sure it's ..."
[6]: https://nodered.org/docs/user-guide/runtime/configuration?utm_source=chatgpt.com "Configuration"
[7]: https://flowfuse.com/node-red/core-nodes/status/?utm_source=chatgpt.com "Status - Node-RED"
[8]: https://flowfuse.com/node-red/core-nodes/complete/?utm_source=chatgpt.com "Node-RED - Complete Node"

# 🧠 Node‑RED Function Node — Practical Guide (Quentin Edition)

**Purpose:** A concise, opinionated reference for writing robust Function nodes in Node‑RED—covering
lifecycle, messages, async patterns, context, logging/status, timeouts, and *how external modules
actually work*.

**Audience:** Builders who already know Node‑RED basics and want production‑ready patterns (Home
Assistant‑friendly but platform‑agnostic).

**Version markers:**

* NR ≥ 1.0 — `node.done()`
* NR ≥ 1.1 — On Start / On Stop code
* NR ≥ 1.3 — `node.outputCount`, Function External Modules UI
* NR ≥ 3.1 — Function timeout (Setup tab)

---

## 0) TL;DR

* **Return a message** (or `null`) for sync work. For async, **use `node.send()`** + **`node.done()`**.
* Use **context**: `context` (node), `flow`, `global`. Keep it small. Prefer schema’d objects.
* **Routing:** arrays → multiple outputs & fan‑out. `node.outputCount` lets you write generic logic.
* **External modules:** prefer **Function External Modules** (NR ≥ 1.3). For global/shared modules, use
  **`functionGlobalContext`** in `settings.js`.
* **Status & logs:** `node.status()` + `node.log|warn|error|debug|trace()`; use **Catch** node via `node.error(err, msg)`.
* **Timeouts:** set on Setup tab (NR ≥ 3.1).
* **Promote** big Functions (≥150 LOC or heavy I/O) to Subflows/Services.

---

## 1) Messages & Return Semantics

### 1.1 Shape

* Every input is a **plain object** `msg`. By convention it carries `msg.payload`.
* Other nodes add properties (e.g., HTTP In adds `msg.req`, `msg.res`). **If you construct a brand‑new
  object, you’ll lose these.** Prefer mutating the incoming `msg` unless you *intentionally* replace it.

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
  the original `msg` (esp. `msg.req`, `msg.res`, correlation IDs).

### 1.3 Multiple Outputs

```js
if (msg.topic === "banana") {
  return [null, msg];  // to output 2
}
return [msg, null];    // to output 1
```

**Generic routing (NR ≥ 1.3):**

```js
const messages = new Array(node.outputCount);
messages[Math.floor(Math.random()*node.outputCount)] = msg;
return messages;
```

### 1.4 Multiple Messages per Output (fan‑out)

```js
const m1 = { payload: "first" };
const m2 = { payload: "second" };
return [[m1, m2]]; // both go to output 1 in order
```

---

## 2) Async Work (The Right Way)

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

> **Cloning:** Node‑RED clones every message passed to `node.send()` to avoid accidental mutation. You may
  **skip cloning the first** argument with `node.send(msg, false)` if you *must* (e.g., containing
  non‑cloneable data), but do it sparingly.

### 2.2 Async/Await pattern

```js
(async () => {
  try {
    const data = await fetchThing(msg.payload.id);  // your own promise
    msg.payload = data;
    node.send(msg);
  } catch (e) {
    node.error(e, msg);
  } finally {
    node.done();
  }
})();
return;
```

### 2.3 Timers & cleanup

```js
const id = setTimeout(() => node.send({payload: "tick"}), 5000);
context.set("timerId", id);

node.on('close', () => {
  const t = context.get("timerId");
  if (t) clearTimeout(t);
});
```

---

## 3) Context & State

**Scopes:**

* `context` — node‑local, reset when node redeploys
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

**Multiple stores:**

```js
const val = flow.get("count", "file");
flow.set("count", 123, "file");
```

> **Guidance:** Keep context **small and structured**. Use a stable schema and prune regularly (e.g., keep
  last N items). Persist only what you *need*.

---

## 4) Lifecycle: On Start / On Stop (NR ≥ 1.1)

**On Start** — initialize state, pre‑warm caches, validate config.

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

**Timeout (NR ≥ 3.1):** Set a per‑node max execution time on the Setup tab. The runtime will error if exceeded.

---

## 5) Logging, Status, and Errors

**Logs:**

```js
node.log("info");
node.warn("heads‑up");
node.error("boom");
node.debug("dev details");
node.trace("very verbose");
```

**Status badge:**

```js
node.status({ fill: "green", shape: "dot", text: "connected" });
node.status({}); // clear
```

**Catchable errors:**

```js
try {
  risky();
} catch (e) {
  node.error(e, msg); // triggers Catch node on same tab
  return null;
}
```

> **Tip:** Wrap a tiny logger helper with consistent prefixes and optional JSON pretty‑printing for debug builds.

---

## 6) Using External Modules (the complete picture)

You have **two** supported paths to make extra Node.js modules available inside Function nodes:

### 6.1 `functionGlobalContext` (global modules via settings.js)

* **Where:** `~/.node-red/settings.js` (or your mounted settings path)
* **What:** Pre‑loads objects into **global context** for all Function nodes.
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

* **Pros:** Centralized, explicit, works even if Function External Modules UI is disabled.
* **Cons:** Requires server access/edit; everything is shared (versioning/updates affect all functions).

> **Docker note:** Install modules in the same directory as `settings.js` (commonly `/data` or
  `/usr/src/node-red`). Persist that volume so modules survive restarts.

### 6.2 Function External Modules UI (NR ≥ 1.3)

* **Enable:** In `settings.js`, set `functionExternalModules: true`.
* **Use:** In the Function node editor, add external modules under the **Modules** section. You supply
  the **module name** (e.g., `dayjs`) and the **variable name** you’ll use in code (e.g., `dayjs`).
* **What happens:** On deploy, Node‑RED **auto‑installs** the modules under `~/.node-red/node_modules/`
  and wires them into the Function’s sandbox with the variable names you chose.
* **Code:**

```js
// after adding { module: "dayjs", var: "dayjs" } in the editor
msg.now = dayjs().toISOString();
return msg;
```

* **Pros:** Per‑function declaration, self‑documenting, no server edits.
* **Cons:** Still installed to the runtime’s node_modules; version drift possible across functions if you
  specify ranges (prefer exact versions when reproducibility matters).

#### 6.2.1 Version pinning & reproducibility

* Prefer **exact versions** (e.g., `dayjs@1.11.13`) when adding in the editor to avoid surprises.
* For air‑gapped or CI‑built images, **pre‑install** your modules into the container’s `~/.node-red`
  and keep `functionExternalModules` enabled for resolution without network.

#### 6.2.2 ESM vs CommonJS

* Function nodes use CommonJS under the hood. Most popular libs still support `require` or provide CJS builds.
* If a package is **ESM‑only**, you can often use **dynamic import**:

```js
(async () => {
  const { default: got } = await import('got');
  const res = await got('https://example.com').json();
  msg.payload = res;
  node.send(msg);
  node.done();
})();
return;
```

> Compatibility depends on the runtime Node.js version shipped with your Node‑RED. Test before committing.

#### 6.2.3 Security & governance

* Only enable `functionExternalModules` if you trust the flow authors.
* Consider restricting Module installs at the container level (read‑only rootfs) and pre‑baking allowed libs.

### 6.3 Choosing a path

* **Single source of truth for shared utilities?** Use `functionGlobalContext`.
* **Per‑Function portability & clarity?** Use the **External Modules UI**.
* **Need strict reproducibility?** Pre‑install in your image/volume + pin versions.

---

## 7) Timeouts (NR ≥ 3.1)

Set a per‑Function **timeout** (seconds) in the Setup tab. If exceeded, Node‑RED raises an error. Use
it to catch infinite loops, hung I/O, or runaway CPU.

**Pattern:** combine with `Promise.race` for defensive async:

```js
const withTimeout = (p, ms) => Promise.race([
  p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
]);
```

---

## 8) Performance & Reliability Checklist

* **Avoid huge objects** on `msg` (e.g., big buffers). Use references/URLs when possible.
* **Minimize cloning cost.** Don’t spray massive nested objects across many outputs.
* **De‑bounce / throttle** noisy sensors before heavy work.
* **Context hygiene:** cap history arrays, prune on On Stop, consider a file store for persistence.
* **Status signals:** green/dot for success, yellow/dot for in‑progress, red/dot for failures—keep it consistent.
* **Testing:** small Inject payloads, known edge cases, Debug node on **complete msg** once per branch.
* **Promotion rule:** if a Function surpasses ~150 LOC, pulls multiple modules, or makes network calls →
  **Subflow** or **external service (e.g., Python/FastAPI)**.

---

## 9) Patterns & Snippets (grab‑and‑go)

### 9.1 Conditional Router (2 outputs)

```js
// out1: normal, out2: priority
return [ msg.priority ? null : msg, msg.priority ? msg : null ];
```

### 9.2 Fan‑out (N outputs, NR ≥ 1.3)

```js
const outs = new Array(node.outputCount).fill(null);
const clones = myArray.map(x => ({ payload: x }));
outs[0] = clones;            // many → output 1
return outs;
```

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

### 9.5 Timer auto‑off (store & clear)

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

---

## 10) API Quick Reference

**`node`**
`id`, `name`, `outputCount`
`log|warn|error|debug|trace(fn)`
`status(obj)`
`on(event, fn)`
`send(msg | [msgs], cloneFirst? )`
`done()`

**`context / flow / global`**
`get(key | [keys], [store], [cb])`
`set(key,val, [store], [cb])`
`keys()`

**`RED`**
`RED.util.cloneMessage(obj)`

**`env`**
`env.get('NAME')`

**Built‑ins**
`Buffer`, `console`, `util`, `setTimeout/clearTimeout`, `setInterval/clearInterval` (cleared automatically on redeploy)

---

## 11) Home‑Automation‑Friendly Conventions (Optional but Recommended)

* **Message schema:** document required fields for each Function (`msg.topic`, `msg.payload.{…}`, context keys touched).
* **Status discipline:** consistent colors/text so you can triage a flow at a glance.
* **Env vars:** `env.get("HA_BASE_URL")`, tokens, topic prefixes—never hardcode secrets.
* **Observability:** single `Catch` + `Status` + `Complete` per tab, wire to a central logger/notification.

---

## 12) Decision Guide — Where should this logic live?

* **Function node:** light glue, ≤150 LOC, no heavy deps, fast path.
* **Subflow:** reusable, parameterized logic used 2+ places, still light deps.
* **Custom node:** you need a proper Node‑RED UI, config panels, and packaging.
* **External service (Python/Node app):** heavy I/O, complex modules, needs tests, or long‑running compute.

---

## 13) Appendix — External Modules Cookbook

### 13.1 Enable External Modules UI

1. Open `~/.node-red/settings.js`
2. Set: `functionExternalModules: true`
3. Restart Node‑RED.
4. In a Function node → **Modules** section → add `module` and `var` names.
5. Deploy (Node‑RED installs modules if needed).

### 13.2 Pin versions

* In the module field, include a version: `dayjs@1.11.13`.

### 13.3 Docker persistence

* Mount your userDir (e.g., `/data`) so `node_modules` and `settings.js` persist. Example:

```
docker run -it --name nodered -p 1880:1880 \
  -v node_red_data:/data nodered/node-red:latest
```

### 13.4 Fallback: functionGlobalContext

* Put shared utilities in `functionGlobalContext` and call via `global.get('name')` to avoid per‑Function declarations.

---

### End

Short, sharp, and production‑minded. Extend this with your own **templates** (copy‑pasteable
Functions) and a **schema doc** listing your `flow`/`global` keys.

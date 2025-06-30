# Writing Functions in Node-RED Function Nodes

The Function node allows JavaScript code to be run against the messages that are passed through it.

The message is passed in as an object called `msg`. By convention it will have a `msg.payload` property containing the body of the message.

Other nodes may attach their own properties to the message, and they should be described in their documentation.

## Writing a Function

The code entered into the Function node represents the body of the function. The most simple function simply returns the message exactly as-is:

```javascript
return msg;
```

If the function returns `null`, then no message is passed on and the flow ends.

The function must always return a `msg` object. Returning a number or string will result in an error.

The returned message object does not need to be same object as was passed in; the function can construct a completely new object before returning it. For example:

```javascript
var newMsg = { payload: msg.payload.length };
return newMsg;
```

> **Note:** Constructing a new message object will lose any message properties of the received message. This will break some flows, for example the HTTP In/Response flow requires the `msg.req` and `msg.res` properties to be preserved end-to-end. In general, function nodes should return the message object they were passed having made any changes to its properties.

Use `node.warn()` to show warnings in the sidebar to help you debug. For example:

```javascript
node.warn("my var xyz = " + xyz);
```

See logging section below for more details.

## Multiple Outputs

The function edit dialog allows the number of outputs to be changed. If there is more than one output, an array of messages can be returned by the function to send to the outputs.

This makes it easy to write a function that sends the message to different outputs depending on some condition. For example, this function would send anything on topic `banana` to the second output rather than the first:

```javascript
if (msg.topic === "banana") {
   return [ null, msg ];
} else {
   return [ msg, null ];
}
```

The following example passes the original message as-is on the first output and a message containing the payload length is passed to the second output:

```javascript
var newMsg = { payload: msg.payload.length };
return [msg, newMsg];
```

### Handling arbitrary number of outputs

Since Node-RED 1.3

`node.outputCount` contains the number of outputs configured for the function node.

This makes it possible to write generic functions that can handle variable number of outputs set from the edit dialog.

For example if you wish to spread incoming messages randomly between outputs, you could:

```javascript
// Create an array same length as there are outputs
const messages = new Array(node.outputCount)
// Choose random output number to send the message to
const chosenOutputIndex = Math.floor(Math.random() * node.outputCount);
// Send the message only to chosen output
messages[chosenOutputIndex] = msg;
// Return the array containing chosen output
return messages;
```

You can now configure number of outputs solely via edit dialog without making changes to the function itself.

## Multiple Messages

A function can return multiple messages on an output by returning an array of messages within the returned array. When multiple messages are returned for an output, subsequent nodes will receive the messages one at a time in the order they were returned.

In the following example, `msg1`, `msg2`, `msg3` will be sent to the first output. `msg4` will be sent to the second output.

```javascript
var msg1 = { payload:"first out of output 1" };
var msg2 = { payload:"second out of output 1" };
var msg3 = { payload:"third out of output 1" };
var msg4 = { payload:"only message from output 2" };
return [ [ msg1, msg2, msg3 ], msg4 ];
```

The following example splits the received payload into individual words and returns a message for each of the words.

```javascript
var outputMsgs = [];
var words = msg.payload.split(" ");
for (var w in words) {
    outputMsgs.push({payload:words[w]});
}
return [ outputMsgs ];
```

## Sending messages asynchronously

If the function needs to perform an asynchronous action before sending a message it cannot return the message at the end of the function.

Instead, it must make use of the `node.send()` function, passing in the message(s) to be sent. It takes the same arrangement of messages as that can be returned, as described in the previous sections.

For example:

```javascript
doSomeAsyncWork(msg, function(result) {
    msg.payload = result;
    node.send(msg);
});
return;
```

The Function node will clone every message object you pass to `node.send` to ensure there is no unintended modification of message objects that get reused in the function. Before Node-RED 1.0, the Function node would not clone the first message passed to `node.send`, but would clone the rest.

The Function can request the runtime to not clone the first message passed to `node.send` by passing in `false` as a second argument to the function. It would do this if the message contains something that is not otherwise cloneable, or for performance reasons to minimise the overhead of sending messages:

```javascript
node.send(msg,false);
```

### Finishing with a message

Since Node-RED 1.0

If a Function node does asynchronous work with a message, the runtime will not automatically know when it has finished handling the message.

To help it do so, the Function node should call `node.done()` at the appropriate time. This will allow the runtime to properly track messages through the system.

```javascript
doSomeAsyncWork(msg, function(result) {
    msg.payload = result;
    node.send(msg);
    node.done();
});
return;
```

## Running code on start

Since Node-RED 1.1.0

With the 1.1.0 release, the Function node provides an On Start tab (labeled Setup before 1.3.0) where you can provide code that will run whenever the node is started. This can be used to setup any state the Function node requires.

For example, it can initialise values in local context that the main Function will use:

```javascript
if (context.get("counter") === undefined) {
    context.set("counter", 0)
}
```

The On Start function can return a Promise if it needs to complete asynchronous work before the main Function can start processing messages. Any messages that arrive before the On Start function has completed will be queued up, and handled when it is ready.

### Tidying up

If you do use asynchronous callback code in your functions then you may need to tidy up any outstanding requests, or close any connections, whenever the flow gets re-deployed. You can do this in two different ways.

Either by adding a close event handler:

```javascript
node.on('close', function() {
    // tidy up any async code here - shutdown connections and so on.
});
```

Or, since Node-RED 1.1.0, you can add code to the On Stop tab (previously labelled Close) in the node’s edit dialog.

## Logging events

If a node needs to log something to the console, it can use one of the follow functions:

```javascript
node.log("Something happened");
node.warn("Something happened you should know about");
node.error("Oh no, something bad happened");
```

Where the console output appears will depend on how your operating system and how you start Node-RED. If you start using a command line - that is the console where logging will appear. If you run as a system service then it may appear in the system log. If you run under an app like PM2 it will have it’s own way for showing logs. On a Pi the install script adds a node-red-log command that will display the log.

The warn and error messages also get sent to the debug tab on the right side of the flow editor.

For finer grained logging, `node.trace()` and `node.debug()` are also available. If there is no logger configured to capture those levels, they will not be seen.

## Handling errors

If the function encounters an error that should halt the current flow, it should return nothing. To trigger a Catch node on the same tab, the function should call `node.error` with the original message as a second argument:

```javascript
node.error("hit an error", msg);
```

## Storing data

Aside from the `msg` object, the function can also store data in the context store.

More information about Context within Node-RED is available here.

In the Function node there are three predefined variables that can be used to access context:

- `context` - the node’s local context
- `flow` - the flow scope context
- `global` - the global scope context

The following examples use flow context, but apply equally well to context and global.

> **Note:** These predefined variables are a feature of the Function node. If you are creating a custom node, check the Creating Nodes guide for how to access context.

There are two modes for accessing context; either synchronous or asynchronous. The built-in context stores provide both modes. Some stores may only provide asynchronous access and will throw an error if they are accessed synchronously.

To get a value from context:

```javascript
var myCount = flow.get("count");
```

To set a value:

```javascript
flow.set("count", 123);
```

The following example maintains a count of how many times the function has been run:

```javascript
// initialise the counter to 0 if it doesn't exist already
var count = context.get('count')||0;
count += 1;
// store the value back
context.set('count',count);
// make it part of the outgoing msg object
msg.count = count;
return msg;
```

### Get/Set multiple values

Since Node-RED 0.19, it is also possible to get or set multiple values in one go:

```javascript
// Node-RED 0.19 or later
var values = flow.get(["count", "colour", "temperature"]);
// values[0] is the 'count' value
// values[1] is the 'colour' value
// values[2] is the 'temperature' value
// Node-RED 0.19 or later
flow.set(["count", "colour", "temperature"], [123, "red", "12.5"]);
```

In this case, any missing values are set to null.

### Asynchronous context access

If the context store requires asynchronous access, the get and set functions require an extra callback parameter.

```javascript
// Get single value
flow.get("count", function(err, myCount) { ... });

// Get multiple values
flow.get(["count", "colour"], function(err, count, colour) { ... })

// Set single value
flow.set("count", 123, function(err) { ... })

// Set multiple values
flow.set(["count", "colour"], [123, "red"], function(err) { ... })
```

The first argument passed to the callback, `err`, is only set if an error occurred when accessing context.

The asynchronous version of the count example becomes:

```javascript
context.get('count', function(err, count) {
    if (err) {
        node.error(err, msg);
    } else {
        // initialise the counter to 0 if it doesn't exist already
        count = count || 0;
        count += 1;
        // store the value back
        context.set('count',count, function(err) {
            if (err) {
                node.error(err, msg);
            } else {
                // make it part of the outgoing msg object
                msg.count = count;
                // send the message
                node.send(msg);
            }
        });
    }
});
```

## Multiple context stores

With 0.19 it is possible to configure multiple context stores. For example, both a memory and file based store could be used.

The get/set context functions accept an optional parameter to identify the store to use.

```javascript
// Get value - sync
var myCount = flow.get("count", storeName);

// Get value - async
flow.get("count", storeName, function(err, myCount) { ... });

// Set value - sync
flow.set("count", 123, storeName);

// Set value - async
flow.set("count", 123, storeName, function(err) { ... })
```

## Global context

The global context can be pre-populated with objects when Node-RED starts. This is defined in the main `settings.js` file under the `functionGlobalContext` property.

This can be used to load additional modules within the Function node.

### Adding modules using functionGlobalContext

Additional node modules cannot be loaded directly within a Function node. They must be loaded in your `settings.js` file and added to the `functionGlobalContext` property.

For example, the built-in `os` module can be made available to all functions by adding the following to your `settings.js` file:

```javascript
functionGlobalContext: {
    osModule:require('os')
}
```

At which point, the module can be referenced within a function as `global.get('osModule')`.

Modules loaded from your settings file must be installed in the same directory as the settings file. For most users that will be the default user directory - `~/.node-red`:

```sh
cd ~/.node-red
npm install name_of_3rd_party_module
```

### Using the functionExternalModules option

Since Node-RED 1.3.0

By setting `functionExternalModules` to `true` in you `settings.js` file, the Function node’s edit dialog will provide a list where you can add additional modules that should be available to the node. You also specify the variable that will be used to refer to the module in the node’s code.

The modules are automatically installed under `~/.node-red/node_modules/` when the node is deployed.

## Handling a Timeout

Since Node-RED 3.1.0

It is possible to set a timeout for the function node on the Setup tab. This value, in seconds, is how long the runtime will allow the Function node to run for before raising an error. If set to 0, the default, no timeout is applied.

## API Reference

The following objects are available within the Function node.

- `node`
  - `node.id` : the id of the Function node - added in 0.19
  - `node.name` : the name of the Function node - added in 0.19
  - `node.outputCount` : number of outputs set for Function node - added in 1.3
  - `node.log(..)` : log a message
  - `node.warn(..)` : log a warning message
  - `node.error(..)` : log an error message
  - `node.debug(..)` : log a debug message
  - `node.trace(..)` : log a trace message
  - `node.on(..)` : register an event handler
  - `node.status(..)` : update the node status
  - `node.send(..)` : send a message
  - `node.done(..)` : finish with a message
- `context`
  - `context.get(..)` : get a node-scoped context property
  - `context.set(..)` : set a node-scoped context property
  - `context.keys(..)` : return a list of all node-scoped context property keys
  - `context.flow` : same as flow
  - `context.global` : same as global
- `flow`
  - `flow.get(..)` : get a flow-scoped context property
  - `flow.set(..)` : set a flow-scoped context property
  - `flow.keys(..)` : return a list of all flow-scoped context property keys
- `global`
  - `global.get(..)` : get a global-scoped context property
  - `global.set(..)` : set a global-scoped context property
  - `global.keys(..)` : return a list of all global-scoped context property keys
- `RED`
  - `RED.util.cloneMessage(..)` : safely clones a message object so it can be reused
- `env`
  - `env.get(..)` : get an environment variable

## Other modules and functions

The Function node also makes the following modules and functions available:

- `Buffer` - the Node.js Buffer module
- `console` - the Node.js console module (node.log is the preferred method of logging)
- `util` - the Node.js util module
- `setTimeout`/`clearTimeout` - the javascript timeout functions.
- `setInterval`/`clearInterval` - the javascript interval functions.

> **Note:** the function node automatically clears any outstanding timeouts or interval timers whenever it is stopped or re-deployed.

# brace

<a href="https://www.patreon.com/bePatron?u=8663953"><img alt="become a patron" src="https://c5.patreon.com/external/logo/become_a_patron_button.png" height="35px"></a>

[browserify](https://github.com/substack/node-browserify) compatible version of the [ace editor](http://ajaxorg.github.io/ace/).

[![browser support](https://ci.testling.com/thlorenz/brace.png)](https://ci.testling.com/thlorenz/brace)

***This badge shows which browsers support annotations, however the editor itself works in pretty much every browser.***

[![screenshot](assets/brace.png)](http://thlorenz.github.io/brace/)
*[Try it in your browser](http://thlorenz.github.io/brace/)*

## Installation

    npm install brace

## Example

```js
var ace = require('brace');
require('brace/mode/javascript');
require('brace/theme/monokai');

var editor = ace.edit('javascript-editor');
editor.getSession().setMode('ace/mode/javascript');
editor.setTheme('ace/theme/monokai');
```

Include the above as an **entry** in your browserify build, add a `<div id="javascript-editor"></div>` to your html page and
a JavaScript editor will appear.

This editor will show error/warning annotations if your browser supports WebWorkers
created via a blob URL (see testling support badge on top).

Please consult the [detailed example](https://github.com/thlorenz/brace/tree/master/example) for more information.

## Why not just use ace?

The ace editor creates the [WebWorker](http://www.html5rocks.com/en/tutorials/workers/basics/) via a worker script url.
This requires the worker scripts to reside on your server and forces you to host the ace editor on your server as well.

While that is ok in most cases, it prevents you from providing a fully working ace editor package.

With brace, you have two options:

- include brace itself when browserifying your app to get a fully working ace editor included with your bundle (no other
  external scripts needed)
- create the bundle as explained above and provide it to others so they can include it in their html page simply via a
  script tag

## What if my browser doesn't support it?

If brace is unable to inline the web worker, it just falls back to provide the ace editor without annotation support.
This means the editor is fully functional, but doesn't display errors/warnings on the left side.

As far as I understand, the original ace editor behaves in exactly the same way.

## How does it work?

brace has an [update script](https://github.com/thlorenz/brace/blob/master/build/update.js) which automatically pulls
down the [ace builds](https://github.com/ajaxorg/ace-builds) and refactors them to provide the following:

- inline all supported workers
- automatically require the workers that a 'mode' (language) depends on inside the mode file itself
- provide the modes and themes at the same paths that ace's `setMode` and `setTheme` use (just replace 'ace' with
  'brace') as seen in the above example

## Supported Workers

All workers included with ace are supported, except `php` and `xquery`, mainly because I wasn't able to properly
stringify their code (any help with that is appreciated).

## Can I use it with TypeScript?

Yes, brace includes modular type definitions so you can do normal import statements and type safety checking
with TypeScript. The example above becomes:

```ts
import * as ace from 'brace';
import 'brace/mode/javascript';
import 'brace/theme/monokai';

const editor = ace.edit('javascript-editor');
editor.getSession().setMode('ace/mode/javascript');
editor.setTheme('ace/theme/monokai');
```

brace exposes these type definitions in `package.json`, so they are available when you do `npm install brace`.
You do not need an additional install step or another tool to install these definitions.

These type definitions are kept up to date in the same way as the rest of brace. There is an
[update script](https://github.com/thlorenz/brace/blob/master/build/update-ts.js) which automatically pulls
down the [DefinitelyTyped definition](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/ace/index.d.ts)
and refactors it to be modular rather than global.

## Test

    npm explore brace
    npm test

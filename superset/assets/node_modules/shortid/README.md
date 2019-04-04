## shortid  [![Build Status](http://img.shields.io/travis/dylang/shortid.svg)](https://travis-ci.org/dylang/shortid) [![shortid](http://img.shields.io/npm/dm/shortid.svg)](https://www.npmjs.org/package/shortid)

> Amazingly short non-sequential url-friendly unique id generator.








ShortId creates amazingly short non-sequential url-friendly unique ids.  Perfect for url shorteners, MongoDB and Redis ids, and any other id users might see.

 * By default 7-14 url-friendly characters: `A-Z`, `a-z`, `0-9`, `_-`
 * Supports `cluster` (automatically), custom seeds, custom alphabet.
 * Can generate any number of ids without duplicates, even millions per day.
 * Perfect for games, especially if you are concerned about cheating so you don't want an easily guessable id.
 * Apps can be restarted any number of times without any chance of repeating an id.
 * Popular replacement for Mongo ID/Mongoose ID.
 * Works in Node, io.js, and web browsers.
 * Includes [Mocha](http://mochajs.org/) tests.

ShortId does not generate cryptographically secure ids, so don't rely on it to make IDs which are impossible to guess.


### Usage

```js
const shortid = require('shortid');

console.log(shortid.generate());
// PPBqWA9
```

Mongoose Unique Id
```js
_id: {
  'type': String,
  'default': shortid.generate
},
```



### Browser Compatibility

The best way to use `shortid` in the browser is via [browserify](http://browserify.org/) or [webpack](http://webpack.github.io/).

These tools will automatically only include the files necessary for browser compatibility.

All tests will run in the browser as well:

```bash
## build the bundle, then open Mocha in a browser to see the tests run.
$ grunt build open
```



### Example

```bash
~/projects/shortid ❯ node examples/examples.js
eWRhpRV
23TplPdS
46Juzcyx
dBvJIh-H
2WEKaVNO
7oet_d9Z
dogPzIz8
nYrnfYEv
a4vhAoFG
hwX6aOr7
```


#### Real World Examples

`shortId` was created for Node Knockout 2011 winner for Most Fun [Doodle Or Die](http://doodleordie.com).
Millions of doodles have been saved with `shortId` filenames. Every log message gets a `shortId` to make it easy
for us to look up later.

Here are some other projects that use shortId:

* [bevy](https://npmjs.org/package/bevy) - A simple server to manage multiple Node services.
* [capre](https://npmjs.org/package/capre) - Cross-Server Data Replication.
* [cordova-build](https://www.npmjs.org/package/cordova-build) - an alternative to phonegap build that runs on your servers/agents.
* [couchdb-tools](https://www.npmjs.org/package/couchdb-tools) - A library of handy functions for use when working with CouchDB documents.
* [CleverStack/clever-email](https://github.com/CleverStack/clever-email) - E-mail system for CleverStack.
* [CloudTypes](https://github.com/ticup/CloudTypes) - JavaScript end2end implementation of the Cloud Types model for Eventual Consistency programming.
* [dnode-tarantula](https://github.com/jutaz/dnode-tarantula) - an asynchronous rpc and event system for node.js based on dnode-protocol and TCP sockets.
* [mongoose-url-shortener](https://www.npmjs.org/package/mongoose-url-shortener) - A simple URL Shortening library for NodeJS using Promises/A+ results.
* [mozilla/smokejumper](https://github.com/mozilla/smokejumper) - The Smoke Jumper project is an effort to bring dead simple, secure, P2P file sharing to Firefox.
* [shortness](https://npmjs.org/package/shortness) - Node based URL shortener that uses SQLite.
* [file-db](https://npmjs.org/package/file-db) - Document database that uses directories and files to store its data, supporting nested key-value objects in named collections.
* [resume-generator](https://www.npmjs.org/package/resume-generator) - Resume Generator.
* [riffmint](https://npmjs.org/package/riffmint) - Collaboration in musical space.
* [rap1ds/dippa](https://github.com/rap1ds/dippa) - Dippa Editor – A web-based LaTeX editor




### API

```js
var shortid = require('shortid');
```

---------------------------------------

#### `shortid.generate()`

__Returns__ `string` non-sequential unique id.

__Example__

```js
users.insert({
  _id: shortid.generate(),
  name: '...',
  email: '...'
});
```

---------------------------------------

#### `shortid.characters(string)`

__Default:__ `'0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_'`

__Returns__ new alphabet as a `string`

__Recommendation:__ If you don't like _ or -, you can to set new characters to use.

__Optional__

Change the characters used.

You must provide a string of all 64 unique characters. Order is not important.

The default characters provided were selected because they are url safe.

__Example__

```js
// use $ and @ instead of - and _
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');
```

```js
// any 64 unicode characters work, but I wouldn't recommend this.
shortid.characters('ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ①②③④⑤⑥⑦⑧⑨⑩⑪⑫');
```


---------------------------------------

#### `shortid.isValid(id)`

__Returns__ `boolean`

Check to see if an id is a valid `shortid`. Note: This only means the id _could_ have been generated by `shortid`, it doesn't guarantee it.

__Example__

```js
shortid.isValid('41XTDbE');
// true
```

```js
shortid.isValid('i have spaces');
// false
```

---------------------------------------

#### `shortid.worker(integer)`

__Default:__ `process.env.NODE_UNIQUE_ID || 0`

__Recommendation:__ You typically won't want to change this.

__Optional__

If you are running multiple server processes then you should make sure every one has a unique `worker` id. Should be an integer between 0 and 16.
If you do not do this there is very little chance of two servers generating the same id, but it is theoretically possible
if both are generated in the exact same second and are generating the same number of ids that second and a half-dozen random numbers are all exactly the same.

__Example__

```js
shortid.worker(1);
```

---------------------------------------

#### `shortid.seed(integer)`

__Default:__ `1`

__Recommendation:__ You typically won't want to change this.

__Optional__

Choose a unique value that will seed the random number generator so users won't be able to figure out the pattern of the unique ids. Call it just once in your application before using `shortId` and always use the same value in your application.

Most developers won't need to use this, it's mainly for testing ShortId.

If you are worried about users somehow decrypting the id then use it as a secret value for increased encryption.

__Example__

```js
shortid.seed(1000);
```






### About the Author

Hi! Thanks for checking out this project! My name is **Dylan Greene**. When not overwhelmed with my two young kids I enjoy contributing
to the open source community. I'm also a tech lead at [Opower](http://opower.com). [![@dylang](https://img.shields.io/badge/github-dylang-green.svg)](https://github.com/dylang) [![@dylang](https://img.shields.io/badge/twitter-dylang-blue.svg)](https://twitter.com/dylang)

Here's some of my other Node projects:

| Name | Description | npm&nbsp;Downloads |
|---|---|---|
| [`npm‑check`](https://github.com/dylang/npm-check) | Check for outdated, incorrect, and unused dependencies. | [![npm-check](https://img.shields.io/npm/dm/npm-check.svg?style=flat-square)](https://www.npmjs.org/package/npm-check) |
| [`grunt‑notify`](https://github.com/dylang/grunt-notify) | Automatic desktop notifications for Grunt errors and warnings. Supports OS X, Windows, Linux. | [![grunt-notify](https://img.shields.io/npm/dm/grunt-notify.svg?style=flat-square)](https://www.npmjs.org/package/grunt-notify) |
| [`space‑hogs`](https://github.com/dylang/space-hogs) | Discover surprisingly large directories from the command line. | [![space-hogs](https://img.shields.io/npm/dm/space-hogs.svg?style=flat-square)](https://www.npmjs.org/package/space-hogs) |
| [`rss`](https://github.com/dylang/node-rss) | RSS feed generator. Add RSS feeds to any project. Supports enclosures and GeoRSS. | [![rss](https://img.shields.io/npm/dm/rss.svg?style=flat-square)](https://www.npmjs.org/package/rss) |
| [`grunt‑prompt`](https://github.com/dylang/grunt-prompt) | Interactive prompt for your Grunt config using console checkboxes, text input with filtering, password fields. | [![grunt-prompt](https://img.shields.io/npm/dm/grunt-prompt.svg?style=flat-square)](https://www.npmjs.org/package/grunt-prompt) |
| [`xml`](https://github.com/dylang/node-xml) | Fast and simple xml generator. Supports attributes, CDATA, etc. Includes tests and examples. | [![xml](https://img.shields.io/npm/dm/xml.svg?style=flat-square)](https://www.npmjs.org/package/xml) |
| [`changelog`](https://github.com/dylang/changelog) | Command line tool (and Node module) that generates a changelog in color output, markdown, or json for modules in npmjs.org's registry as well as any public github.com repo. | [![changelog](https://img.shields.io/npm/dm/changelog.svg?style=flat-square)](https://www.npmjs.org/package/changelog) |
| [`grunt‑attention`](https://github.com/dylang/grunt-attention) | Display attention-grabbing messages in the terminal | [![grunt-attention](https://img.shields.io/npm/dm/grunt-attention.svg?style=flat-square)](https://www.npmjs.org/package/grunt-attention) |
| [`observatory`](https://github.com/dylang/observatory) | Beautiful UI for showing tasks running on the command line. | [![observatory](https://img.shields.io/npm/dm/observatory.svg?style=flat-square)](https://www.npmjs.org/package/observatory) |
| [`anthology`](https://github.com/dylang/anthology) | Module information and stats for any @npmjs user | [![anthology](https://img.shields.io/npm/dm/anthology.svg?style=flat-square)](https://www.npmjs.org/package/anthology) |
| [`grunt‑cat`](https://github.com/dylang/grunt-cat) | Echo a file to the terminal. Works with text, figlets, ascii art, and full-color ansi. | [![grunt-cat](https://img.shields.io/npm/dm/grunt-cat.svg?style=flat-square)](https://www.npmjs.org/package/grunt-cat) |

_This list was generated using [anthology](https://github.com/dylang/anthology)._


### License
Copyright (c) 2016 Dylan Greene, contributors.

Released under the [MIT license](https://tldrlegal.com/license/mit-license).

Screenshots are [CC BY-SA](http://creativecommons.org/licenses/by-sa/4.0/) (Attribution-ShareAlike).

# output-file-sync

[![npm version](https://img.shields.io/npm/v/output-file-sync.svg)](https://www.npmjs.com/package/output-file-sync)
[![Build Status](https://travis-ci.org/shinnn/output-file-sync.svg?branch=master)](https://travis-ci.org/shinnn/output-file-sync)
[![Build status](https://ci.appveyor.com/api/projects/status/3qjn5ktuqb6w2cae?svg=true)](https://ci.appveyor.com/project/ShinnosukeWatanabe/output-file-sync)
[![Coverage Status](https://coveralls.io/repos/github/shinnn/output-file-sync/badge.svg?branch=master)](https://coveralls.io/github/shinnn/output-file-sync?branch=master)

Synchronously write a file and create its ancestor directories if needed

```javascript
const {readFileSync} = require('fs');
const outputFileSync = require('output-file-sync');

outputFileSync('foo/bar/baz.txt', 'Hi!');
readFileSync('foo/bar/baz.txt', 'utf8'); //=> 'Hi!'
```

## Difference from [fs.outputFileSync](https://github.com/jprichardson/node-fs-extra/blob/master/docs/outputFile.md)

This module is very similar to [fs-extra](https://github.com/jprichardson/node-fs-extra)'s `fs.outputFileSync` method, but different in the following points:

1. *output-file-sync* returns the path of the directory created first. [See the API document for more details.](#outputfilesyncpath-data--options)
2. *output-file-sync* accepts [mkdirp] options.
   ```javascript
   const {statSync} = require('fs');
   const outputFileSync = require('output-file-sync');

   outputFileSync('foo/bar', 'content', {mode: 33260});
   statSync('foo').mode; //=> 33260
   ```
3. *output-file-sync* validates its arguments strictly, and prints highly informative error message.

## Installation

[Use](https://docs.npmjs.com/cli/install) [npm](https://docs.npmjs.com/getting-started/what-is-npm).

```
npm install output-file-sync
```

## API

```javascript
const outputFileSync = require('output-file-sync');
```

### outputFileSync(*path*, *data* [, *options*])

*path*: `string`  
*data*: `string`, `Buffer` or `Uint8Array`  
*options*: `Object` (options for [fs.writeFileSync] and [mkdirp]) or `string` (encoding)  
Return: `string` if it creates more than one directories, otherwise `null`

It writes the data to a file synchronously. If ancestor directories of the file don't exist, it creates the directories before writing the file.

```javascript
const {statSync} = require('fs');
const outputFileSync = require('output-file-sync');

// When the directory `foo/bar` exists
outputFileSync('foo/bar/baz/qux.txt', 'Hello', 'utf-8');

statSync('foo/bar/baz').isDirectory(); //=> true
statSync('foo/bar/baz/qux.txt').isFile(); //=> true
```

It returns the directory path just like [mkdirp.sync](https://github.com/substack/node-mkdirp#mkdirpsyncdir-opts):

> Returns the first directory that had to be created, if any.

```javascript
const dir = outputFileSync('foo/bar/baz.txt', 'Hello');
dir === path.resolve('foo'); //=> true
```

#### options

All options for [fs.writeFileSync] and [mkdirp] are available.

Additionally, you can pass [`fileMode`](#optionsfilemode) and [`dirMode`](#optionsdirmode) options to set different permission between the file and directories.

##### options.fileMode

Set the mode of a file, overriding `mode` option.

##### options.dirMode

Set the modes of directories, overriding `mode` option.

```javascript
outputFileSync('dir/file', 'content', {dirMode: '0745', fileMode: '0644'});
fs.statSync('dir').mode.toString(8); //=> '40745'
fs.statSync('dir/file').mode.toString(8); //=> '100644'
```

## Related project

* [output-file](https://github.com/shinnn/output-file) (asynchronous version)

## License

[ISC License](./LICENSE) © 2017 - 2018 Shinnosuke Watanabe

[fs.writeFileSync]: https://nodejs.org/api/fs.html#fs_fs_writefilesync_file_data_options
[mkdirp]: https://github.com/substack/node-mkdirp

# MurmurHash.js

An optimized JavaScript implementation of the MurmurHash algorithms.

These algorithms take a JavaScript string (and a seed), and quickly create a non-cryptographic 32-bit hash from it. And by quick I mean sub-millisecond performance.

More information about these algorithms can be found at:

*	[MurmurHash Homepage](http://sites.google.com/site/murmurhash/)
*	[Wikipedia Entry on MurmurHash](http://en.wikipedia.org/wiki/MurmurHash) 

## Install

    npm install murmurhash-js
    
## API

```javascript
var murmur = require("murmurhash-js")
```

### Methods

#### `murmur.murmur2(key, seed)`
Runs the murmur2 hash algorithm on the string `key` with initial seed `seed`.

#### `murmur.murmur3(key, seed)`
Runs the murmur3 hash algorithm on the string `key` with initial seed `seed`.

**Note** `require("murmur-hash")` is the same as `murmur.murmur3`

## License (MIT)

Copyright (c) 2011 Gary Court

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
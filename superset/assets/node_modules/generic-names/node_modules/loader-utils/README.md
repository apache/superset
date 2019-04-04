# loader-utils

## Methods

### `getLoaderConfig`

Recommended way to retrieve the loader config:

```javascript
// inside your loader
config = loaderUtils.getLoaderConfig(this, "myLoader");
```

Tries to read the loader config from the `webpack.config.js` under the given property name (`"myLoader"` in this case) and merges the result with the loader query. For example, if your `webpack.config.js` had this property...

```javascript
cheesecakeLoader: {
	type: "delicious",
	slices: 4
}
```

...and your loader was called with `?slices=8`, `getLoaderConfig(this, "cheesecakeLoader")` would return

```javascript
{
	type: "delicious",
	slices: 8
}
```

It is recommended that you use the camelCased loader name as your default config property name.

### `parseQuery`

``` javascript
var query = loaderUtils.parseQuery(this.query);
assert(typeof query == "object");
if(query.flag)
	// ...
```

``` text
null                   -> {}
?                      -> {}
?flag                  -> { flag: true }
?+flag                 -> { flag: true }
?-flag                 -> { flag: false }
?xyz=test              -> { xyz: "test" }
?xyz[]=a               -> { xyz: ["a"] }
?flag1&flag2           -> { flag1: true, flag2: true }
?+flag1,-flag2         -> { flag1: true, flag2: false }
?xyz[]=a,xyz[]=b       -> { xyz: ["a", "b"] }
?a%2C%26b=c%2C%26d     -> { "a,&b": "c,&d" }
?{json:5,data:{a:1}}   -> { json: 5, data: { a: 1 } }
```

### `stringifyRequest`

Turns a request into a string that can be used inside `require()` or `import` while avoiding absolute paths.
Use it instead of `JSON.stringify(...)` if you're generating code inside a loader.

**Why is this necessary?** Since webpack calculates the hash before module paths are translated into module ids, we must avoid absolute paths to ensure
consistent hashes across different compilations.

This function:

- resolves absolute requests into relative requests if the request and the module are on the same hard drive
- replaces `\` with `/` if the request and the module are on the same hard drive
- won't change the path at all if the request and the module are on different hard drives
- applies `JSON.stringify` to the result

```javascript
loaderUtils.stringifyRequest(this, "./test.js");
// "\"./test.js\""

loaderUtils.stringifyRequest(this, ".\\test.js");
// "\"./test.js\""

loaderUtils.stringifyRequest(this, "test");
// "\"test\""

loaderUtils.stringifyRequest(this, "test/lib/index.js");
// "\"test/lib/index.js\""

loaderUtils.stringifyRequest(this, "otherLoader?andConfig!test?someConfig");
// "\"otherLoader?andConfig!test?someConfig\""

loaderUtils.stringifyRequest(this, require.resolve("test"));
// "\"../node_modules/some-loader/lib/test.js\""

loaderUtils.stringifyRequest(this, "C:\\module\\test.js");
// "\"../../test.js\"" (on Windows, in case the module and the request are on the same drive)

loaderUtils.stringifyRequest(this, "C:\\module\\test.js");
// "\"C:\\module\\test.js\"" (on Windows, in case the module and the request are on different drives)

loaderUtils.stringifyRequest(this, "\\\\network-drive\\test.js");
// "\"\\\\network-drive\\\\test.js\"" (on Windows, in case the module and the request are on different drives)
```

### `urlToRequest`

Converts some resource URL to a webpack module request.

```javascript
var url = "path/to/module.js";
var request = loaderUtils.urlToRequest(url); // "./path/to/module.js"
```

#### Module URLs

Any URL containing a `~` will be interpreted as a module request. Anything after the `~` will be considered the request path.

```javascript
var url = "~path/to/module.js";
var request = loaderUtils.urlToRequest(url); // "path/to/module.js"
```

#### Root-relative URLs

URLs that are root-relative (start with `/`) can be resolved relative to some arbitrary path by using the `root` parameter:

```javascript
var url = "/path/to/module.js";
var root = "./root";
var request = loaderUtils.urlToRequest(url, root); // "./root/path/to/module.js"
```

To convert a root-relative URL into a module URL, specify a `root` value that starts with `~`:

```javascript
var url = "/path/to/module.js";
var root = "~";
var request = loaderUtils.urlToRequest(url, root); // "path/to/module.js"
```

### `interpolateName`

Interpolates a filename template using multiple placeholders and/or a regular expression.
The template and regular expression are set as query params called `name` and `regExp` on the current loader's context.

```javascript
var interpolatedName = loaderUtils.interpolateName(loaderContext, name, options);
```

The following tokens are replaced in the `name` parameter:

* `[ext]` the extension of the resource
* `[name]` the basename of the resource
* `[path]` the path of the resource relative to the `context` query parameter or option.
* `[folder]` the folder of the resource is in.
* `[emoji]` a random emoji representation of `options.content`
* `[emoji:<length>]` same as above, but with a customizable number of emojis
* `[hash]` the hash of `options.content` (Buffer) (by default it's the hex digest of the md5 hash)
* `[<hashType>:hash:<digestType>:<length>]` optionally one can configure
  * other `hashType`s, i. e. `sha1`, `md5`, `sha256`, `sha512`
  * other `digestType`s, i. e. `hex`, `base26`, `base32`, `base36`, `base49`, `base52`, `base58`, `base62`, `base64`
  * and `length` the length in chars
* `[N]` the N-th match obtained from matching the current file name against `options.regExp`

Examples

``` javascript
// loaderContext.resourcePath = "/app/js/javascript.js"
loaderUtils.interpolateName(loaderContext, "js/[hash].script.[ext]", { content: ... });
// => js/9473fdd0d880a43c21b7778d34872157.script.js

// loaderContext.resourcePath = "/app/page.html"
loaderUtils.interpolateName(loaderContext, "html-[hash:6].html", { content: ... });
// => html-9473fd.html

// loaderContext.resourcePath = "/app/flash.txt"
loaderUtils.interpolateName(loaderContext, "[hash]", { content: ... });
// => c31e9820c001c9c4a86bce33ce43b679

// loaderContext.resourcePath = "/app/img/image.gif"
loaderUtils.interpolateName(loaderContext, "[emoji]", { content: ... });
// => 👍

// loaderContext.resourcePath = "/app/img/image.gif"
loaderUtils.interpolateName(loaderContext, "[emoji:4]", { content: ... });
// => 🙍🏢📤🐝

// loaderContext.resourcePath = "/app/img/image.png"
loaderUtils.interpolateName(loaderContext, "[sha512:hash:base64:7].[ext]", { content: ... });
// => 2BKDTjl.png
// use sha512 hash instead of md5 and with only 7 chars of base64

// loaderContext.resourcePath = "/app/img/myself.png"
// loaderContext.query.name =
loaderUtils.interpolateName(loaderContext, "picture.png");
// => picture.png

// loaderContext.resourcePath = "/app/dir/file.png"
loaderUtils.interpolateName(loaderContext, "[path][name].[ext]?[hash]", { content: ... });
// => /app/dir/file.png?9473fdd0d880a43c21b7778d34872157

// loaderContext.resourcePath = "/app/js/page-home.js"
loaderUtils.interpolateName(loaderContext, "script-[1].[ext]", { regExp: "page-(.*)\\.js", content: ... });
// => script-home.js
```

### `getHashDigest`

``` javascript
var digestString = loaderUtils.getHashDigest(buffer, hashType, digestType, maxLength);
```

* `buffer` the content that should be hashed
* `hashType` one of `sha1`, `md5`, `sha256`, `sha512` or any other node.js supported hash type
* `digestType` one of `hex`, `base26`, `base32`, `base36`, `base49`, `base52`, `base58`, `base62`, `base64`
* `maxLength` the maximum length in chars

## License

MIT (http://www.opensource.org/licenses/mit-license.php)

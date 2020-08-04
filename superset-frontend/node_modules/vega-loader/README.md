# vega-loader

Network request and file loading utilities.

## API Reference

* [File Loading](#file-loading)
* [Data Format Parsing](#data-format-parsing)

### File Loading

<a name="loader" href="#loader">#</a>
vega.<b>loader</b>([<i>options</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-loader/src/loader.js "Source")

Creates a new loader instance with default *options*. A loader object provides methods for loading files from the network or disk, and for sanitizing requested URLs and filenames. If provided, the key-value pairs in the *options* object will be passed as default options to the various loader methods.

The *options* object can include the following entries:

- *baseURL*: A base URL prefix to append to provided *uri* values. This can
be useful for applications that load multiple data sets from the same domain.
- *mode*: A string explicitly indicating the loading mode. One of `'file'` (server-side only) or `'http'`. If set to `'file'` mode, later *uri* parameters may safely omit a `'file://'` prefix.
- *defaultProtocol*: The default protocol to use for protocol-relative *uri* values (e.g., `'//vega.github.io'`). Defaults to `'http'`.
- *target*: The browser `target` attribute for hyperlinks. Only applies when sanitizing *uri* values for use as a hyperlink.
- *rel*: The browser `rel` attribute for hyperlinks. Only applies when sanitizing *uri* values for use as a hyperlink.
- *http*: HTTP request parameters passed to underlying calls to [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API); see [RequestInit](https://fetch.spec.whatwg.org/#requestinit) for allowed properties.
- *crossOrigin*: Specifies the [`crossOrigin` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image) to apply to an Image. Only applies when [sanitize](#load_sanitize) is invoked with the option `"context": "image"`. If this property is defined and maps to a value of `null` or `undefined`, then a `no-cors` fetch will be performed for the Image. This property can be used to override Vega's default behavior of using `crossOrigin="anonymous"`, which allows images loaded from a different host to be included in exported visualization images (and thereby avoid "tainted canvas errors"), so long as the server provides permission via proper CORS headers.

<a name="load" href="#load">#</a>
loader.<b>load</b>(<i>uri</i>[, <i>options</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-loader/src/loader.js "Source")

Loads a file from either the network or disk, and returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) for asyncronously accessing the loaded content. This method does not perform any parsing, it simply returns the loaded data as either a Buffer or String instance, depending on the execution environment. To subsequently parse loaded data, use the [read](#read) method.

The *uri* argument is a value indicating the file to load. This is typically either an absolute or relative URL string. If running server-side via node.js, this argument might also be a file path (e.g., `'file:///path/to/file.txt'`).

If provided, the *options* argument will be combined with any default options passed to the [loader](#loader) constructor. In the case of identical property names, values from the *options* argument for this method will be used.

```js
var loader = vega.loader();
loader.load('data.json').then(function(data) {
  // do something with loaded data
}).catch(function(error) {
  // error handling here
});
```

<a name="load_sanitize" href="load_sanitize">#</a>
loader.<b>sanitize</b>(<i>uri</i>, <i>options</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-loader/src/loader.js "Source")

URI sanitizer function, which takes a *uri* and *options* object as input, and returns a Promise that resolves to a return object that includes a sanitized URL under the *href* property. This method is used internally by [load](#load) to ensure the URL is valid and to add additional protocol and hostname information, if needed. This method accepts the same *options* object accepted by [load](#load) and returns a Promise. If sanitization is successful, the Promise resolves to a return object containing the URL string as (_href_), along with a non-enumerable boolean _localFile_ flag, indicating if the file should be loaded from the local filesystem. The Promise rejects if the *uri* is invalid or disallowed. This method is over-writable for clients who wish to implement custom sanitization.

If provided, the *options* argument will be combined with any default options passed to the [loader](#loader) constructor. In the case of identical property names, values from the *options* argument for this method will be used.

<a name="load_http" href="load_http">#</a>
loader.<b>http</b>(<i>url</i>, <i>options</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-loader/src/loader.js "Source")

Function used internally by [load](#load) for servicing HTTP requests. Uses [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) by default. Clients may overwrite this method to perform custom HTTP request handling.

If provided, the *options* argument may include any valid fetch [RequestInit](https://fetch.spec.whatwg.org/#requestinit) properties. The provided *options* will be combined with any default options passed to the [loader](#loader) constructor under the *http* property. In the case of identical property names, values from the *options* argument for this method will be used.

<a name="load_file" href="load_file">#</a>
loader.<b>file</b>(<i>filename</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-loader/src/loader.js "Source")

Function used internally by [load](#load) for local file system requests. This method is over-writable for clients who wish to implement custom file loading. Uses the node.js [fs](https://nodejs.org/api/fs.html) module by default.

### Data Format Parsing

<a name="read" href="#read">#</a>
vega.<b>read</b>(<i>data</i>, <i>schema</i>[, <i>dateParse</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-loader/src/read.js "Source")

Parse loaded *data* according to a given format *schema*. The *data* argument should be either a String or Buffer instance, typically the result of calling [load](#load).

The *schema* object contents may depend on the data format (see below). Common options include:

- *type*: The data format type, such as `json`, `csv`, `tsv`, or `topojson`.
- *property*: For JSON types, specifies a property of the loaded JSON to reference. This is useful if a loaded JSON file contains multiple data sets and one would like to parse data under a specific property.
- *parse*: When set to `'auto'`, the method will perform type inference (using the [inferTypes](#inferTypes) method) to determine data types of each field. Alternatively, callers can specify parsing rules by providing an object mapping field names to data types (for example: `{'timestamp': 'date', 'price': 'number'}`). The valid data type options are `'boolean'`, `'integer'`, `'number'`, `'date'`, and `'string'`.

The `'date'` data type also accepts an optional format string (`'date:format'`). If provided, the optional *dateParse* function is used to generate date-time parsers for a date format string. If *dateParse* is unspecified, the [d3-time-format](https://github.com/d3/d3-time-format) library is used by default. Date-time format strings may be quoted (`date:'%A'`), but quoting is not required. In addition, parsing of date-time format strings to UTC time is supported (`'utc:format'`).

```js
// read loaded csv data, automatically infer value types
var data = null;
loader.load('data/stocks.csv').then(function(data) {
  data = vega.read(csv_data, {type: 'csv', parse: 'auto'});
});
```

```js
// read loaded csv data, using provided value types
var data = null;
loader.load('data/stocks.csv').then(function(data) {
  data = vega.read(data, {
    type: 'csv',
    parse: {'date': 'date', 'price': 'number'}
  });
});
```

```js
// read loaded topojson data, extract mesh of countries
var topojson = null;
loader.load('data/world-110m.json').then(function(data) {
  topojson = vega.read(data, {type: 'topojson', mesh: 'countries'});
});
```

<a name="inferType" href="#inferType">#</a>
vega.<b>inferType</b>(<i>values</i>[, <i>field</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-loader/src/type.js "Source")

Given an array of *values*, infers their data type as one of `'boolean'`, `'integer'`, `'number'`, `'date'`, or `'string'`. An optional *field* accessor can be used to first extract values from the input array, and is equivalent to first calling `values.map(field)`.

<a name="inferTypes" href="#inferTypes">#</a>
vega.<b>inferTypes</b>(<i>data</i>, <i>fields</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-loader/src/type.js "Source")

Given an array of *data* objects and a list of string-typed field names (*fields*), infers the data type for each field. Returns an object that maps field names to inferred types, determined using the [inferType](#inferType) method.

<a name="typeParsers" href="#typeParsers">#</a>
vega.<b>typeParsers</b>
[<>](https://github.com/vega/vega/blob/master/packages/vega-loader/src/type.js "Source")

An object containing a set of parsing functions for converting input values to a specified data type. All parsing functions return `null` if the input is `null`, `undefined` or the empty string (`''`).

The supported functions are:

- typeParsers.<b>boolean</b>(<i>value</i>): Parse the input *value* to a Boolean.
- typeParsers.<b>integer</b>(<i>value</i>): Parse the input *value* to an integer Number.
- typeParsers.<b>number</b>(<i>value</i>): Parse the input *value* to a Number.
- typeParsers.<b>date</b>(<i>value</i>[, <i>parser</i>]): Parse the input *value* to a Date. If provided, the *parser* function is used to interpret the *value*; otherwise `Date.parse` is used.
- typeParsers.<b>string</b>(<i>value</i>): Parse the input *value* to a String. If *value* is not already string-typed, it is coerced to a String.

<a name="formats" href="#formats">#</a>
vega.<b>formats</b>(<i>name</i>[, <i>format</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-loader/src/formats/index.js "Source")

Registry function for data format parsers. If invoked with two arguments, adds a new *format* parser with the provided *name*. Otherwise, returns an existing parser with the given *name*. The method signature of a format parser is:

- <b>format</b>(<i>data</i>, <i>options</i>)

A format parser that accepts two arguments, the input *data* to parse (e.g., a block of CSV text) and a set of format-specific *options*. The following data formats are registered by default:

- *dsv*: Delimiter-separated values format. Each line of text is a record, with each field separated by a delimiter string. Accepts a *delimiter* option indicating the delimiter string used to separate field values.
- *csv*: Comma-separated values format. A *dsv* instance with a comma (`,`) delimiter.
- *tsv*: Tab-separated values format. A *dsv* instance with a tab (`\t`) delimiter.
- *json*: [JavaScript Object Notation (JSON)](https://en.wikipedia.org/wiki/JSON) format. Accepts a *property* option, indicating a sub-property of the parsed JSON to return; useful if a data array is nested within a larger object. Also accepts a *copy* option (default `false`), which will defensively copy a JSON Object that was passed to Vega directly, rather than parsed from a string.
- *topojson*: [TopoJSON](https://github.com/mbostock/topojson/wiki) format for compressed encoding of geographic data. Requires either a *feature* option indicating the name of the geographic feature to extract (e.g., extracts individual paths for all countries), or a *mesh* option indicating a feature name for which a single mesh should be extracted (e.g., all country boundaries in a single path). Please see the [TopoJSON documentation](https://github.com/mbostock/topojson/wiki) for more.

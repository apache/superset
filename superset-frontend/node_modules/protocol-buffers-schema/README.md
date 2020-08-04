# protocol-buffers-schema

No nonsense [protocol buffers](https://developers.google.com/protocol-buffers) schema parser written in Javascript

``` js
npm install protocol-buffers-schema
```

[![build status](http://img.shields.io/travis/mafintosh/protocol-buffers-schema.svg?style=flat)](http://travis-ci.org/mafintosh/protocol-buffers-schema)

## Usage

First save the following file as `example.proto`

```proto
syntax = "proto2";

message Point {
  required int32 x = 1;
  required int32 y=2;
  optional string label = 3;
}

message Line {
  required Point start = 1;
  required Point end = 2;
  optional string label = 3;
}
```

The run the following example

``` js
var fs = require('fs')
var schema = require('protocol-buffers-schema')

// pass a buffer or string to schema.parse
var sch = schema.parse(fs.readFileSync('example.proto'))

// will print out the schema as a javascript object
console.log(sch)
```

Running the above example will print something like

``` js
{
  syntax: 2,
  package: null,
  enums: [],
  messages: [{
    name: 'Point',
    enums: [],
    messages: [],
    options: {},
    fields: [{
      name: 'x',
      type: 'int32',
      tag: 1,
      required: true,
      repeated: false,
      options: {}
    }, {
      name: 'y',
      type: 'int32',
      tag: 2,
      required: true,
      repeated: false,
      options: {}
    }, {
      name: 'label',
      type: 'string',
      tag: 3,
      required: false,
      repeated: false,
      options: {}
    }]
  }, {
    name: 'Line',
    enums: [],
    messages: [],
    options: {},
    fields: [{
      name: 'start',
      type: 'Point',
      tag: 1,
      required: true,
      repeated: false,
      options: {}
    }, {
      name: 'end',
      type: 'Point',
      tag: 2,
      required: true,
      repeated: false,
      options: {}
    }, {
      name: 'label',
      type: 'string',
      tag: 3,
      required: false,
      repeated: false,
      options: {}
    }]
  }],
  options:{}
}
```

## API

#### `schema.parse(protobufSchemaBufferOrString)`

Parses a .proto schema into a javascript object

#### `schema.stringify(schema)`

Stringifies a parsed schema back into .proto format

## License

MIT

bmp-js
======

A pure javascript Bmp encoder and decoder for node.js

Supports 1bit 4bit 8bit 24bit decoding and encoding with 24bit.

##Install

	$ npm install bmp-js


How to use?
---
###Decode BMP
```js
var bmp = require("bmp-js");
var bmpBuffer = fs.readFileSync('aa.bmp');
var bmpData = bmp.decode(bmpBuffer);
//bmpData={data:Buffer,width:Number,height:Height}

```

###Encode RGB
```js
var bmp = require("bmp-js");
//bmpData={data:Buffer,width:Number,height:Height}
var rawData = bmp.encode(bmpData);//default no compression

```

License
---
U can use on free with [MIT License](https://github.com/shaozilee/bmp-js/blob/master/LICENSE)
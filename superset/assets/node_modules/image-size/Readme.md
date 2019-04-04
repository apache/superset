# image-size

[![NPM Version](https://img.shields.io/npm/v/image-size.svg)](https://www.npmjs.com/package/image-size)
[![Build Status](https://travis-ci.org/image-size/image-size.svg?branch=master)](https://travis-ci.org/image-size/image-size)
[![NPM Downloads](https://img.shields.io/npm/dm/image-size.svg)](http://npm-stat.com/charts.html?package=image-size&author=&from=&to=)
[![Coverage Status](https://img.shields.io/coveralls/image-size/image-size/master.svg)](https://coveralls.io/github/image-size/image-size?branch=master)
[![devDependency Status](https://david-dm.org/image-size/image-size/dev-status.svg)](https://david-dm.org/image-size/image-size#info=devDependencies)

A [Node](https://nodejs.org/en/) module to get dimensions of any image file

## Supported formats

* BMP
* GIF
* JPEG
* PNG
* PSD
* TIFF
* WebP
* SVG
* DDS

### Upcoming

* SWF

## Programmatic Usage

```
npm install image-size --save
```

### Synchronous

```javascript
var sizeOf = require('image-size');
var dimensions = sizeOf('images/funny-cats.png');
console.log(dimensions.width, dimensions.height);
```

### Asynchronous

```javascript
var sizeOf = require('image-size');
sizeOf('images/funny-cats.png', function (err, dimensions) {
  console.log(dimensions.width, dimensions.height);
});
```
NOTE: The asynchronous version doesn't work if the input is a Buffer. Use synchronous version instead.

### Using a URL

```javascript
var url = require('url');
var http = require('http');

var sizeOf = require('image-size');

var imgUrl = 'http://my-amazing-website.com/image.jpeg';
var options = url.parse(imgUrl);

http.get(options, function (response) {
  var chunks = [];
  response.on('data', function (chunk) {
    chunks.push(chunk);
  }).on('end', function() {
    var buffer = Buffer.concat(chunks);
    console.log(sizeOf(buffer));
  });
});
```

You can optionally check the buffer lengths & stop downloading the image after a few kilobytes.
**You don't need to download the entire image**

## Command-Line Usage (CLI)

```
npm install image-size --global
image-size image1 [image2] [image3] ...
```

## Credits

not a direct port, but an attempt to have something like
[dabble's imagesize](https://github.com/dabble/imagesize/blob/master/lib/image_size.rb) as a node module.

## [Contributors](Contributors.md)

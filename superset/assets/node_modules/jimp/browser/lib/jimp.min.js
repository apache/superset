/*
Jimp v0.2.28
https://github.com/oliver-moran/jimp
Ported for the Web by Phil Seaton

The MIT License (MIT)

Copyright (c) 2014 Oliver Moran

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

var window = window || self;
if(!self.Buffer&&!window.Buffer)throw new Error("Node's Buffer() not available");if(!self.Jimp&&!window.Jimp)throw new Error("Could not Jimp object");!function(){function e(e,r){var n=new XMLHttpRequest;n.open("GET",e,!0),n.responseType="arraybuffer",n.onload=function(){n.status<400?r(this.response,null):r(null,"HTTP Status "+n.status+" for url "+e)},n.onerror=function(e){r(null,e)},n.send()}function r(e){for(var r=new Buffer(e.byteLength),n=new Uint8Array(e),t=0;t<r.length;++t)r[t]=n[t];return r}function n(e){return Object.prototype.toString.call(e).toLowerCase().indexOf("arraybuffer")>-1}delete Jimp.prototype.write,delete Jimp.read,Jimp.read=function(t,o){return new Promise(function(i,f){o=o||function(e,r){e?f(e):i(r)},"string"==typeof t?e(t,function(e,i){e?n(e)?new Jimp(r(e),o):o(new Error("Unrecognized data received for "+t)):i&&o(i)}):n(t)?new Jimp(r(t),o):o(new Error("Jimp expects a single ArrayBuffer or image URL"))})}}();
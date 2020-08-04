iconv-lite - native javascript conversion between character encodings.
======================================================================

## Usage

    var iconv = require('iconv-lite');
    
    // Convert from an encoded buffer to string.
    str = iconv.fromEncoding(buf, 'win-1251');
    // Or
    str = iconv.decode(buf, 'win-1251');
    
    // Convert from string to an encoded buffer.
    buf = iconv.toEncoding("Sample input string", 'win-1251');
    // Or
    buf = iconv.encode("Sample input string", 'win-1251');

## Supported encodings

Currently only a small part of encodings supported:

*   All node.js native encodings: 'utf8', 'ucs2', 'ascii', 'binary', 'base64'.
*   'latin1'
*   Cyrillic encodings: 'windows-1251', 'koi8-r', 'iso 8859-5'.

Other encodings are easy to add, see the source. Please, participate.


## Encoding/decoding speed

Comparison with iconv module (1000 times 256kb, on Core i5/2.5 GHz).

    Operation\module            iconv       iconv-lite (this)
    toEncoding('win1251')       19.57 mb/s  49.04 mb/s
    fromEncoding('win1251')     16.39 mb/s  24.11 mb/s


## Notes

This module is JavaScript-only, thus can be used in a sandboxed environment like [Cloud9](http://c9.io).

Untranslatable characters are set to '?'. No transliteration is currently supported, pull requests are welcome.

## Testing

    npm install --dev iconv-lite
    vows

## TODO

*   Support streaming character conversion, something like util.pipe(req, iconv.fromEncodingStream('latin1')).
*   Add more encodings.
*   Add transliteration (best fit char).
*   Add tests and correct support of variable-byte encodings (currently work is delegated to node).

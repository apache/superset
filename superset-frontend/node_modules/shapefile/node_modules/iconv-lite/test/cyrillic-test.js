var vows = require('vows'),
    assert = require('assert'),
    iconv = require(__dirname+'/../');

var baseStrings = {
    empty: "",
    hi: "Привет!",
    ascii: '\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\x0c\r\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f'+
           ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\x7f',
    rus: "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя",
    additional1: "ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—™љ›њќћџ ЎўЈ¤Ґ¦§Ё©Є«¬\xAD®Ї°±Ііґµ¶·ё№є»јЅѕї",
    additional2: "─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ё╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡Ё╢╣╤╥╦╧╨╩╪╫╬©",
    additional3: " ЁЂЃЄЅІЇЈЉЊЋЌ­ЎЏ№ёђѓєѕіїјљњћќ§ўџ",
    untranslatable: "£Åçþÿ¿",
};

var encodings = [{
    name: "Win-1251",
    variations: ['win1251', 'Windows-1251', 'windows1251', 'CP1251', 1251],
    encodedStrings: {
        empty: new Buffer(''),
        hi: new Buffer('\xcf\xf0\xe8\xe2\xe5\xf2!', 'binary'),
        ascii: new Buffer(baseStrings.ascii, 'binary'),
        rus: new Buffer('\xc0\xc1\xc2\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xcb\xcc\xcd\xce\xcf\xd0\xd1\xd2\xd3\xd4\xd5\xd6\xd7\xd8\xd9\xda\xdb\xdc\xdd\xde\xdf\xe0\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xeb\xec\xed\xee\xef\xf0\xf1\xf2\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xfa\xfb\xfc\xfd\xfe\xff', 'binary'),
        additional1: new Buffer('\x80\x81\x82\x83\x84\x85\x86\x87\x88\x89\x8a\x8b\x8c\x8d\x8e\x8f\x90\x91\x92\x93\x94\x95\x96\x97\x99\x9a\x9b\x9c\x9d\x9e\x9f\xa0\xa1\xa2\xa3\xa4\xa5\xa6\xa7\xa8\xa9\xaa\xab\xac\xad\xae\xaf\xb0\xb1\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9\xba\xbb\xbc\xbd\xbe\xbf','binary'),
    }
}, {
    name: "Koi8-R",
    variations: ['koi8r', 'KOI8-R', 'cp20866', 20866],
    encodedStrings: {
        empty: new Buffer(''),
        hi: new Buffer('\xf0\xd2\xc9\xd7\xc5\xd4!', 'binary'),
        ascii: new Buffer(baseStrings.ascii, 'binary'),
        rus: new Buffer('\xe1\xe2\xf7\xe7\xe4\xe5\xf6\xfa\xe9\xea\xeb\xec\xed\xee\xef\xf0\xf2\xf3\xf4\xf5\xe6\xe8\xe3\xfe\xfb\xfd\xff\xf9\xf8\xfc\xe0\xf1\xc1\xc2\xd7\xc7\xc4\xc5\xd6\xda\xc9\xca\xcb\xcc\xcd\xce\xcf\xd0\xd2\xd3\xd4\xd5\xc6\xc8\xc3\xde\xdb\xdd\xdf\xd9\xd8\xdc\xc0\xd1', 'binary'),
        additional2: new Buffer('\x80\x81\x82\x83\x84\x85\x86\x87\x88\x89\x8a\x8b\x8c\x8d\x8e\x8f\x90\x91\x92\x93\x94\x95\x96\x97\x98\x99\x9a\x9b\x9c\x9d\x9e\x9f\xa0\xa1\xa2\xa3\xa4\xa5\xa6\xa7\xa8\xa9\xaa\xab\xac\xad\xae\xaf\xb0\xb1\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9\xba\xbb\xbc\xbd\xbe\xbf', 'binary'),
    }
}, {
    name: "ISO 8859-5",
    variations: ['iso88595', 'ISO-8859-5', 'ISO 8859-5', 'cp28595', 28595],
    encodedStrings: {
        empty: new Buffer(''),
        hi: new Buffer('\xbf\xe0\xd8\xd2\xd5\xe2!', 'binary'),
        ascii: new Buffer(baseStrings.ascii, 'binary'),
        rus: new Buffer('\xb0\xb1\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9\xba\xbb\xbc\xbd\xbe\xbf\xc0\xc1\xc2\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xcb\xcc\xcd\xce\xcf\xd0\xd1\xd2\xd3\xd4\xd5\xd6\xd7\xd8\xd9\xda\xdb\xdc\xdd\xde\xdf\xe0\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xeb\xec\xed\xee\xef', 'binary'),
        additional3: new Buffer('\xa0\xa1\xa2\xa3\xa4\xa5\xa6\xa7\xa8\xa9\xaa\xab\xac\xad\xae\xaf\xf0\xf1\xf2\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xfa\xfb\xfc\xfd\xfe\xff', 'binary'),
    }
}];

var testsBatch = {};
encodings.forEach(function(encoding) {
    var enc = encoding.variations[0];
    var key = "hi";
    var tests = {
        "Convert to empty buffer": function() {
            assert.strictEqual(iconv.toEncoding("", enc).toString('binary'), new Buffer('').toString('binary'));
        },
        "Convert from empty buffer": function() {
            assert.strictEqual(iconv.fromEncoding(new Buffer(''), enc), "");
        },
        "Convert from buffer": function() {
            for (var key in encoding.encodedStrings)
                assert.strictEqual(iconv.fromEncoding(encoding.encodedStrings[key], enc), 
                    baseStrings[key]);
        },
        "Convert to buffer": function() {
            for (var key in encoding.encodedStrings)
                assert.strictEqual(iconv.toEncoding(baseStrings[key], enc).toString('binary'), 
                    encoding.encodedStrings[key].toString('binary'));
        },
        "Try different variations of encoding": function() {
            encoding.variations.forEach(function(enc) {
                assert.strictEqual(iconv.fromEncoding(encoding.encodedStrings[key], enc), baseStrings[key]);
                assert.strictEqual(iconv.toEncoding(baseStrings[key], enc).toString('binary'), encoding.encodedStrings[key].toString('binary'));
            });
        },
        "Untranslatable chars are converted to defaultCharSingleByte": function() {
            var expected = baseStrings.untranslatable.split('').map(function(c) {return iconv.defaultCharSingleByte; }).join('');
            assert.strictEqual(iconv.toEncoding(baseStrings.untranslatable, enc).toString('binary'), expected); // Only '?' characters.
        }
    };
    
    testsBatch[encoding.name+":"] = tests;
});

vows.describe("Test Cyrillic encodings").addBatch(testsBatch).export(module);


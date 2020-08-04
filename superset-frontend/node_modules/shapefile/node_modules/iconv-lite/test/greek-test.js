var vows = require('vows'),
    assert = require('assert'),
    iconv = require(__dirname+'/../');

var baseStrings = {
    empty: "",
    hi: "Γειά!",
    ascii: '\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\x0c\r\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f'+
           ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\x7f',
    greek: "αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩάέήίόύώΆΈΉΊΌΎΏϊϋΪΫ",
    untranslatable: "Åçþÿ¿"
};

var encodings = [{
    name: "windows1253",
    variations: ['windows-1253', 'win-1253', 'win1253', 'cp1253', 'cp-1253', 1253],
    encodedStrings: {
        empty: new Buffer(''),
        hi: new Buffer('\xc3\xe5\xe9\xdc!', 'binary'),
        ascii: new Buffer(baseStrings.ascii, 'binary'),
        greek: new Buffer('\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xeb\xec\xed\xee\xef\xf0\xf1\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xc1\xc2\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xcb\xcc\xcd\xce\xcf\xd0\xd1\xd3\xd4\xd5\xd6\xd7\xd8\xd9\xdc\xdd\xde\xdf\xfc\xfd\xfe\xa2\xb8\xb9\xba\xbc\xbe\xbf\xfa\xfb\xda\xdb', 'binary'),
    }
}, {
    name: "iso88597",
    variations: ['iso-8859-7', 'greek', 'greek8', 'cp28597', 'cp-28597', 28597],
    encodedStrings: {
        empty: new Buffer(''),
        hi: new Buffer('\xc3\xe5\xe9\xdc!', 'binary'),
        ascii: new Buffer(baseStrings.ascii, 'binary'),
        greek: new Buffer('\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xeb\xec\xed\xee\xef\xf0\xf1\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xc1\xc2\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xcb\xcc\xcd\xce\xcf\xd0\xd1\xd3\xd4\xd5\xd6\xd7\xd8\xd9\xdc\xdd\xde\xdf\xfc\xfd\xfe\xb6\xb8\xb9\xba\xbc\xbe\xbf\xfa\xfb\xda\xdb', 'binary'),
    }
}, {
    name: "cp737",
    variations: ['cp-737', 737],
    encodedStrings: {
        empty: new Buffer(''),
        hi: new Buffer('\x82\x9c\xa0\xe1!', 'binary'),
        ascii: new Buffer(baseStrings.ascii, 'binary'),
        greek: new Buffer('\x98\x99\x9a\x9b\x9c\x9d\x9e\x9f\xa0\xa1\xa2\xa3\xa4\xa5\xa6\xa7\xa8\xa9\xab\xac\xad\xae\xaf\xe0\x80\x81\x82\x83\x84\x85\x86\x87\x88\x89\x8a\x8b\x8c\x8d\x8e\x8f\x90\x91\x92\x93\x94\x95\x96\x97\xe1\xe2\xe3\xe5\xe6\xe7\xe9\xea\xeb\xec\xed\xee\xef\xf0\xe4\xe8\xf4\xf5', 'binary'),
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

vows.describe("Test Greek encodings").addBatch(testsBatch).export(module);

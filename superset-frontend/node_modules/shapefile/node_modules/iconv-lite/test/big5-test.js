var vows    = require('vows'),
    fs      = require('fs'),
    assert  = require('assert'),
    iconv   = require(__dirname + '/../');

var testString = "中文abc", //unicode contains Big5-code and ascii
    testStringBig5Buffer = new Buffer([0xa4,0xa4,0xa4,0xe5,0x61,0x62,0x63]),
    testString2 = '測試',
    testStringBig5Buffer2 = new Buffer([0xb4, 0xfa, 0xb8, 0xd5]);

vows.describe("Big5 tests").addBatch({
    "Big5 correctly encoded/decoded": function() {    
        assert.strictEqual(iconv.toEncoding(testString, "big5").toString('binary'), testStringBig5Buffer.toString('binary'));
        assert.strictEqual(iconv.fromEncoding(testStringBig5Buffer, "big5"), testString);
        assert.strictEqual(iconv.toEncoding(testString2, 'big5').toString('binary'), testStringBig5Buffer2.toString('binary'));
        assert.strictEqual(iconv.fromEncoding(testStringBig5Buffer2, 'big5'), testString2);
    },
    "cp950 correctly encoded/decoded": function() {    
        assert.strictEqual(iconv.toEncoding(testString, "cp950").toString('binary'), testStringBig5Buffer.toString('binary'));
        assert.strictEqual(iconv.fromEncoding(testStringBig5Buffer, "cp950"), testString);
    },
    "Big5 file read decoded,compare with iconv result": function() {
        var contentBuffer = fs.readFileSync(__dirname+"/big5File.txt");
        var str = iconv.fromEncoding(contentBuffer, "big5");
        var iconvc = new (require('iconv').Iconv)('big5','utf8');
        assert.strictEqual(iconvc.convert(contentBuffer).toString(), str);
    },
    "Big5 correctly decodes and encodes characters · and ×": function() {
        // https://github.com/ashtuchkin/iconv-lite/issues/13
        // Reference: http://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/CP950.TXT
        var chars = "·×";
        var big5Chars = new Buffer([0xA1, 0x50, 0xA1, 0xD1]);
        assert.strictEqual(iconv.toEncoding(chars, "big5").toString('binary'), big5Chars.toString('binary'));
        assert.strictEqual(iconv.fromEncoding(big5Chars, "big5"), chars)
    },
}).export(module)

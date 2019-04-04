var vows = require('vows'),
    assert = require('assert'),
    iconv = require(__dirname+'/../');

var testString = "Hello123!";
var testStringLatin1 = "Hello123!£Å÷×çþÿ¿®";
var testStringBase64 = "SGVsbG8xMjMh";

vows.describe("Generic UTF8-UCS2 tests").addBatch({
    "Vows is working": function() {},
    "Return values are of correct types": function() {
        assert.ok(iconv.toEncoding(testString, "utf8") instanceof Buffer);
        
        var s = iconv.fromEncoding(new Buffer(testString), "utf8");
        assert.strictEqual(Object.prototype.toString.call(s), "[object String]");
    },
    "Internal encodings all correctly encoded/decoded": function() {
        ['utf8', "UTF-8", "UCS2", "binary", ""].forEach(function(enc) {
            assert.strictEqual(iconv.toEncoding(testStringLatin1, enc).toString(enc), testStringLatin1);
            assert.strictEqual(iconv.fromEncoding(new Buffer(testStringLatin1, enc), enc), testStringLatin1);
        });
    },
    "Base64 correctly encoded/decoded": function() {    
        assert.strictEqual(iconv.toEncoding(testStringBase64, "base64").toString("binary"), testString);
        assert.strictEqual(iconv.fromEncoding(new Buffer(testString, "binary"), "base64"), testStringBase64);
    },
    "Latin1 correctly encoded/decoded": function() {    
        assert.strictEqual(iconv.toEncoding(testStringLatin1, "latin1").toString("binary"), testStringLatin1);
        assert.strictEqual(iconv.fromEncoding(new Buffer(testStringLatin1, "binary"), "latin1"), testStringLatin1);
    },
    "Convert from string, not buffer (binary encoding used)": function() {
        assert.strictEqual(iconv.fromEncoding(testStringLatin1, "binary"), testStringLatin1);
    },
    "Convert to string, not buffer (utf8 used)": function() {
        var res = iconv.toEncoding(new Buffer(testStringLatin1, "utf8"));
        assert.ok(res instanceof Buffer);
        assert.strictEqual(res.toString("utf8"), testStringLatin1);
    },
    "Throws on unknown encodings": function() {
        assert.throws(function() { iconv.toEncoding("a", "xxx"); });
        assert.throws(function() { iconv.fromEncoding("a", "xxx"); });
    },
    "Convert non-strings and non-buffers": function() {
        assert.strictEqual(iconv.toEncoding({}, "utf8").toString(), "[object Object]");
        assert.strictEqual(iconv.toEncoding(10, "utf8").toString(), "10");
        assert.strictEqual(iconv.toEncoding(undefined, "utf8").toString(), "");
        assert.strictEqual(iconv.fromEncoding({}, "utf8"), "[object Object]");
        assert.strictEqual(iconv.fromEncoding(10, "utf8"), "10");
        assert.strictEqual(iconv.fromEncoding(undefined, "utf8"), "");
    },
    "Aliases encode and decode work the same as toEncoding and fromEncoding": function() {
        assert.strictEqual(iconv.toEncoding(testString, "latin1").toString("binary"), iconv.encode(testString, "latin1").toString("binary"));
        assert.strictEqual(iconv.fromEncoding(testStringLatin1, "latin1"), iconv.decode(testStringLatin1, "latin1"));
    },
}).export(module)

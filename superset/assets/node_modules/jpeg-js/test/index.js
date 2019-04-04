var redtape = require('redtape'),
    fs = require('fs'),
    path = require('path'),
    jpeg = require('..');

var it = redtape({
  asserts: {
    bufferEqual: function (a, b) {
      if (a.length != b.length) return false;
      for (var i = 0, len = a.length; i < len; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    }
  }
});

function fixture(name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name));
}

it('should be able to decode a JPEG', function(t) {
  var jpegData = fixture('grumpycat.jpg');
  var rawImageData = jpeg.decode(jpegData);
  t.equal(rawImageData.width, 320);
  t.equal(rawImageData.height, 180);
  var expected = fixture('grumpycat.rgba');
  t.deepEqual(rawImageData.data, expected);
  t.end();
});

it('should be able to decode a JPEG with RST intervals', function(t) {
  var jpegData = fixture('redbox-with-rst.jpg');
  var rawImageData = jpeg.decode(jpegData);
  var expected = fixture('redbox.jpg');
  var rawExpectedImageData = jpeg.decode(expected);
  t.deepEqual(rawImageData.data, rawExpectedImageData.data);
  t.end();
});

it('should be able to decode a grayscale JPEG', function(t) {
  var jpegData = fixture('apsara.jpg');
  var rawImageData = jpeg.decode(jpegData);
  t.equal(rawImageData.width, 580);
  t.equal(rawImageData.height, 599);
  var expected = fixture('apsara.rgba');
  t.deepEqual(rawImageData.data, expected);
  t.end();
});

it('should be able to decode a CMYK jpeg with correct colors', function (t) {
  var jpegData = fixture('tree-cmyk.jpg');
  var rawImageData = jpeg.decode(jpegData);
  t.equal(rawImageData.width, 400);
  t.equal(rawImageData.height, 250);
  var expected = fixture('tree-cmyk.cmyk');
  t.deepEqual(rawImageData.data, expected);
  t.end();
});

it('should be able to decode an RGB jpeg with correct colors', function (t) {
  var jpegData = fixture('tree-rgb.jpg');
  var rawImageData = jpeg.decode(jpegData);
  t.equal(rawImageData.width, 400);
  t.equal(rawImageData.height, 250);
  var expected = fixture('tree-rgb.rgb');
  t.deepEqual(rawImageData.data, expected);
  t.end();
});

it('should be able to decode a greyscale CMYK jpeg with correct colors', function (t) {
  var jpegData = fixture('cmyk-grey.jpg');
  var rawImageData = jpeg.decode(jpegData);
  t.equal(rawImageData.width, 300);
  t.equal(rawImageData.height, 389);
  var expected = fixture('cmyk-grey.cmyk');
  t.deepEqual(rawImageData.data, expected);
  t.end();
});

it('should be able to decode an adobe CMYK jpeg with correct colors', function (t) {
  var jpegData = fixture('cmyktest.jpg');
  var rawImageData = jpeg.decode(jpegData);
  t.equal(rawImageData.width, 300);
  t.equal(rawImageData.height, 111);
  var expected = fixture('cmyktest.cmyk');
  t.deepEqual(rawImageData.data, expected);

  var jpegData2 = fixture('plusshelf-drawing.jpg');
  var rawImageData2 = jpeg.decode(jpegData2);
  t.equal(rawImageData2.width, 350);
  t.equal(rawImageData2.height, 233);
  var expected2 = fixture('plusshelf-drawing.cmyk');
  t.deepEqual(rawImageData2.data, expected2);

  t.end();
});

it('should be able to decode a unconventional table JPEG', function (t) {
  var jpegData = fixture('unconventional-table.jpg');
  var rawImageData = jpeg.decode(jpegData);
  t.equal(rawImageData.width, 1920);
  t.equal(rawImageData.height, 1200);
  t.end();
});

it('should be able to encode a JPEG', function (t) {
  var frameData = fixture('grumpycat.rgba');
  var rawImageData = {
    data: frameData,
    width: 320,
    height: 180
  };
  var jpegImageData = jpeg.encode(rawImageData, 50);
  t.equal(jpegImageData.width, 320);
  t.equal(jpegImageData.height, 180);
  var expected = fixture('grumpycat-50.jpg');
  t.deepEqual(jpegImageData.data, expected);
  t.end();
});

it('should be able to create a JPEG from an array', function (t) {
  var width = 320, height = 180;
  var frameData = new Buffer(width * height * 4);
  var i = 0;
  while (i < frameData.length) {
    frameData[i++] = 0xFF; // red
    frameData[i++] = 0x00; // green
    frameData[i++] = 0x00; // blue
    frameData[i++] = 0xFF; // alpha - ignored in JPEGs
  }
  var rawImageData = {
    data: frameData,
    width: width,
    height: height
  };
  var jpegImageData = jpeg.encode(rawImageData, 50);
  t.equal(jpegImageData.width, width);
  t.equal(jpegImageData.height, height);
  var expected = fixture('redbox.jpg');
  t.bufferEqual(jpegImageData.data, expected);
  t.end();
});

it('should be able to decode a JPEG into a typed array', function(t) {
  var jpegData = fixture('grumpycat.jpg');
  var rawImageData = jpeg.decode(jpegData, true);
  t.equal(rawImageData.width, 320);
  t.equal(rawImageData.height, 180);
  var expected = fixture('grumpycat.rgba');
  t.bufferEqual(rawImageData.data, expected);
  t.assert(rawImageData.data instanceof Uint8Array, 'data is a typed array');
  t.end();
});

it('should be able to decode a JPEG from a typed array into a typed array', function(t) {
  var jpegData = fixture('grumpycat.jpg');
  var rawImageData = jpeg.decode(new Uint8Array(jpegData), true);
  t.equal(rawImageData.width, 320);
  t.equal(rawImageData.height, 180);
  var expected = fixture('grumpycat.rgba');
  t.bufferEqual(rawImageData.data, expected);
  t.assert(rawImageData.data instanceof Uint8Array, 'data is a typed array');
  t.end();
});

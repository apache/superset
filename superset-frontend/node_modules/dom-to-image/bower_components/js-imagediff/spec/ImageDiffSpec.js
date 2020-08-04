var
  //TODO can roll isNode up into a function if checks get longer
  isNode    = typeof module !== 'undefined',
  Canvas    = isNode && require('canvas'),
  imagediff = imagediff || require('../js/imagediff.js');

describe('ImageUtils', function() {

  var
    OBJECT            = 'object',
    TYPE_CANVAS       = isNode ? '[object Canvas]' : '[object HTMLCanvasElement]',
    E_TYPE            = { name : 'ImageTypeError', message : 'Submitted object was not an image.' };

  function getContext () {
    var
      canvas = imagediff.createCanvas(),
      context = canvas.getContext('2d');
    return context;
  }

  function newImage () {
    return isNode ? new Canvas.Image() : new Image();
  }

  function toImageDiffEqual (expected) {

    var
      expectedData = expected.data,
      actualData = this.actual.data;

    this.message = function () {
      var
        length = Math.min(expectedData.length, actualData.length),
        examples = '',
        count = 0,
        i;

      for (i = 0; i < length; i++) {
        if (expectedData[i] !== actualData[i]) {
          count++;
          if (count < 10) {
            examples += (examples ? ', ' : '') + 'Expected '+expectedData[i]+' to equal '+actualData[i]+' at '+i;
          }
        }
      }

      return 'Differed in ' + count + ' places. ' + examples;
    }

    return imagediff.equal(this.actual, expected);
  }

  // Creation Testing
  describe('Creation', function () {

    it('should create a canvas', function () {
      var
        canvas = imagediff.createCanvas();
      expect(typeof canvas).toEqual(OBJECT);
      expect(Object.prototype.toString.apply(canvas)).toEqual(TYPE_CANVAS);
    });

    it('should create a canvas with dimensions', function () {
      var
        canvas = imagediff.createCanvas(10, 20);
      expect(typeof canvas).toEqual(OBJECT);
      expect(Object.prototype.toString.apply(canvas)).toEqual(TYPE_CANVAS);
      expect(canvas.width).toEqual(10);
      expect(canvas.height).toEqual(20);
    });

    it('should create an imagedata object', function () {
      var
        imageData = imagediff.createImageData(10, 10);
      expect(typeof imageData).toEqual(OBJECT);
      expect(imageData.width).toBeDefined();
      expect(imageData.height).toBeDefined();
      expect(imageData.data).toBeDefined();
    });
  });


  // Types Testing
  describe('Types', function () {

    // Checking
    describe('Checking', function () {
      var
        image = newImage(),
        canvas = imagediff.createCanvas(),
        context = canvas.getContext('2d'),
        imageData = context.createImageData(30, 30);

      function testType (type, object) {
        return function () {
          expect(imagediff[type](null)).toEqual(false);
          expect(imagediff[type]('')).toEqual(false);
          expect(imagediff[type]({})).toEqual(false);
          expect(imagediff[type](object)).toEqual(true);
        };
      }

      it('should check Image type',     testType('isImage', image));
      it('should check Canvas type',    testType('isCanvas', canvas));
      it('should check 2DContext type', testType('isContext', context));
      it('should check ImageData type', testType('isImageData', imageData));
      it('should check for any of the image types', function () {
        expect(imagediff.isImageType(null)).toEqual(false);
        expect(imagediff.isImageType('')).toEqual(false);
        expect(imagediff.isImageType({})).toEqual(false);
        expect(imagediff.isImageType(image)).toEqual(true);
        expect(imagediff.isImageType(canvas)).toEqual(true);
        expect(imagediff.isImageType(context)).toEqual(true);
        expect(imagediff.isImageType(imageData)).toEqual(true);
      });
    });

    // Conversion
    describe('Conversion', function () {

      var
        image = newImage(),
        imageData;

      beforeEach(function () {
        this.addMatchers({
          toBeImageData : function () {
            return imagediff.isImageData(this.actual);
          },
          toImageDiffEqual : toImageDiffEqual
        });
      });

      it('should convert Image to ImageData', function () {

        var
          result;

        image.src = 'images/checkmark.png';
        waitsFor(function () {
          return image.complete;
        }, 'image not loaded.', 1000);

        runs(function () {
          var
            canvas = imagediff.createCanvas(image.width, image.height),
            context = canvas.getContext('2d');

          context.drawImage(image, 0, 0);
          imageData = context.getImageData(0, 0, image.width, image.height);

          result = imagediff.toImageData(image);
          expect(result).toBeImageData();
          expect(result).toImageDiffEqual(imageData);
        });
      });

      it('should convert Canvas to ImageData', function () {
        var
          canvas = imagediff.createCanvas(),
          context = canvas.getContext('2d'),
          result;

        canvas.height = image.height;
        canvas.width = image.width;
        context.drawImage(image, 0, 0);

        result = imagediff.toImageData(canvas);

        expect(result).toBeImageData();
        expect(result).toImageDiffEqual(imageData);
      });

      it('should convert Context to ImageData', function () {
        var
          canvas = imagediff.createCanvas(),
          context = canvas.getContext('2d'),
          result = imagediff.toImageData(context);
        expect(result).toBeImageData();
      });

      it('should copy ImageData to new ImageData', function () {
        result = imagediff.toImageData(imageData);
        expect(result).toBeImageData();
        expect(result).toImageDiffEqual(imageData);
        expect(imageData !== result).toBeTruthy();
      });

      it('should fail on non-ImageType', function () {
        expect(function () { imagediff.toImageData() }).toThrow(E_TYPE);
        expect(function () { imagediff.toImageData('') }).toThrow(E_TYPE);
        expect(function () { imagediff.toImageData({}) }).toThrow(E_TYPE);
      });
    });
  });


  // Equals Testing
  describe('Equals', function () {

    var context, a, b;

    beforeEach(function () {
      context = getContext();
      a = context.createImageData(2, 2);
    });

    it('should not be equal for equal ImageData', function () {
      b = context.createImageData(2, 2);
      expect(imagediff.equal(a, b)).toEqual(true);
    });

    it('should not be equal when one ImageData is of different width', function () {
      b = context.createImageData(3, 2);
      expect(imagediff.equal(a, b)).toEqual(false);
      expect(imagediff.equal(b, a)).toEqual(false);
    });

    it('should not be equal when one ImageData is of different height', function () {
      b = context.createImageData(2, 3);
      expect(imagediff.equal(a, b)).toEqual(false);
      expect(imagediff.equal(b, a)).toEqual(false);
    });

    it('should not be equal when one ImageData data array differs', function () {
      b = context.createImageData(2, 2);
      b.data[0] = 100;
      expect(imagediff.equal(a, b)).toEqual(false);
    });

    it('should be equal within optional tolerance', function () {
      b = context.createImageData(2, 2);
      b.data[0] = 100;
      expect(imagediff.equal(a, b, 101)).toEqual(true);
    });

    it('should be equal optional tolerance', function () {
      b = context.createImageData(2, 2);
      b.data[0] = 100;
      expect(imagediff.equal(a, b, 100)).toEqual(true);
    });

    it('should not be equal outside tolerance', function () {
      b = context.createImageData(2, 2);
      b.data[0] = 100;
      expect(imagediff.equal(a, b, 5)).toEqual(false);
    });
  });


  // Diff Testing
  describe('Diff', function () {

    var a, b, c, d;

    beforeEach(function () {
      this.addMatchers({
        toImageDiffEqual : toImageDiffEqual
      });
    });

    describe('Geometry', function () {

      it('should be square, 1x1', function () {
        a = imagediff.createImageData(1, 1),
        b = imagediff.createImageData(1, 1),
        c = imagediff.diff(a, b);

        expect(c.width).toEqual(1);
        expect(c.height).toEqual(1);
      });

      it('should be square, 2x2', function () {
        a = imagediff.createImageData(1, 2),
        b = imagediff.createImageData(2, 1),
        c = imagediff.diff(a, b);

        expect(c.width).toEqual(2);
        expect(c.height).toEqual(2);
      });

      it('should be rectangular, 1x2', function () {
        a = imagediff.createImageData(1, 2),
        b = imagediff.createImageData(1, 1),
        c = imagediff.diff(a, b);

        expect(c.width).toEqual(1);
        expect(c.height).toEqual(2);
      });

      it('should be rectangular, 2x1', function () {
        a = imagediff.createImageData(2, 1),
        b = imagediff.createImageData(1, 1),
        c = imagediff.diff(a, b);

        expect(c.width).toEqual(2);
        expect(c.height).toEqual(1);
      });
    });

    describe('Difference', function () {

      it('should be black', function () {
        a = imagediff.createImageData(1, 1),
        b = imagediff.createImageData(1, 1),
        c = imagediff.diff(a, b);

        d = imagediff.createImageData(1, 1);
        d.data[3] = 255;

        expect(c).toImageDiffEqual(d);
      });

      it('should calculate difference', function () {
        a = imagediff.createImageData(1, 1),
        a.data[1] = 200;
        b = imagediff.createImageData(1, 1),
        b.data[1] = 158;
        c = imagediff.diff(a, b);

        d = imagediff.createImageData(1, 1);
        d.data[1] = 42;
        d.data[3] = 255;

        expect(c).toImageDiffEqual(d);
      });

      it('should center images of unequal size', function () {
        a = imagediff.createImageData(3, 3),
        b = imagediff.createImageData(1, 1),
        b.data[1] = 21;
        c = imagediff.diff(a, b);

        d = imagediff.createImageData(3, 3);
        // 4 * (rowPos * imageWidth + columnPos) + rgbPos
        d.data[4 * (1 * 3 + 1) + 1] = 21;
        // set alpha
        Array.prototype.forEach.call(d.data, function (value, i) {
          if (i % 4 === 3) {
            d.data[i] = 255;
          }
        });

        expect(c).toImageDiffEqual(d);
      });

      it('should optionally align images top left for unequal size', function () {
        a = imagediff.createImageData(3, 3),
        b = imagediff.createImageData(1, 1),
        b.data[1] = 21;
        c = imagediff.diff(a, b, {align: 'top'});

        d = imagediff.createImageData(3, 3);
        d.data[1] = 21;
        // set alpha
        Array.prototype.forEach.call(d.data, function (value, i) {
          if (i % 4 === 3) {
            d.data[i] = 255;
          }
        });

        expect(c).toImageDiffEqual(d);
      });
    });

    /*
    var
      a = imagediff.createImageData(1, 3),
      b = imagediff.createImageData(3, 1),
      c, d;

    a.data[0] = 255;
    a.data[3] = 255;
    a.data[4] = 255;
    a.data[7] = 255;
    a.data[8] = 255;
    a.data[11] = 255;

    b.data[0] = 255;
    b.data[3] = 255;
    b.data[4] = 255;
    b.data[7] = 255;
    b.data[8] = 255;
    b.data[11] = 255;
    */
  });


  // Jasmine Matcher Testing
  describe("jasmine.Matchers", function() {

    var
      imageA = newImage(),
      imageB = newImage(),
      imageC = newImage(),
      env, spec;

    imageA.src = 'images/xmark.png';
    imageB.src = 'images/xmark.png';
    imageC.src = 'images/checkmark.png';

    beforeEach(function() {
      env = new jasmine.Env();
      env.updateInterval = 0;

      var suite = env.describe("suite", function() {
        spec = env.it("spec", function() {
        });
      });
      spyOn(spec, 'addMatcherResult');

      spec.addMatchers(imagediff.jasmine);
      this.addMatchers({
        toPass: function() {
          return lastResult().passed();
        },
        toFail: function() {
          return !lastResult().passed();
        }
      });
    });

    function match(value) {
      return spec.expect(value);
    }

    function lastResult() {
      return spec.addMatcherResult.mostRecentCall.args[0];
    }

    it('toBeImageData', function () {
      var a = imagediff.createImageData(1, 1),
          b = {};
      expect(match(a).toBeImageData()).toPass();
      expect(match(b).toBeImageData()).toFail();
    });

    it('toImageDiffEqual with images', function () {

      waitsFor(function () {
        return imageA.complete && imageB.complete && imageC.complete;
      }, 'image not loaded.', 2000);

      runs(function () {
        expect(match(imageA).toImageDiffEqual(imageB)).toPass();
        expect(match(imageA).toImageDiffEqual(imageC)).toFail();
        expect(function () {
          match(imageA).toImageDiffEqual({});
        }).toThrow(E_TYPE);
      });
    });

    it('toImageDiffEqual with contexts (not a DOM element)', function () {
      var
        a = imagediff.createCanvas(imageA.width, imageA.height).getContext('2d'),
        b = imagediff.createCanvas(imageB.width, imageB.height).getContext('2d'),
        c = imagediff.createCanvas(imageC.width, imageC.height).getContext('2d');

      a.drawImage(imageA, 0, 0);
      b.drawImage(imageB, 0, 0);
      c.drawImage(imageC, 0, 0);

      expect(match(a).toImageDiffEqual(b)).toPass();
      expect(match(a).toImageDiffEqual(c)).toFail();
      expect(function () {
        match(a).toImageDiffEqual({});
      }).toThrow(E_TYPE);
    });
  });

  // Image Output
  describe('Image Output', function () {

    if (!isNode) { return; }

    var
      output = 'images/spec_output.png';

    beforeEach(function () {
      this.addMatchers(imagediff.jasmine)
    });

    afterEach(function () {
      require('fs').unlink(output);
    });

    it('saves an image as a PNG', function () {

      var
        image = newImage(),
        canvas = imagediff.createCanvas(10, 10),
        context = canvas.getContext('2d'),
        a, b;

      context.moveTo(0, 0);
      context.lineTo(10, 10);
      context.strokeStyle = 'rgba(150, 150, 150, .5)';
      context.stroke();
      a = context.getImageData(0, 0, 10, 10);

      imagediff.imageDataToPNG(a, output, function () {
        image.src = output;
      });

      waitsFor(function () {
        return image.complete;
      }, 'image not loaded.', 2000);

      runs(function () {
        b = imagediff.toImageData(image);
        expect(b).toBeImageData();
        expect(canvas).toImageDiffEqual(b, 10);
      });
    });
  });


  // Compatibility Testing
  describe('Compatibility', function () {

    var
      fn = Function,
      global = (fn('return this;')()), // Get the global object
      that = imagediff,
      reference;

    afterEach(function () {
      global.imagediff = that;
    });

    it('should remove imagediff from global space', function () {
      imagediff.noConflict();
      if (!isNode) {
        expect(imagediff === that).toEqual(false);
        expect(global.imagediff === that).toEqual(false);
      }
    });

    it('should return imagediff', function () {
      reference = imagediff.noConflict();
      expect(reference === that).toEqual(true);
    });

  });
});

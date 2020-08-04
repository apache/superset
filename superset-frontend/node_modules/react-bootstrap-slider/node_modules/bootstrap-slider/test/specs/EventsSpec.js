describe("Event Tests", function() {
  var testSlider, flag, mouse;

  beforeEach(function() {
    flag = false;
    mouse = document.createEvent('MouseEvents');
  });

  describe("JQuery version", function() {
    beforeEach(function() {
      testSlider = $("#testSlider2").slider({
        value: 1
      });
    });

    afterEach(function() {
      if(testSlider) {
        testSlider.slider('destroy');
        testSlider = null;
      }
    });

    describe("Mouse Events", function() {

      it("'slideStart' event is triggered properly and can be binded to", function() {
        testSlider.on('slideStart', function() {
          flag = true;
        });
        testSlider.data('slider')._mousedown(mouse);
        expect(flag).toBeTruthy();
      });

      it("'slide' event is triggered properly and can be binded to", function() {
        testSlider.on('slide', function() {
          flag = true;
        });
        testSlider.data('slider')._mousemove(mouse);
        expect(flag).toBeTruthy();
      });

      it("'slide' event sets the right value on the input", function() {
        testSlider.on('slide', function() {
          flag = true;
          expect(isNaN(testSlider.val())).not.toBeTruthy();
        });
        testSlider.data('slider')._mousemove(mouse);
        expect(flag).toBeTruthy();
      });

      it("'slide' event value and input value properties are synchronous", function() {
        testSlider.on('slide', function(e) {
          flag = true;
          expect(e.value.toString()).toEqual(this.value);
        });
        testSlider.slider("setValue", 3, true, false);

        expect(flag).toBeTruthy();
      });

      it("'change' event value and input value properties are synchronous", function() {
        testSlider.on('change', function(e) {
          flag = true;
          expect(e.value.newValue.toString()).toEqual(testSlider.val());
        });
        testSlider.slider("setValue", 3, false, true);

        expect(flag).toBeTruthy();
      });

      it("'slideStop' event is triggered properly and can be binded to", function() {
        testSlider.on('slideStop', function() {
          flag = true;
        });
        testSlider.data('slider')._mouseup(mouse);
        expect(flag).toBeTruthy();
      });

      it("slider should not have duplicate events after calling 'refresh'", function() {
        flag = 0;
        testSlider.on('slideStop', function() {
          flag += 1;
        });
        testSlider.slider('refresh');
        testSlider.data('slider')._mouseup();
        expect(flag).toEqual(1);
      });

      describe("Disabled Slider Event Tests", function() {
        beforeEach(function() {
          testSlider.slider('disable');
        });

        it("should not trigger 'slideStart' event when disabled", function() {
          testSlider.on('slideStart', function() {
            flag = true;
          });
          testSlider.data('slider')._mousedown(mouse);
          expect(flag).not.toBeTruthy();
        });

        it("should not trigger 'slide' event when disabled", function() {
          testSlider.on('slide', function() {
            flag = true;
          });
          testSlider.data('slider')._mousemove(mouse);
          expect(flag).not.toBeTruthy();
        });

        it("should not trigger 'slideStop' event when disabled", function() {
          testSlider.on('slideStop', function() {
            flag = true;
          });
          testSlider.data('slider')._mouseup();
          expect(flag).not.toBeTruthy();
        });
      });

    });

    describe("Touch Events", function() {
      var touch;

      beforeEach(function() {
        touch = document.createEvent('Event');
        var dummyTouchEvent = document.createEvent('MouseEvents');
        touch.touches = [dummyTouchEvent];
        window.ontouchstart = true;
      });

      afterEach(function() {
        window.ontouchstart = null;
      });

      it("'slideStart' event is triggered properly and can be binded to", function() {
        touch.initEvent("touchstart");

        testSlider.on('slideStart', function() {
          flag = true;
        });
        testSlider.data('slider')._mousedown(touch);

        expect(flag).toBeTruthy();
      });

      it("'slide' event is triggered properly and can be binded to", function() {
        touch.initEvent("touchmove");

        testSlider.on('slide', function() {
          flag = true;
        });
        testSlider.data('slider')._mousemove(touch);

        expect(flag).toBeTruthy();
      });

      it("'slide' event sets the right value on the input", function() {
        touch.initEvent("touchmove");

        testSlider.on('slide', function() {
          flag = true;
          expect(isNaN(testSlider.val())).not.toBeTruthy();
        });
        testSlider.data('slider')._mousemove(touch);

        expect(flag).toBeTruthy();
      });

      it("'slide' event value and input value properties are synchronous", function() {
        touch.initEvent("touchmove");

        testSlider.on('slide', function(e) {
          flag = true;
          expect(e.value.toString()).toEqual(testSlider.val());
        });
        testSlider.slider("setValue", 3, true, false);

        expect(flag).toBeTruthy();
      });

      it("'change' event value and input value properties are synchronous", function() {
        touch.initEvent("touchmove");

        testSlider.on('change', function(e) {
          flag = true;
          expect(e.value.newValue.toString()).toEqual(testSlider.val());
        });
        testSlider.slider("setValue", 3, false, true);

        expect(flag).toBeTruthy();
      });

      it("'slideStop' event is triggered properly and can be binded to", function() {
        touch.initEvent("touchstop");

        testSlider.on('slideStop', function() {
          flag = true;
        });
        testSlider.data('slider')._mouseup();

        expect(flag).toBeTruthy();
      });


      it("slider should not have duplicate events after calling 'refresh'", function() {
        touch.initEvent("touchstop");
        flag = 0;

        testSlider.on('slideStop', function() {
          flag += 1;
        });
        testSlider.slider('refresh');
        testSlider.data('slider')._mouseup();

        expect(flag).toEqual(1);
      });

      it("slider should not bind multiple touchstart events after calling 'refresh'", function() {
        touch.initEvent("touchstart", true, true);
        flag = 0;

        testSlider.on('slideStart', function() {
          flag += 1;
        });
        testSlider.slider('refresh');
        $('.slider .slider-handle').get(0).dispatchEvent(touch);

        expect(flag).toEqual(1);
      });

      describe("Disabled Slider Event Tests", function() {
        beforeEach(function() {
          testSlider.slider('disable');
        });

        it("should not trigger 'slideStart' event when disabled", function() {
          touch.initEvent("touchstart");

          testSlider.on('slideStart', function() {
            flag = true;
          });
          testSlider.data('slider')._mousedown(touch);

          expect(flag).not.toBeTruthy();
        });

        it("should not trigger 'slide' event when disabled", function() {
          touch.initEvent("touchmove");

          testSlider.on('slide', function() {
            flag = true;
          });
          testSlider.data('slider')._mousemove(touch);

          expect(flag).not.toBeTruthy();
        });

        it("should not trigger 'slideStop' event when disabled", function() {
          touch.initEvent("touchend");

          testSlider.on('slideStop', function() {
            flag = true;
          });
          testSlider.data('slider')._mouseup();

          expect(flag).not.toBeTruthy();
        });
      });

    });

    describe("Enabled/Disabled tests", function() {
      it("'slideDisabled' event is triggered properly and can be binded to", function() {
        testSlider.on('slideDisabled', function() {
          flag = true;
        });
        testSlider.slider('disable');
        expect(flag).toBeTruthy();
      });

      it("'slideDisabled' event is triggered properly and can be binded to", function() {
          testSlider.on('slideEnabled', function() {
            flag = true;
          });
          testSlider.slider('disable');
          testSlider.slider('enable');
          expect(flag).toBeTruthy();
      });

      it("'change' event is triggered properly and can be binded to", function() {
        testSlider.on('change', function() {
          flag = true;
        });
        testSlider.slider("setValue", 3, false, true);
        expect(flag).toBeTruthy();
      });
    });

  }); // End of JQuery version tests

  describe("CommonJS version", function() {
    describe("Event repetition tests", function() {
      var testSlider, numTimesFired;

      beforeEach(function() {
        testSlider = new Slider("#testSlider2");
        numTimesFired = 0;
      });

      afterEach(function() {
        testSlider.destroy();
      });

      it("'slide' event is triggered only once per slide action", function() {
        testSlider.on('slide', function() {
          numTimesFired++;
        });
        testSlider._mousemove(mouse);
        expect(numTimesFired).toEqual(1);
      });

      it("'slideStart' event is triggered only once per slide action", function() {
        testSlider.on('slideStart', function() {
          numTimesFired++;
        });
        testSlider._mousedown(mouse);
        expect(numTimesFired).toEqual(1);
      });

      it("'slideStop' event is triggered only once per slide action", function() {
        testSlider.on('slideStop', function() {
          numTimesFired++;
        });
        testSlider._mouseup(mouse);
        expect(numTimesFired).toEqual(1);
      });

      it("'change' event is triggered only once per value change action", function() {
        testSlider.on('change', function() {
          numTimesFired++;
        });
        testSlider.setValue(3, false, true);
        expect(numTimesFired).toEqual(1);
      });
    });
  }); // End of common JS tests

}); // End of spec

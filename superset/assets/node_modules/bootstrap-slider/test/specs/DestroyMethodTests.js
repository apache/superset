describe("'destroy()' Method tests", function() {
  var testSlider;
  
  function createSliderFn() {
    testSlider = new Slider("#testSlider1", {
      id: "destroyMethodTestSlider"
    });
  }

  it("removes the extra DOM elements associated with a slider", function() {

    createSliderFn();

    testSlider.destroy();

    var sliderParentElement = $("#testSlider1").parent('div.slider').length;
    var sliderChildrenElements = $("#testSlider1").siblings('div.slider-track, div.tooltip').length;

    expect(sliderParentElement).toBe(0);
    expect(sliderChildrenElements).toBe(0);
  });

  describe("unbinds all slider events", function() {
    var flag, evtName;

    beforeEach(function() {
      createSliderFn();
      flag = false;
    });

    it("unbinds from 'slideStart' event", function() {
      evtName = 'slideStart';
      $("#destroyMethodTestSlider").on(evtName, function() {
        flag = true;
      });
      testSlider.destroy();
      $("#destroyMethodTestSlider").trigger(evtName);
      expect(flag).toBeFalsy();
    });

    it("unbinds from 'slide' event", function() {
      evtName = 'slide';
      $("#destroyMethodTestSlider").on(evtName, function() {
        flag = true;
      });
      testSlider.destroy();
      $("#destroyMethodTestSlider").trigger(evtName);
      expect(flag).toBeFalsy();
    });

    it("unbinds from 'slideStop' event", function() {
      evtName = 'slideStop';
      $("#destroyMethodTestSlider").on(evtName, function() {
        flag = true;
      });
      testSlider.destroy();
      $("#destroyMethodTestSlider").trigger(evtName);
      expect(flag).toBeFalsy();
    });

    it("unbinds from 'slideChange' event", function() {
      evtName = 'slideChange';
      $("#destroyMethodTestSlider").on(evtName, function() {
        flag = true;
      });
      testSlider.destroy();
      $("#destroyMethodTestSlider").trigger(evtName);
      expect(flag).toBeFalsy();
    });

    it("unbinds all slider events and allows you to re-create the slider without runtime error", function() {
      // Setup
      var createSliderAndBindEvent = function () {
        $("#testSlider1").bootstrapSlider({
          min: 0,
          max: 1000 * 1000,
          step: 1000
        });
        testSlider = $("#testSlider1").data("bootstrapSlider");
        testSlider.on("slideStop", function() {});
      };
      // Destroy existing slider from default bootstrap step
      testSlider.destroy();

      // Create new Slider
      createSliderAndBindEvent();

      // Destroy slider
      testSlider.destroy();

      // Re-create Slider and try to re-bind event
      var throwsRuntimeError = false;
      
      try {
        createSliderAndBindEvent();
      }
      catch (e) {
        throwsRuntimeError = true;
      }

      // reCreateSliderAndBindEvent(): Assert error is not thrown
      expect(throwsRuntimeError).toBeFalsy();
    });
  });

  describe("DOM event listener removal tests", function() {
    describe("When tooltips are always hidden for single value sliders", function() {
      beforeEach(function() {
        // Create slider
        testSlider = new Slider("#testSlider1", {
          id: "destroyMethodTestSlider",
          tooltip: "hide"
        });
      });

      it("does not try to remove 'focus' event listener from handle1", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.handle1, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.handle1.removeEventListener).not.toHaveBeenCalledWith("focus", undefined, false);
      });

      it("does not try to remove 'blur' event listener from handle1", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.handle1, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.handle1.removeEventListener).not.toHaveBeenCalledWith("blur", undefined, false);
      });

      it("does not try to remove 'mouseenter' event listener from slider", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.sliderElem, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.sliderElem.removeEventListener).not.toHaveBeenCalledWith("mouseenter", undefined, false);
      });

      it("does not try to remove 'mouseleave' event listener from slider", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.sliderElem, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.sliderElem.removeEventListener).not.toHaveBeenCalledWith("mouseleave", undefined, false);
      });
    });

    describe("When tooltips are always shown for single value sliders", function() {
      beforeEach(function() {
        // Create slider
        testSlider = new Slider("#testSlider1", {
          id: "destroyMethodTestSlider",
          tooltip: "always"
        });
      });

      it("does not try to remove 'focus' event listener from handle1 when tooltip is always shown for single handle sliders", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.handle1, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.handle1.removeEventListener).not.toHaveBeenCalledWith("focus", undefined, false);
      });

      it("does not try to remove 'blur' event listener from handle1 when tooltip is always shown for single handle sliders", function() {
          // Set up spy on 'removeEventListener'
          spyOn(testSlider.handle1, "removeEventListener");

          // Destroy slider
          testSlider.destroy();

          // Assert
          expect(testSlider.handle1.removeEventListener).not.toHaveBeenCalledWith("blur", undefined, false);
      });

      it("does not try to remove 'mouseenter' event listener from slider is always shown for single handle slider", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.handle1, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.handle1.removeEventListener).not.toHaveBeenCalledWith("mouseenter", undefined, false);
      });

      it("does not try to remove 'mouseleave' event listener from slider is always shown for single handle slider", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.sliderElem, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.sliderElem.removeEventListener).not.toHaveBeenCalledWith("mouseleave", undefined, false);
      });
    });

    describe("When tooltips are always hidden for range sliders", function() {
      beforeEach(function() {
        // Create slider
        testSlider = new Slider("#testSlider1", {
          id: "destroyMethodTestSlider",
          tooltip: "always",
          value: [2,5]
        });
      });

      it("does not try to remove 'focus' event listener from handle1", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.handle1, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.handle1.removeEventListener).not.toHaveBeenCalledWith("focus", undefined, false);
      });

      it("does not try to remove 'focus' event listener from handle2", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.handle2, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.handle2.removeEventListener).not.toHaveBeenCalledWith("focus", undefined, false);
      });

      it("does not try to remove 'blur' event listener from handle1", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.handle1, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.handle1.removeEventListener).not.toHaveBeenCalledWith("blur", undefined, false);
      });

      it("does not try to remove 'blur' event listener from handle2", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.handle2, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.handle2.removeEventListener).not.toHaveBeenCalledWith("blur", undefined, false);
      });

      it("does not try to remove 'mouseenter' event listener from slider", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.sliderElem, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.sliderElem.removeEventListener).not.toHaveBeenCalledWith("mouseenter", undefined, false);
      });

      it("does not try to remove 'mouseleave' event listener from slider", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.sliderElem, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.sliderElem.removeEventListener).not.toHaveBeenCalledWith("mouseleave", undefined, false);
      });
    });

    describe("When tooltips are always shown for range sliders", function() {
      beforeEach(function() {
        // Create slider
        testSlider = new Slider("#testSlider1", {
          id: "destroyMethodTestSlider",
          tooltip: "always",
          value: [2,5]
        });
      });

      it("does not try to remove 'focus' event listener from handle1", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.handle1, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.handle1.removeEventListener).not.toHaveBeenCalledWith("focus", undefined, false);
      });
      
      it("does not try to remove 'focus' event listener from handle2", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.handle2, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.handle2.removeEventListener).not.toHaveBeenCalledWith("focus", undefined, false);
      });

      it("does not try to remove 'blur' event listener from handle1", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.handle1, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.handle1.removeEventListener).not.toHaveBeenCalledWith("blur", undefined, false);
      });
      
       it("does not try to remove 'blur' event listener from handle1 and handle2", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.handle2, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.handle2.removeEventListener).not.toHaveBeenCalledWith("blur", undefined, false);
      });

      it("does not try to remove 'mouseenter' event listener from slider", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.sliderElem, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.sliderElem.removeEventListener).not.toHaveBeenCalledWith("mouseenter", undefined, false);
      });

      it("does not try to remove 'mouseleave' event listener from slider", function() {
        // Set up spy on 'removeEventListener'
        spyOn(testSlider.sliderElem, "removeEventListener");

        // Destroy slider
        testSlider.destroy();

        // Assert
        expect(testSlider.sliderElem.removeEventListener).not.toHaveBeenCalledWith("mouseleave", undefined, false);
      });
    });
  });

});
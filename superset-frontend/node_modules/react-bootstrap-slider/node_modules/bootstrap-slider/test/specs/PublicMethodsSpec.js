describe("Public Method Tests", function() {
  var testSlider;

  describe("slider constructor", function() {
    it("reads and sets the 'id' attribute of the slider instance that is created", function() {
      var sliderId = "mySlider";

      testSlider = $("#testSlider1").slider({
        id : sliderId
      });

      var sliderInstanceHasExpectedId = $("#testSlider1").siblings("div.slider").is("#" + sliderId);
      expect(sliderInstanceHasExpectedId).toBeTruthy();
    });

    it("generates multiple slider instances from selector", function() {

      $(".makeSlider").slider();

      var sliderInstancesExists = $(".makeSlider").siblings().is(".slider");
      expect(sliderInstancesExists).toBeTruthy();

      var sliderInstancesCount = $(".makeSlider").siblings(".slider").length;
      expect(sliderInstancesCount).toEqual(2);
    });

    it("reads and sets the 'min' option properly", function() {
      var minVal = -5;

      testSlider = $("#testSlider1").slider({
        min : minVal
      });
      testSlider.slider('setValue', minVal);

      var sliderValue = testSlider.slider('getValue');
      expect(sliderValue).toBe(minVal);
    });

    it("reads and sets the 'max' option properly", function() {
      var maxVal = 15;

      testSlider = $("#testSlider1").slider({
        max : maxVal
      });
      testSlider.slider('setValue', maxVal);

      var sliderValue = testSlider.slider('getValue');
      expect(sliderValue).toBe(maxVal);
    });

    it("reads and sets the 'precision' option properly", function() {
      testSlider = $("#testSlider1").slider({
        precision: 2
      });
      testSlider.slider('setValue', 8.115);

      var sliderValue = testSlider.slider('getValue');
      expect(sliderValue).toBe(8.12);
    });

    it("reads and sets the 'orientation' option properly", function() {
      var orientationVal = "vertical";

      testSlider = $("#testSlider1").slider({
        orientation : orientationVal
      });

      var orientationClassApplied = $("#testSlider1").siblings("div.slider").hasClass("slider-vertical");
      expect(orientationClassApplied).toBeTruthy();
    });

    it("reads and sets the 'value' option properly", function() {
      var val = 8;

      testSlider = $("#testSlider1").slider({
        value : val
      });
      testSlider.slider('setValue', val);

      var sliderValue = testSlider.slider('getValue');
      expect(sliderValue).toBe(val);
    });

    it("reads and sets the 'selection' option properly", function() {
      var selectionVal = "after",
          maxSliderVal = 10;

      testSlider = $("#testSlider1").slider({
        selection : selectionVal
      });
      testSlider.slider('setValue', maxSliderVal);

      var sliderSelectionWidthAtMaxValue = $("#testSlider1").siblings(".slider").children("div.slider-track").children("div.slider-selection").width();
      expect(sliderSelectionWidthAtMaxValue).toBe(0);
    });

    it("updates the 'selection' option properly", function() {
      var selectionVal = "none",
          maxSliderVal = 10;

      testSlider = $("#testSlider1").slider({
        selection : selectionVal
      });
      testSlider.slider('setValue', maxSliderVal);
      testSlider.slider('refresh');

      var sliderSelectionHasHideClass_A = $("#testSlider1").siblings(".slider").children("div.slider-track").children("div.slider-track-low").hasClass('hide');
      expect(sliderSelectionHasHideClass_A).toBe(true);
      var sliderSelectionHasHideClass_B = $("#testSlider1").siblings(".slider").children("div.slider-track").children("div.slider-selection").hasClass('hide');
      expect(sliderSelectionHasHideClass_B).toBe(true);
      var sliderSelectionHasHideClass_C = $("#testSlider1").siblings(".slider").children("div.slider-track").children("div.slider-track-high").hasClass('hide');
      expect(sliderSelectionHasHideClass_C).toBe(true);

      var newSelectionVal = 'after';
      testSlider.slider('setAttribute', 'selection', newSelectionVal);
      testSlider.slider('refresh');

      var sliderSelectionHasHideClass_D = $("#testSlider1").siblings(".slider").children("div.slider-track").children("div.slider-track-low").hasClass('hide');
      expect(sliderSelectionHasHideClass_D).toBe(false);
      var sliderSelectionHasHideClass_E = $("#testSlider1").siblings(".slider").children("div.slider-track").children("div.slider-selection").hasClass('hide');
      expect(sliderSelectionHasHideClass_E).toBe(false);
      var sliderSelectionHasHideClass_F = $("#testSlider1").siblings(".slider").children("div.slider-track").children("div.slider-track-high").hasClass('hide');
      expect(sliderSelectionHasHideClass_F).toBe(false);
    });
    it("reads and sets the 'handle' option properly", function() {
      var handleVal = "triangle";

      testSlider = $("#testSlider1").slider({
        handle : handleVal
      });

      var handleIsSetToTriangle = $("#testSlider1").siblings(".slider").children("div.slider-handle").hasClass("triangle");
      expect(handleIsSetToTriangle).toBeTruthy();
    });

    it("reads and sets the 'reversed' option properly", function() {
      var reversedVal = true,
          maxSliderVal = 10;

      testSlider = $("#testSlider1").slider({
        reversed : reversedVal
      });
      testSlider.slider('setValue', maxSliderVal);

      var sliderSelectionHeightAtMaxValue = $("#testSlider1").siblings(".slider").children("div.slider-track").children("div.slider-selection").width();
      expect(sliderSelectionHeightAtMaxValue).toBe(0);
    });

    /* TODO: Fix this test! It keeps throwing a weird bug where is says '955' instead of '9' for the value */
    // it("reads and sets the 'formatter' option properly", function() {
    //   var tooltipFormatter = function(value) {
    //     return 'Current value: ' + value;
    //   };

    //   testSlider = $("#testSlider1").slider({
    //     formatter : tooltipFormatter
    //   });
    //   testSlider.slider('setValue', 9);

    //   var tooltipMessage = $("#testSlider1").siblings(".slider").find("div.tooltip").children("div.tooltip-inner").text();
    //   var expectedMessage = tooltipFormatter(9);
    //   expect(tooltipMessage).toBe(expectedMessage);
    // });

    it("reads and sets the 'enabled' option properly", function() {
      testSlider = $("#testSlider1").slider({
        enabled: false
      });
      var isEnabled = testSlider.slider('isEnabled');
      expect(isEnabled).not.toBeTruthy();
    });

    describe("reads and sets the 'tooltip' option properly", function() {
      it("tooltip is not shown if set to 'hide'", function() {
        testSlider = $("#testSlider1").slider({
          tooltip : "hide"
        });

        var tooltipIsHidden = testSlider.siblings(".slider").children("div.tooltip").hasClass("hide");
        expect(tooltipIsHidden).toBeTruthy();
      });

      it("tooltip is shown during sliding if set to 'show'", function() {
        testSlider = $("#testSlider1").slider({
          tooltip : "show"
        });

        var tooltipIsHidden = !($("#testSlider1").siblings(".slider").children("div.tooltip").hasClass("in"));
        expect(tooltipIsHidden).toBeTruthy();

        // Trigger hover
        var mouseenterEvent = document.createEvent("Events");
        mouseenterEvent.initEvent("mouseenter", true, true);
        testSlider.data('slider').sliderElem.dispatchEvent(mouseenterEvent);

        var tooltipIsShownAfterSlide = $("#testSlider1").siblings(".slider").children("div.tooltip").hasClass("in");
        expect(tooltipIsShownAfterSlide).toBeTruthy();
      });

      it("tooltip is shown on mouse over and hides correctly after mouse leave", function() {
        testSlider = $("#testSlider1").slider({
          tooltip : "show"
        });

        var tooltipIsHidden = !($("#testSlider1").siblings(".slider").children("div.tooltip").hasClass("in"));
        expect(tooltipIsHidden).toBeTruthy();

        // Trigger hover
        var mouseenterEvent = document.createEvent("Events");
        mouseenterEvent.initEvent("mouseenter", true, true);
        testSlider.data('slider').sliderElem.dispatchEvent(mouseenterEvent);

        var tooltipIsShownAfterSlide = $("#testSlider1").siblings(".slider").children("div.tooltip").hasClass("in");
        expect(tooltipIsShownAfterSlide).toBeTruthy();


        // Trigger leave
        var mouseleaveEvent = document.createEvent("Events");
        mouseleaveEvent.initEvent("mouseleave", true, true);
        testSlider.data('slider').sliderElem.dispatchEvent(mouseleaveEvent);

        var tooltipIsAgainHidden = !($("#testSlider1").siblings(".slider").children("div.tooltip").hasClass("in"));
        expect(tooltipIsAgainHidden).toBeTruthy();
      });

      it("tooltip is always shown if set to 'always'", function() {
        testSlider = $("#testSlider1").slider({
          tooltip : "always"
        });

        var tooltipIsShown = $("#testSlider1").siblings(".slider").children("div.tooltip").hasClass("in");
        expect(tooltipIsShown).toBeTruthy();
      });

      it("defaults to 'show' option if invalid value is passed", function() {
        testSlider = $("#testSlider1").slider({
          tooltip : "invalid option value"
        });

        var tooltipIsHidden = !($("#testSlider1").siblings(".slider").children("div.tooltip").hasClass("in"));
        expect(tooltipIsHidden).toBeTruthy();

        // Trigger hover
        var mouseenterEvent = document.createEvent("Events");
        mouseenterEvent.initEvent("mouseenter", true, true);
        testSlider.data('slider').sliderElem.dispatchEvent(mouseenterEvent);


        var tooltipIsShownOnHover = $("#testSlider1").siblings(".slider").children("div.tooltip").hasClass("in");
        expect(tooltipIsShownOnHover).toBeTruthy();
      });
    });
  });


  describe("'setValue()' tests", function() {
    var formatInvalidInputMsg = function(invalidValue) { return "Invalid input value '" + invalidValue + "' passed in"; };

    describe("if slider is a single value slider", function() {
      beforeEach(function() {
        testSlider = $("#testSlider1").slider();
      });

      it("properly sets the value of the slider when given a numeric value", function() {
        var valueToSet = 5;
        testSlider.slider('setValue', valueToSet);

        var sliderValue = testSlider.slider('getValue');
        expect(sliderValue).toBe(valueToSet);
      });

      it("properly sets the value of the slider when given a string value", function(){
        var valueToSet = "5";
        testSlider.slider('setValue', valueToSet);

        var sliderValue = testSlider.slider('getValue');
        expect(sliderValue).toBe(5);
      });

      it("if a value passed in is greater than the max (10), the slider only goes to the max", function() {
        var maxValue = 10,
            higherThanSliderMaxVal = maxValue + 5;

        testSlider.slider('setValue', higherThanSliderMaxVal);

        var sliderValue = testSlider.slider('getValue');
        expect(sliderValue).toBe(maxValue);
      });

      it("if a value passed in is less than the min (0), the slider only goes to the min", function() {
        var minValue = 0,
            lowerThanSliderMaxVal = minValue - 5;

        testSlider.slider('setValue', lowerThanSliderMaxVal);

        var sliderValue = testSlider.slider('getValue');
        expect(sliderValue).toBe(minValue);
      });

      it("sets the 'value' property of the slider <input> element", function() {
        var value = 9;
        testSlider.slider('setValue', value);

        var currentValue = document.querySelector("#testSlider1").value;
        currentValue = parseFloat(currentValue);

        expect(currentValue).toBe(value);
      });

       it("sets the 'value' attribute of the slider <input> element", function() {
        var value = 9;
        testSlider.slider('setValue', value);

        var currentValue = document.querySelector("#testSlider1").getAttribute("value");
        currentValue = parseFloat(currentValue);

        expect(currentValue).toBe(value);
      });

      describe("when an invalid value type is passed in", function() {
        var invalidValue;

        beforeEach(function() {
          invalidValue = "a";
        });

        it("throws an error and does not alter the slider value", function() {
          var originalSliderValue = testSlider.slider('getValue');

          var settingValue = function() {
            testSlider.slider('setValue', invalidValue);
          };
          expect(settingValue).toThrow(new Error( formatInvalidInputMsg(invalidValue) ));

          var sliderValue = testSlider.slider('getValue');
          expect(sliderValue).toBe(originalSliderValue);
        });
      });
    });

    describe("if slider is a range slider", function() {
      beforeEach(function() {
        testSlider = $("#testSlider1").slider({
          value : [3, 8]
        });
      });

      it("properly sets the values if both within the max and min", function() {
        var valuesToSet = [5, 7];
        testSlider.slider('setValue', valuesToSet);

        var sliderValues = testSlider.slider('getValue');
        expect(sliderValues[0]).toBe(valuesToSet[0]);
        expect(sliderValues[1]).toBe(valuesToSet[1]);
      });

      describe("caps values to the min if they are set to be less than the min", function() {
        var minValue = -5,
            otherValue = 7;

        it("first value is capped to min", function() {
          testSlider.slider('setValue', [minValue, otherValue]);

          var sliderValues = testSlider.slider('getValue');
          expect(sliderValues[0]).toBe(0);
        });

        it("second value is capped to min", function() {
          testSlider.slider('setValue', [otherValue, minValue]);

          var sliderValues = testSlider.slider('getValue');
          expect(sliderValues[1]).toBe(0);
        });
      });

      describe("caps values to the max if they are set to be higher than the max", function() {
        var maxValue = 15,
            otherValue = 7;

        it("first value is capped to max", function() {
          testSlider.slider('setValue', [maxValue, otherValue]);

          var sliderValues = testSlider.slider('getValue');
          expect(sliderValues[0]).toBe(10);
        });

        it("second value is capped to max", function() {
          testSlider.slider('setValue', [otherValue, maxValue]);

          var sliderValues = testSlider.slider('getValue');
          expect(sliderValues[1]).toBe(10);
        });
      });

      describe("if either value is of invalid type", function() {
        var invalidValue = "a",
            otherValue = 7;

        it("first value is of invalid type", function() {
          var setSliderValueFn = function() {
            testSlider.slider('setValue', [invalidValue, otherValue]);
          };
          expect(setSliderValueFn).toThrow(new Error( formatInvalidInputMsg(invalidValue) ));
        });
        it("second value is of invalid type", function() {
          var setSliderValueFn = function() {
            testSlider.slider('setValue', [otherValue, invalidValue]);
          };
          expect(setSliderValueFn).toThrow(new Error( formatInvalidInputMsg(invalidValue) ));
        });
      });
    });

    describe("triggerSlideEvent argument", function() {
      it("if triggerSlideEvent argument is true, the 'slide' event is triggered", function() {
        var testSlider = $("#testSlider1").slider({
          value : 3
        });

          var newSliderVal = 5;

          testSlider.on('slide', function(evt) {
            expect(newSliderVal).toEqual(evt.value);
          });

        testSlider.slider('setValue', newSliderVal, true);
      });

      it("if triggerSlideEvent argument is false, the 'slide' event is not triggered", function() {
        var newSliderVal = 5;
        var slideEventTriggered = false;
        var testSlider = $("#testSlider1").slider({
          value : 3
        });

        testSlider.on('slide', function() {
          slideEventTriggered = true;
        });
        testSlider.slider('setValue', newSliderVal, false);

        expect(slideEventTriggered).toEqual(false);
      });
    });

    describe("triggerChangeEvent argument", function() {
      it("if triggerChangeEvent argument is true, the 'change' event is triggered", function() {
        var testSlider = $("#testSlider1").slider({
          value : 3
        });

        var newSliderVal = 5;

        testSlider.on('change', function(evt) {
          expect(newSliderVal).toEqual(evt.value.newValue);
        });

        testSlider.slider('setValue', newSliderVal, true);
      });

      it("if triggerChangeEvent argument is false, the 'change' event is not triggered", function() {
        var changeEventTriggered = false;
        var testSlider = $("#testSlider1").slider({
          value : 3
        });

        testSlider.on('change', function() {
          changeEventTriggered = true;
        });
        testSlider.slider('setValue', 5, false);

        expect(changeEventTriggered).toEqual(false);
      });
    });

  });


  describe("'getValue()' tests", function() {
    it("returns the current value of the slider", function() {
      testSlider = $("#testSlider1").slider();

      var valueToSet = 5;
      testSlider.slider('setValue', valueToSet);

      var sliderValue = testSlider.slider('getValue');
      expect(sliderValue).toBe(valueToSet);
    });
  });

  describe("'enable()' tests", function() {
    it("correctly enables a slider", function() {
      testSlider = $("#testSlider1").slider({
        enabled: false
      });
      testSlider.slider("enable");
      var isEnabled = testSlider.slider("isEnabled");
      expect(isEnabled).toBeTruthy();
    });
  });

  describe("'disable()' tests", function() {
    it("correctly disable a slider", function() {
      testSlider = $("#testSlider1").slider();
      testSlider.slider("disable");
      var isEnabled = testSlider.slider("isEnabled");
      expect(isEnabled).not.toBeTruthy();
    });
  });

  describe("'toggle()' tests", function() {
    it("correctly enables a disabled slider", function() {
      testSlider = $("#testSlider1").slider({
        enabled: false
      });
      testSlider.slider("toggle");
      var isEnabled = testSlider.slider("isEnabled");
      expect(isEnabled).toBeTruthy();
    });

    it("correctly disables an enabled slider", function() {
      testSlider = $("#testSlider1").slider();
      testSlider.slider("toggle");
      var isEnabled = testSlider.slider("isEnabled");
      expect(isEnabled).not.toBeTruthy();
    });
  });

  describe("'isEnabled()' tests", function() {
    it("returns true for an enabled slider", function() {
      testSlider = $("#testSlider1").slider({
        id: "enabled",
        enabled: true
      });

      var isEnabled = testSlider.slider("isEnabled");
      var $slider = testSlider.siblings("#enabled");
      var hasDisabledClass = $slider.hasClass("slider") && $slider.hasClass("#enabled");

      expect(isEnabled).toBeTruthy();
      expect(hasDisabledClass).not.toBeTruthy();
    });

    it("returns false for a disabled slider", function() {
      testSlider = $("#testSlider1").slider({
        id: "disabled",
        enabled: false
      });

      var isEnabled = testSlider.slider("isEnabled");
      var $slider = testSlider.siblings("#disabled");
      var hasDisabledClass = $slider.hasClass("slider") && $slider.hasClass("slider-disabled");

      expect(isEnabled).not.toBeTruthy();
      expect(hasDisabledClass).toBeTruthy();
    });
  });

  it("get attribute", function() {
    testSlider = $("#testSlider1").slider();

    var sliderMaxValue = testSlider.slider('getAttribute', 'max');
    expect(sliderMaxValue).toBe(10);
  });

  it("changes slider from basic to range", function() {
    testSlider = $("#makeRangeSlider").slider();
    testSlider.slider('setAttribute', 'range', true).slider('refresh');

    var isRangeSlider = $("#changeOrientationSlider").parent("div.slider").find('.slider-handle').last().hasClass('hide');
    expect(isRangeSlider).toBeFalsy();
  });

  it("setAttribute: changes the 'data-slider-orientation' property from horizontal to vertical", function() {
    testSlider = $("#changeOrientationSlider").slider({
      id: "changeOrientationSliderElem"
    });
    testSlider.slider('setAttribute', 'orientation', 'vertical').slider('refresh');

    var $slider = $("#changeOrientationSliderElem");
    var orientationClassApplied = $slider.hasClass("slider-vertical");

    expect(orientationClassApplied).toBeTruthy();
  });

  it("relayout: if slider is not displayed on initialization and then displayed later on, relayout() will re-adjust the margin-left of the tooltip", function() {
    // Setup
    testSlider = new Slider("#relayoutSliderInput", {
      id: "relayoutSlider",
      min: 0,
      max: 10,
      value: 5
    });
    var mainTooltipDOMRef = document.querySelector("#relayoutSlider .tooltip-main");
    var relayoutSliderContainerDOMRef = document.querySelector("#relayoutSliderContainer");
    var tooltipMarginLeft;
    // Main tooltip margin-left offset should be 0 on slider intialization
    tooltipMarginLeft = parseFloat(mainTooltipDOMRef.style.marginLeft);
    expect(tooltipMarginLeft).toBe(0);
    // Show slider and call relayout()
    relayoutSliderContainerDOMRef.style.display = "block";
    testSlider.relayout();
    // Main tooltip margin-left offset should re-adjust to be > 0
    tooltipMarginLeft = Math.abs( parseFloat(mainTooltipDOMRef.style.marginLeft) );
    expect(tooltipMarginLeft).toBeGreaterThan(0);
  });

  it("relayout: if slider is not displayed on initialization and then displayed later on, relayout() will re-adjust the tick label width", function() {
    // Setup
    testSlider = new Slider("#relayoutSliderInputTickLabels", {
      id: "relayoutSliderTickLabels",
      min: 0,
      max: 10,
      ticks: [0, 5, 10],
      ticks_labels: ['low', 'mid', 'high'],
      value: 5
    });

    var $ticks = $('#relayoutSliderTickLabels').find('.slider-tick-label');

    // Tick-Width should be 0 on slider intialization
    var i, $tick;
    for (i = 0; i < $ticks.length; i++) {
      $tick = $($ticks[i]);
      expect( parseInt($tick.css('width')) ).toBe(0);
    }

    // Show slider and call relayout()
    $('#relayoutSliderContainerTickLabels').css('display', 'block');
    testSlider.relayout();
    $('#relayoutSliderContainerTickLabels').css('display', 'none');

    // Tick-Width should re-adjust to be > 0
    for (i = 0; i < $ticks.length; i++) {
      $tick = $($ticks[i]);
      expect( parseInt($tick.css('width')) ).toBeGreaterThan(0);
    }
  });

  afterEach(function() {
    if(testSlider) {
      if(testSlider instanceof jQuery) { testSlider.slider('destroy'); }
      if(testSlider instanceof Slider) { testSlider.destroy(); }
      testSlider = null;
    }
  });

});

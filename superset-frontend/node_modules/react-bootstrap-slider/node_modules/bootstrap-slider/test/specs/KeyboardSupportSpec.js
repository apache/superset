describe("Keyboard Support Tests", function() {
  var testSlider,
      handle1,
      handle2,
      keyboardEvent,
      initialMinVal = 0,
      initialMaxVal = 10,
      initialStepVal = 1,
      initialSliderVal = 5;

  /*
    Before/After setup
  */
  beforeEach(function() {
    // Create keyboard event
    keyboardEvent = document.createEvent("Events");
    keyboardEvent.initEvent("keydown", true, true);
  });

  afterEach(function() {
    if(testSlider) { testSlider.slider('destroy'); }
    keyboardEvent = null;
    keyboardEvent = null;
  });

  /*
    Begin Tests
  */
  describe("Clicking on slider handle automatically gives it focus", function() {
    
    beforeEach(function() {
      testSlider = $("#testSlider1").slider({
        id: 'testSlider'
      });
      handle1 = $("#testSlider").find(".slider-handle:first");
    });

    it("clicking on handle1 gives focus to handle1", function(done) {
      handle1.focus(function() {
        expect(true).toBeTruthy();
        done();
      });
      handle1.focus();
    });
  });

  describe("When slider handle has TAB focus", function() {

    it("should display it's tooltip if 'tooltip' option is set to 'show'", function() {
      testSlider = $("#testSlider1").slider({
        id: 'testSlider',
        tooltip: 'show'
      });
      handle1 = $("#testSlider").find(".slider-handle:first");

      // Check for no tooltip before focus
      var tooltipIsShown = $("#testSlider").find("div.tooltip").hasClass("in");
      expect(tooltipIsShown).toBeFalsy();
      
      handle1.focus();

      // Tooltip should be present after focus
      tooltipIsShown = $("#testSlider").find("div.tooltip").hasClass("in");
      expect(tooltipIsShown).toBeTruthy();
    });

    it("should not display it's tooltip if 'tooltip' option is set to 'hide'", function() {
      testSlider = $("#testSlider1").slider({
        id: 'testSlider',
        tooltip: 'hide'
      });
      handle1 = $("#testSlider").find(".slider-handle:first");

      // Check for hidden tooltip before focus
      var tooltipIsHidden = $("#testSlider").children("div.tooltip").hasClass("hide");
      expect(tooltipIsHidden).toBeTruthy();
      
      handle1.focus();

      // Tooltip should remain hidden after focus
      tooltipIsHidden = $("#testSlider").children("div.tooltip").hasClass("hide");
      expect(tooltipIsHidden).toBeTruthy();
    });

    it("should not affect the tooltip display if 'tooltip' option is set to 'always'", function() {
      testSlider = $("#testSlider1").slider({
        id: 'testSlider',
        tooltip: 'always'
      });
      handle1 = $("#testSlider").find(".slider-handle:first");
      var $tooltip = $("#testSlider").children("div.tooltip");

      // Check for shown tooltip before focus
      var tooltipIsShown = $tooltip.hasClass("in");
      expect(tooltipIsShown).toBeTruthy();
      
      handle1.focus();

      // Tooltip should remain present after focus
      tooltipIsShown = $tooltip.hasClass("in");
      expect(tooltipIsShown).toBeTruthy();
    });
  });

  describe("For horizontal sliders where its handle has focus", function() {

    beforeEach(function() {
      // Initialize the slider
      testSlider = $("#testSlider1").slider({
        id: 'testSlider',
        orientation: 'horizontal',
        min: initialMinVal,
        max: initialMaxVal,
        step: initialStepVal,
        value: initialSliderVal
      });
      // Focus on handle1
      handle1 = $("#testSlider .min-slider-handle");
      handle1.focus();
    });

    it("moves to the left by the 'step' value when the LEFT arrow key is pressed", function(done) {
      handle1.on("keydown", function() {
        var sliderValue = $("#testSlider1").slider('getValue');
        var expectedSliderValue = initialSliderVal - initialStepVal;
        
        expect(sliderValue).toBe(expectedSliderValue);

        done();
      });

      keyboardEvent.keyCode = keyboardEvent.which = 37;
      handle1[0].dispatchEvent(keyboardEvent);
    });

    it("moves to the right by the 'step' value when the RIGHT arrow key is pressed", function(done) {
      handle1.on("keydown", function() {
        var sliderValue = $("#testSlider1").slider('getValue');
        var expectedSliderValue = initialSliderVal + initialStepVal;
        
        expect(sliderValue).toBe(expectedSliderValue);

        done();
      });

      keyboardEvent.keyCode = keyboardEvent.which = 39;
      handle1[0].dispatchEvent(keyboardEvent);
    });

    it("moves to the left by the 'step' value when the DOWN arrow key is pressed", function(done) {
      handle1.on("keydown", function() {
        var sliderValue = testSlider.slider('getValue');
        var expectedSliderValue = initialSliderVal - initialStepVal;
        
        expect(sliderValue).toBe(expectedSliderValue);

        done();
      });

      keyboardEvent.keyCode = keyboardEvent.which = 40;
      handle1[0].dispatchEvent(keyboardEvent);
    });

    it("moves to the right by the 'step' value when the UP arrow key is pressed", function(done) {
      handle1.on("keydown", function() {
        var sliderValue = testSlider.slider('getValue');
        var expectedSliderValue = initialSliderVal + initialStepVal;
        
        expect(sliderValue).toBe(expectedSliderValue);

        done();
      });

      keyboardEvent.keyCode = keyboardEvent.which = 38;
      handle1[0].dispatchEvent(keyboardEvent);
    });
  });

  describe("For vertical sliders where its handle has focus", function() {
    
    beforeEach(function() {
      // Initialize the slider
      testSlider = $("#testSlider1").slider({
        id: 'testSlider',
        orientation: 'vertical',
        min: initialMinVal,
        max: initialMaxVal,
        step: initialStepVal,
        value: initialSliderVal
      });
      // Focus on handle1
      handle1 = $("#testSlider").find(".slider-handle:first");
      handle1.focus();
    });

    it("moves down by the 'step' value when the LEFT arrow key is pressed", function(done) {
      handle1.on("keydown", function() {
        var sliderValue = testSlider.slider('getValue');
        var expectedSliderValue = initialSliderVal - initialStepVal;
        
        expect(sliderValue).toBe(expectedSliderValue);

        done();
      });

      keyboardEvent.keyCode = keyboardEvent.which = 37;
      handle1[0].dispatchEvent(keyboardEvent);
    });

    it("moves up by the 'step' value when the RIGHT arrow key is pressed", function(done) {
      handle1.on("keydown", function() {
        var sliderValue = testSlider.slider('getValue');
        var expectedSliderValue = initialSliderVal + initialStepVal;
        
        expect(sliderValue).toBe(expectedSliderValue);

        done();
      });

      keyboardEvent.keyCode = keyboardEvent.which = 39;
      handle1[0].dispatchEvent(keyboardEvent);
    });

    it("moves down by the 'step' value when the DOWN arrow key is pressed", function(done) {
      handle1.on("keydown", function() {
        var sliderValue = testSlider.slider('getValue');
        var expectedSliderValue = initialSliderVal - initialStepVal;
        
        expect(sliderValue).toBe(expectedSliderValue);

        done();
      });

      keyboardEvent.keyCode = keyboardEvent.which = 40;
      handle1[0].dispatchEvent(keyboardEvent);
    });

    it("moves up by the 'step' value when the UP arrow key is pressed", function(done) {
      handle1.on("keydown", function() {
        var sliderValue = testSlider.slider('getValue');
        var expectedSliderValue = initialSliderVal + initialStepVal;
        
        expect(sliderValue).toBe(expectedSliderValue);

        done();
      });

      keyboardEvent.keyCode = keyboardEvent.which = 38;
      handle1[0].dispatchEvent(keyboardEvent);
    });
  });

  describe("For a reversed slider (regardless of 'orientation')", function() {
      
    beforeEach(function() {
      // Initialize the slider
      testSlider = $("#testSlider1").slider({
        id: 'testSlider',
        reversed: true,
        min: initialMinVal,
        max: initialMaxVal,
        step: initialStepVal,
        value: initialSliderVal
      });
      // Focus on handle1
      handle1 = $("#testSlider").find(".slider-handle:first");
      handle1.focus();
    });

    it("moves to the left by the 'step' value when the LEFT arrow key is pressed", function(done) {
      handle1.on("keydown", function() {
        var sliderValue = testSlider.slider('getValue');
        var expectedSliderValue = initialSliderVal - initialStepVal;
        
        expect(sliderValue).toBe(expectedSliderValue);

        done();
      });

      keyboardEvent.keyCode = keyboardEvent.which = 37;
      handle1[0].dispatchEvent(keyboardEvent);
    });

    it("moves to the right by the 'step' value when the RIGHT arrow key is pressed", function(done) {
      handle1.on("keydown", function() {
        var sliderValue = testSlider.slider('getValue');
        var expectedSliderValue = initialSliderVal + initialStepVal;
        
        expect(sliderValue).toBe(expectedSliderValue);

        done();
      });

      keyboardEvent.keyCode = keyboardEvent.which = 39;
      handle1[0].dispatchEvent(keyboardEvent);
    });

    it("moves to the left by the 'step' value when the DOWN arrow key is pressed", function(done) {
      handle1.on("keydown", function() {
        var sliderValue = testSlider.slider('getValue');
        var expectedSliderValue = initialSliderVal - initialStepVal;
        
        expect(sliderValue).toBe(expectedSliderValue);

        done();
      });

      keyboardEvent.keyCode = keyboardEvent.which = 40;
      handle1[0].dispatchEvent(keyboardEvent);
    });

    it("moves to the right by the 'step' value when the UP arrow key is pressed", function(done) {
      handle1.on("keydown", function() {
        var sliderValue = testSlider.slider('getValue');
        var expectedSliderValue = initialSliderVal + initialStepVal;
        
        expect(sliderValue).toBe(expectedSliderValue);

        done();
      });

      keyboardEvent.keyCode = keyboardEvent.which = 38;
      handle1[0].dispatchEvent(keyboardEvent);
    });
  });

  describe("For a range slider (regardless of 'orientation')", function() {
    
    beforeEach(function() {
      // Initialize the slider
      testSlider = $("#testSlider1").slider({
        id: 'testSlider',
        min: initialMinVal,
        max: initialMaxVal,
        step: initialStepVal,
        value: [initialSliderVal, initialSliderVal]
      });
    });

    describe("when handle1 tries to overtake handle2 from the left", function() {
      beforeEach(function() {
        handle1 = $("#testSlider").find(".slider-handle:first");
        handle1.focus();
      });

      it("handle2 moves to the right by the step value", function(done) {
        handle1.on("keydown", function() {
          var sliderValue = testSlider.slider('getValue');
          var expectedSliderValue = initialSliderVal + initialStepVal;
          
          expect(sliderValue[1]).toBe(expectedSliderValue);

          done();
        });

        keyboardEvent.keyCode = keyboardEvent.which = 39;
        handle1[0].dispatchEvent(keyboardEvent);
      });

      it("handle1's value remains unchanged", function(done) {
        var sliderValue = testSlider.slider('getValue');

        handle1.on("keydown", function() {
          expect(sliderValue[0]).toBe(initialSliderVal);
          done();
        });

        keyboardEvent.keyCode = keyboardEvent.which = 39;
        handle1[0].dispatchEvent(keyboardEvent);
      });
    });

    describe("when handle2 tries to overtake handle1 from the right", function() {
      beforeEach(function() {
        handle2 = $("#testSlider").find(".slider-handle:last");
        handle2.focus();
      });

      it("handle1 moves to the left by the step value", function(done) {
        handle2.on("keydown", function() {
          var sliderValue = testSlider.slider('getValue');
          var expectedSliderValue = initialSliderVal - initialStepVal;
          
          expect(sliderValue[0]).toBe(expectedSliderValue);

          done();
        });

        keyboardEvent.keyCode = keyboardEvent.which = 37;
        handle2[0].dispatchEvent(keyboardEvent);
      });

      it("handle2's value remains unchanged", function(done) {
        var sliderValue = testSlider.slider('getValue');

        handle2.on("keydown", function() {
          expect(sliderValue[1]).toBe(initialSliderVal);
          done();
        });

        keyboardEvent.keyCode = keyboardEvent.which = 37;
        handle2[0].dispatchEvent(keyboardEvent);
      });
    });
  });

  describe("For the natural arrow keys", function() {
    var testCases = [{
      reversed: false,
      keyEvent: 37,
      expectedSliderValue: initialSliderVal - initialStepVal,
      orientation: 'horizontal',
      key: 'left'
    }, {
      reversed: true,
      keyEvent: 37,
      expectedSliderValue: initialSliderVal + initialStepVal,
      orientation: 'horizontal',
      key: 'left'
    }, {
      reversed: false,
      keyEvent: 39,
      expectedSliderValue: initialSliderVal + initialStepVal,
      orientation: 'horizontal',
      key: 'right'
    }, {
      reversed: true,
      keyEvent: 39,
      expectedSliderValue: initialSliderVal - initialStepVal,
      orientation: 'horizontal',
      key: 'right'
    }, {
      reversed: false,
      keyEvent: 38,
      expectedSliderValue: initialSliderVal - initialStepVal,
      orientation: 'vertical',
      key: 'up'
    }, {
      reversed: true,
      keyEvent: 38,
      expectedSliderValue: initialSliderVal + initialStepVal,
      orientation: 'vertical',
      key: 'up'
    }, {
      reversed: false,
      keyEvent: 40,
      expectedSliderValue: initialSliderVal + initialStepVal,
      orientation: 'vertical',
      key: 'down'
    }, {
      reversed: true,
      keyEvent: 40,
      expectedSliderValue: initialSliderVal - initialStepVal,
      orientation: 'vertical',
      key: 'down'
    }];
    testCases.forEach(function(testCase) {
      describe("A"+((testCase.reversed)? " reversed" : "")+testCase.orientation+" slider is used for the arrow keys", function() {
        beforeEach(function() {
          // Initialize the slider
          testSlider = $("#testSlider1").slider({
            id: 'testSlider',
            min: initialMinVal,
            max: initialMaxVal,
            step: initialStepVal,
            value: initialSliderVal,
            natural_arrow_keys: true,
            reversed: testCase.reversed,
            orientation: testCase.orientation
          });
          handle1 = $("#testSlider").find(".slider-handle:first");
          handle1.focus();
        });

        it("moves to the "+testCase.key+" by the 'step' value when the "+testCase.key+" arrow key is pressed", function(done) {
          handle1.on("keydown", function() {
            var sliderValue = testSlider.slider('getValue');
            var expectedSliderValue = testCase.expectedSliderValue;

            expect(sliderValue).toBe(expectedSliderValue);

            done();
          });

          
          keyboardEvent.keyCode = keyboardEvent.which = testCase.keyEvent;
          handle1[0].dispatchEvent(keyboardEvent);
        });
      });
    });
  });
});
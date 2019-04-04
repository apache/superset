/*
  *************************

  tooltip_position Option Test

  *************************
*/
describe("'tooltip_position' Option tests", function() {

  var testSlider;

  afterEach(function() {
    if(testSlider) {
      testSlider.destroy();
      testSlider = null;
    }
  });

  describe("vertical slider tests", function() {

    it("should be aligned to the left of the handle if set to 'left'", function() {
      // Create slider
      testSlider = new Slider("#testSlider1", {
        min: 0,
        max: 10,
        value: 5,
        tooltip_position: "left",
        orientation: "vertical"
      });

      // Extract needed references/values
      var mainTooltipHasClassLeft = testSlider.tooltip.classList.contains("left");

      // Assert
      expect(mainTooltipHasClassLeft).toBeTruthy();
      expect(testSlider.tooltip.style.right).toBe("100%");
    });

    it("should be aligned to the right of the handle if set to 'right'", function() {
      // Create slider
      testSlider = new Slider("#testSlider1", {
        min: 0,
        max: 10,
        value: 5,
        tooltip_position: "right",
        orientation: "vertical"
      });

      // Extract needed references/values
      var mainTooltipHasClassRight = testSlider.tooltip.classList.contains("right");

      // Assert
      expect(mainTooltipHasClassRight).toBeTruthy();
      expect(testSlider.tooltip.style.left).toBe("100%");
    });

    it("should default to 'right' if tooltip_position set to 'top'", function() {
      // Create slider
      testSlider = new Slider("#testSlider1", {
        min: 0,
        max: 10,
        value: 5,
        tooltip_position: "top",
        orientation: "vertical"
      });

      // Extract needed references/values
      var mainTooltipHasClassRight = testSlider.tooltip.classList.contains("right");

      // Assert
      expect(mainTooltipHasClassRight).toBeTruthy();
      expect(testSlider.tooltip.style.left).toBe("100%");
    });

    it("should default to 'right' if tooltip_position set to 'bottom'", function() {
      // Create slider
      testSlider = new Slider("#testSlider1", {
        min: 0,
        max: 10,
        value: 5,
        tooltip_position: "bottom",
        orientation: "vertical"
      });

      // Extract needed references/values
      var mainTooltipHasClassRight = testSlider.tooltip.classList.contains("right");

      // Assert
      expect(mainTooltipHasClassRight).toBeTruthy();
      expect(testSlider.tooltip.style.left).toBe("100%");
    });

  });


  describe("horizontal slider tests", function() {

    it("should be aligned above the handle if set to 'top'", function() {
      // Create slider
      testSlider = new Slider("#testSlider1", {
        min: 0,
        max: 10,
        value: 5,
        tooltip_position: "top",
        orientation: "horizontal"
      });

      // Extract needed references/values
      var mainTooltipHasClassTop = testSlider.tooltip.classList.contains("top");

      // Assert
      expect(mainTooltipHasClassTop).toBeTruthy();
      expect(testSlider.tooltip.style.top).toBe("");
    });

    it("should be aligned below the handle if set to 'bottom'", function() {
      // Create slider
      testSlider = new Slider("#testSlider1", {
        min: 0,
        max: 10,
        value: 5,
        tooltip_position: "bottom",
        orientation: "horizontal"
      });

      // Extract needed references/values
      var mainTooltipHasClassTop = testSlider.tooltip.classList.contains("bottom");

      // Assert
      expect(mainTooltipHasClassTop).toBeTruthy();
      expect(testSlider.tooltip.style.top).toBe("22px");
    });

    it("should be aligned below the handle if set to 'bottom' for range", function() {
      // Create slider
      testSlider = new Slider("#testSlider1", {
        min: 0,
        max: 20,
        value: [0, 10],
        range: true,
        tooltip_position: "bottom",
        orientation: "horizontal"
      });

      // Extract needed references/values
      var mainTooltipHasClassTopMin = testSlider.tooltip_min.classList.contains("bottom");
      var mainTooltipHasClassTopMax = testSlider.tooltip_max.classList.contains("bottom");

      // Assert
      expect(mainTooltipHasClassTopMin).toBeTruthy();
      expect(mainTooltipHasClassTopMax).toBeTruthy();
      expect(testSlider.tooltip_min.style.top).toBe("22px");
      expect(testSlider.tooltip_max.style.top).toBe("22px");
    });

    it("should default to 'top' if tooltip_position set to 'left'", function() {
      // Create slider
      testSlider = new Slider("#testSlider1", {
        min: 0,
        max: 10,
        value: 5,
        tooltip_position: "left",
        orientation: "horizontal"
      });

      // Extract needed references/values
      var mainTooltipHasClassTop = testSlider.tooltip.classList.contains("top");

      // Assert
      expect(mainTooltipHasClassTop).toBeTruthy();
      expect(testSlider.tooltip.style.top).toBe("");
    });

    it("should default to 'top' if tooltip_position set to 'right'", function() {
      // Create slider
      testSlider = new Slider("#testSlider1", {
        min: 0,
        max: 10,
        value: 5,
        tooltip_position: "right",
        orientation: "horizontal"
      });

      // Extract needed references/values
      var mainTooltipHasClassTop = testSlider.tooltip.classList.contains("top");

      // Assert
      expect(mainTooltipHasClassTop).toBeTruthy();
      expect(testSlider.tooltip.style.top).toBe("");
    });

  });

});
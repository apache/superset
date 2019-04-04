describe("RTL Tests", function() {
  var testSlider;

  afterEach(function() {
    if(testSlider) {
      testSlider.destroy();
      testSlider = null;
    }
  });

  describe("rtl slider tests", function() {
    it("should be rtl by default inside an rtl wrapper", function() {
      testSlider = new Slider("#rtlSlider");

      var dirIsRtl = $("#rtlSlider").siblings().is(".slider-rtl");

      expect(dirIsRtl).toBeTruthy();
    });

    it("rtl to false inside an rtl wrapper", function() {
      testSlider = new Slider("#rtlSlider", {
        rtl: false
      });

      var dirIsRtl = $("#rtlSlider").siblings().is(".slider-rtl");

      expect(dirIsRtl).not.toBeTruthy();
    });

    it("rtl to true inside an ltr wrapper", function() {
      testSlider = new Slider("#testSlider1", {
        rtl: true
      });

      var dirIsRtl = $("#testSlider1").siblings().is(".slider-rtl");

      expect(dirIsRtl).toBeTruthy();
    });

    it("slider use inversed left and right inline style", function() {
      testSlider = new Slider("#rtlSlider", {
        min: 0,
        max: 10,
        value: 5
      });

      var sliderTrackLowRight=$("#rtlSlider").siblings(".slider-rtl").children("div.slider-track").children("div.slider-track-low").css("right");
      var sliderSelectionRight=$("#rtlSlider").siblings(".slider-rtl").children("div.slider-track").children("div.slider-selection").css("right");
      var sliderTrackHighLeft=$("#rtlSlider").siblings(".slider-rtl").children("div.slider-track").children("div.slider-track-high").css("left");

      expect(sliderTrackLowRight).toBe("0px");
      expect(sliderSelectionRight).toBe("0%");
      expect(sliderTrackHighLeft).toBe("0px");
    });

    it("tooltip position must be inversed in vertical", function() {
      testSlider = new Slider("#rtlSlider", {
        orientation: "vertical",
      });

      var mainTooltipHasClassLeft = testSlider.tooltip.classList.contains("left");

      expect(mainTooltipHasClassLeft).toBeTruthy();
      expect(testSlider.tooltip.style.right).toBe("100%");
    });

    it("tooltip position can be forced in vertical", function() {
      testSlider = new Slider("#rtlSlider", {
        orientation: "vertical",
        tooltip_position: "right",
      });

      var mainTooltipHasClassRight = testSlider.tooltip.classList.contains("right");

      expect(mainTooltipHasClassRight).toBeTruthy();
      expect(testSlider.tooltip.style.left).toBe("100%");
    });

  });

}); // End of spec

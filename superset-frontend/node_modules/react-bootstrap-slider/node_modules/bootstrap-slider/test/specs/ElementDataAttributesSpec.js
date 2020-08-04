describe("Element Data Attributes Tests", function() {
  var slider;

  it("reads the 'data-slider-min' property and sets it on slider", function() {
    slider = $("#minSlider").slider();
    slider.slider('setValue', 1);

    var sliderValue = slider.slider('getValue');
    expect(sliderValue).toBe(5);
  });

  it("reads the 'data-slider-max' property and sets it on slider", function() {
    slider = $("#maxSlider").slider();
    slider.slider('setValue', 10);

    var sliderValue = slider.slider('getValue');
    expect(sliderValue).toBe(5);
  });

  it("reads the 'data-slider-step' property and sets it on slider", function() {

    slider = $("#stepSlider").slider();
    //TODO How do you test this? Maybe manually trigger a slideChange event?
    expect(true).toBeTruthy();
  });

  it("reads the 'data-slider-precision' property (which is set to 2) and sets it on slider", function() {
    slider = $("#precisionSlider").slider();
    slider.slider('setValue', 8.115);

    var sliderValue = slider.slider('getValue');
    expect(sliderValue).toBe(8.12);
  });

  it("reads the 'data-slider-orientation' property and sets it on slider", function() {
    slider = $("#orientationSlider").slider();

    var orientationIsVertical = $("#orientationSlider").data('slider').options.orientation === 'vertical';
    expect(orientationIsVertical).toBeTruthy();
  });

  it("reads the 'data-slider-value' property and sets it on slider", function() {
    slider = $("#valueSlider").slider();

    var sliderValue = slider.slider('getValue');
    expect(sliderValue).toBe(5);
  });

  it("reads the 'data-slider-ticks-labels' property and sets it on slider", function() {
    slider = $("#sliderWithTickMarksAndLabels").slider();

    var ticksLabelsAreCorrect = arraysEqual($("#sliderWithTickMarksAndLabels").data('slider').options.ticks_labels, ['$0', '$100', '$200', '$300', '$400']);
    expect(ticksLabelsAreCorrect).toBeTruthy();

	function arraysEqual(a, b) {
	  if (a === b) {return true;}
	  if (a == null || b == null){return false;}
	  if (a.length !== b.length) {return false;}

	  for (var i = 0; i < a.length; ++i) {
		if (a[i] !== b[i]) {return false;}
	  }
	  return true;
	}
  });

  it("reads the 'data-slider-selection' property and sets it on slider", function() {
    slider = $("#selectionSlider").slider({
      id: "selectionSliderId"
    });
    slider.slider('setValue', 0);

    var newSliderValue = slider.slider('getValue');
    expect(newSliderValue).toBe(0);
  });

  it("reads the 'data-slider-tooltip' property and sets it on slider", function() {
    slider = $("#tooltipSlider").slider({
      id: "tooltipSliderElem"
    });
    var tooltipIsHidden = $("#tooltipSliderElem").children("div.tooltip").hasClass("hide");
    expect(tooltipIsHidden).toBeTruthy();
  });

  describe("reads the 'data-slider-handle' property and sets it on slider", function() {
    it("applies 'triangle' class tag to handle", function() {
      slider = $("#handleSlider").slider({
        id: "handleSliderElem"
      });
      var handleIsSetToTriangle = $("#handleSliderElem div.slider-handle").hasClass("triangle");
      expect(handleIsSetToTriangle).toBeTruthy();
    });

    it("applies 'custom' class tag to handle", function() {
      slider = $("#customHandleSlider").slider({
        id: "customHandleSliderElem"
      });
      var handleIsSetToCustom = $("#customHandleSliderElem div.slider-handle").hasClass("custom");
      expect(handleIsSetToCustom).toBeTruthy();
    });
  });

  it("reads the 'data-slider-reversed' property and sets it on slider", function() {
    slider = $("#reversedSlider").slider({
      id: "reversedSliderElem"
    });
    slider.slider('setValue', 10);

    var sliderSelectionHeightAtMaxValue = $("#reversedSliderElem div.slider-track").children("div.slider-selection").width();
    expect(sliderSelectionHeightAtMaxValue).toBe(0);
  });

  it("reads the 'data-slider-enabled' property and sets it on slider", function() {
    slider = $("#disabledSlider").slider();
    var isEnabled = slider.slider('isEnabled');
    expect(isEnabled).not.toBeTruthy();
  });

  it("always sets the 'value' attribute of the original <input> element to be the current slider value", function() {
    var $slider = $("#testSliderGeneric");
    var val = 7;

    slider = $slider.slider({
      value: val
    });
    var sliderValueAttrib = $slider.val();
    var valAsString = val.toString();

    expect(sliderValueAttrib).toBe(valAsString);
  });

  it("always sets the 'data-value' attribute of the original <input> element to be the current slider value", function() {
    // Setup
    var sliderInputElem = document.getElementById("testSliderGeneric");
    var val = 7;

    slider = new Slider(sliderInputElem, {
      value: val
    });

    // Assert
    expect(sliderInputElem.dataset.value).toBe( val.toString() );

    // Cleanup
    slider.destroy();
    slider = null;
  });

  afterEach(function() {
    if(slider) { slider.slider('destroy'); }
  });
});
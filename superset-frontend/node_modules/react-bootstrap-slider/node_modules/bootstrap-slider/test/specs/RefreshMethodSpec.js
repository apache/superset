describe("refresh() Method Tests", function() {
  var testSlider;

  afterEach(function() {
    if(testSlider) {
      testSlider.destroy();
    }
  });

  it("does not convert a non-range slider into a range slider when invoked", function() {
  	// Initialize non-range slider
  	testSlider = new Slider("#testSlider1", {
      min: 0,
      max: 10,
      value: 5
    });

    // Assert that slider is non-range slider
    var initialValue = testSlider.getValue();
    var sliderIsRangeValue = initialValue instanceof Array;

    expect(sliderIsRangeValue).toBeFalsy();

    // Invoke refresh() method
    testSlider.refresh();

    // Assert that slider remains a non-range slider
    var afterRefreshValue = testSlider.getValue();
    sliderIsRangeValue = afterRefreshValue instanceof Array;

    expect(sliderIsRangeValue).toBeFalsy();
  });

}); // End of spec
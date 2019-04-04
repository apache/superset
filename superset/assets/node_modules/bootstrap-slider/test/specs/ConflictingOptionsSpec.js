/*
  *************************

  Conflicting Options Tests

  *************************

  This spec has tests for checking if two or more options do not conflict with one another
  As option conflicts are reported and resolved, write tests for them here.
  This will help ensure that they are accounted for and do not arise again.
*/
describe("Conflicting Options Tests", function() {

  var testSlider;

  it("Should have the value zero when it is slided to zero", function() {
    testSlider = $("#testSlider1").slider({
      value: 0,
      step: 1
    });
    var flag = false;
    var mouse = document.createEvent('MouseEvents');

    testSlider.on('slide', function(slideEvt) {
      expect(slideEvt.value).toBe(0);
      flag = true;
    });

    testSlider.data('slider')._mousemove(mouse);
    expect(flag).toBeTruthy();
  });

  it("should set the `precision` to be the number of digits after the decimal of the `step` (assuming no `precision` is specified)", function() {
    // Create Slider
    testSlider = $("#testSlider1").slider({
      value: 8.115,
      step: 0.01
    });
    // Retrieve slider value
    var value = testSlider.slider("getValue");
    // Run tests
    expect(value).toBe(8.12);
  });

  it("should properly allow for a slider that has `range` set to true and `reversed` set to true", function() {
    // Create Slider
    testSlider = new Slider("#testSlider1", {
      reversed: true,
      range: true,
      min: -5,
      max: 20
    });

    // Set Value
    testSlider.setValue([-5, 20]);

    // Assert that selection slider section is 100% of slider width
    var selectedSectionWidth = testSlider.sliderElem.querySelector(".slider-selection").style.width;
    expect(selectedSectionWidth).toBe("100%");

    // Cleanup
    testSlider.destroy();
    testSlider = null;
  });

  afterEach(function() {
    if(testSlider) {
      testSlider.slider('destroy');
      testSlider = null;
    }
  });

});

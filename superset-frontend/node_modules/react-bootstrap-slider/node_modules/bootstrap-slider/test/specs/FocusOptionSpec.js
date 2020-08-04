/*
  ******************

  Focus Option Tests

  ******************

  This spec has tests for checking proper behavior of the focus option.
*/

describe("Focus Option Tests", function() {

  var testSlider;

  var simulateMousedown = function(target, pos) {
    var myEvent = document.createEvent("MouseEvents");
    myEvent.initEvent("mousedown", true, true);
    myEvent.pageX = pos;
    myEvent.pageY = pos;
    target.dispatchEvent(myEvent);
  };

  it("handle should not be focused after value change when 'focus' is false", function() {
    testSlider = $("#testSlider1").slider({
      min  : 0,
      max  : 10,
      value: 0,
      focus: false,
      id   : "testSlider"
    });

    var hasFocus;
    $("#testSlider").find(".min-slider-handle").focus(function() {
      hasFocus = true;
    });

    simulateMousedown($("#testSlider").find(".slider-track-high").get(0), 1000);

    expect(hasFocus).toBe(undefined);
  });

  it("handle should be focused after value change when 'focus' is true", function() {
    testSlider = $("#testSlider1").slider({
      min  : 0,
      max  : 10,
      value: 0,
      focus: true,
      id   : "testSlider"
    });

    var hasFocus;
    $("#testSlider").find(".min-slider-handle").focus(function() {
      hasFocus = true;
    });

    simulateMousedown($("#testSlider").find(".slider-track-high").get(0), 1000);

    expect(hasFocus).toBe(true);
  });

  afterEach(function() {
    if (testSlider) {
      testSlider.slider("destroy");
      testSlider = null;
    }
  });
});

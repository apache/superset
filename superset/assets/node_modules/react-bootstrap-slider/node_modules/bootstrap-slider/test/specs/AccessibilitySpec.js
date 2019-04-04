describe("Accessibility Tests", function() {
  var sliderA;
  var sliderB;

  it("Should have the slider role", function() {
    sliderA = $('#accessibilitySliderA').slider();
    sliderB = $('#accessibilitySliderB').slider();
    var $sliderElementA = $(sliderA.slider('getElement'));
    var $sliderElementB = $(sliderB.slider('getElement'));

    expect($sliderElementA.find('.min-slider-handle').attr('role')).toBe('slider');
    expect($sliderElementB.find('.min-slider-handle').attr('role')).toBe('slider');
    expect($sliderElementB.find('.max-slider-handle').attr('role')).toBe('slider');

    expect($sliderElementA.find('.tooltip-main').attr('role')).toBe('presentation');
    expect($sliderElementA.find('.tooltip-min').attr('role')).toBe('presentation');
    expect($sliderElementA.find('.tooltip-max').attr('role')).toBe('presentation');
  });

  it('Should have an aria-labelledby attribute', function() {
    sliderA = $('#accessibilitySliderA').slider();
    sliderB = $('#accessibilitySliderB').slider();

    expect($(sliderA.slider('getElement')).find('.min-slider-handle').attr('aria-labelledby')).toBe('accessibilitySliderLabelA');
    expect($(sliderB.slider('getElement')).find('.min-slider-handle').attr('aria-labelledby')).toBe('accessibilitySliderLabelA');
    expect($(sliderB.slider('getElement')).find('.max-slider-handle').attr('aria-labelledby')).toBe('accessibilitySliderLabelB');
  });

  it('Should have an aria-valuemax and aria-valuemin value', function() {
    sliderA = $('#accessibilitySliderA').slider({ min: 5, max: 10 });
    sliderB = $('#accessibilitySliderB').slider({ min: 5, max: 10 });
    var $sliderElementA = $(sliderA.slider('getElement'));
    var $sliderElementB = $(sliderB.slider('getElement'));

    expect($sliderElementA.find('.min-slider-handle').attr('aria-valuemin')).toBe('5');
    expect($sliderElementA.find('.min-slider-handle').attr('aria-valuemax')).toBe('10');
    expect($sliderElementB.find('.min-slider-handle').attr('aria-valuemin')).toBe('5');
    expect($sliderElementB.find('.min-slider-handle').attr('aria-valuemax')).toBe('10');
    expect($sliderElementB.find('.max-slider-handle').attr('aria-valuemin')).toBe('5');
    expect($sliderElementB.find('.max-slider-handle').attr('aria-valuemax')).toBe('10');
  });

  it('Should have an aria-valuenow with the current value', function() {
    sliderA = $('#accessibilitySliderA').slider({ min: 5, value: 7 });
    sliderB = $('#accessibilitySliderB').slider({ min: 5, value: [2, 8] });
    var $sliderElementA = $(sliderA.slider('getElement'));
    var $sliderElementB = $(sliderB.slider('getElement'));

    expect($sliderElementA.find('.min-slider-handle').attr('aria-valuenow')).toBe('7');
    expect($sliderElementB.find('.min-slider-handle').attr('aria-valuenow')).toBe('5');
    expect($sliderElementB.find('.max-slider-handle').attr('aria-valuenow')).toBe('8');

    // Change the value and check if aria-valuenow is still the same
    sliderA.slider('setValue', 1);
    sliderB.slider('setValue', [4, 9]);

    expect($sliderElementA.find('.min-slider-handle').attr('aria-valuenow')).toBe('5');
    expect($sliderElementB.find('.min-slider-handle').attr('aria-valuenow')).toBe('5');
    expect($sliderElementB.find('.max-slider-handle').attr('aria-valuenow')).toBe('9');
  });

  afterEach(function() {
    if(sliderA) { sliderA.slider('destroy'); }
    if(sliderB) { sliderB.slider('destroy'); }
  });

});

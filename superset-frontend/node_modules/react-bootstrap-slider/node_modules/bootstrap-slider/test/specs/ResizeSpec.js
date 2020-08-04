describe("Resize Tests", function() {
  var testSlider, dataSlider;

  afterEach(function() {
    if(testSlider) {
      testSlider.slider('destroy');
      testSlider = null;
      dataSlider = null;
    }
  });

  describe("Tick Labels", function() {

    var $el, options;

    beforeEach(function() {
      var tick = [0, 100, 200, 300, 400];
      options = {
          ticks: tick,
          ticks_labels: ['$0', '$100', '$200', '$300', '$400']
      };
    });

    it("should resize the tick labels when horizontal", function() {

      $el = $("#resizeSlider");
      testSlider = $el.slider(options);
      dataSlider = testSlider.data('slider');

      $('.slider').width(210);
      dataSlider._resize();
      expect($el.siblings('div.slider').find('.slider-tick-label:eq(0)').width()).toBe(53);

      $('.slider').width(120);
      dataSlider._resize();
      expect($el.siblings('div.slider').find('.slider-tick-label:eq(0)').width()).toBe(30);

      $('.slider').width(900);
      dataSlider._resize();
      expect($el.siblings('div.slider').find('.slider-tick-label:eq(1)').width()).toBe(225);

      $('.slider').width(210);
      dataSlider._resize();
      expect($el.siblings('div.slider').find('.slider-tick-label:eq(0)').width()).toBe(53);
    });

    it('should resize the tick labels when vertical', function() {

      var $el = $("#resizeSliderVertical");
      testSlider = $el.slider(options);
      dataSlider = testSlider.data('slider');

      $('.slider').height(210);
      dataSlider._resize();
      expect($el.siblings('div.slider').find('.slider-tick-label:eq(0)').height()).toBe(53);

      $('.slider').height(120);
      dataSlider._resize();
      expect($el.siblings('div.slider').find('.slider-tick-label:eq(0)').height()).toBe(30);

      $('.slider').height(900);
      dataSlider._resize();
      expect($el.siblings('div.slider').find('.slider-tick-label:eq(1)').height()).toBe(225);

      $('.slider').height(210);
      dataSlider._resize();
      expect($el.siblings('div.slider').find('.slider-tick-label:eq(0)').height()).toBe(53);
    });
  });
}); // End of spec

describe("Auto register data-provide Tests", function() {
  it("checks that the autoregister Slider was automatically registerd", function() {
    var $el = $("#autoregisterSlider");

    var sliderInstancesExists = $el.siblings().is(".slider");
    expect(sliderInstancesExists).toBeTruthy();

    var sliderInstancesCount = $el.siblings(".slider").length;
    expect(sliderInstancesCount).toEqual(1);
  });

  it("checks that the autoregistered Slider can be accessed", function() {
    var $el = $("#autoregisterSlider");
    
    expect($el.slider('getValue')).toBe(1);

    $el.slider('setValue', 2);

    expect($el.slider('getValue')).toBe(2);
  });
});
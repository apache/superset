describe("Namespace Tests", function() {
  var sourceJS = "temp/bootstrap-slider.js";

  it("should always set the plugin namespace to 'bootstrapSlider'", function(done) {
    $.getScript(sourceJS, function() {
      expect($.fn.bootstrapSlider).toBeDefined();
      done();   
    });
  });

  it("should set the plugin namespace to 'slider' if the namespace is available", function(done) {
    $.getScript(sourceJS, function() {
      expect($.fn.slider).toBeDefined();
      done();
    });
  });

  it("should print a console warning if the 'slider' namespace is already bound", function(done) {
    $.fn.slider = function() {};
    spyOn(window.console, "warn");

    $.getScript(sourceJS, function() {
      var expectedWarningMessage = "bootstrap-slider.js - WARNING: $.fn.slider namespace is already bound. Use the $.fn.bootstrapSlider namespace instead.";
      expect(window.console.warn).toHaveBeenCalledWith(expectedWarningMessage);
      done();
    });
  });

  afterEach(function(done) {
    /*
      Set the namespaces back to undefined and reload slider
      So that namespace is returned to $.fn.slider
    */
    $.fn.bootstrapSlider = undefined;
    $.fn.slider = undefined;

    $.getScript(sourceJS, function() {
      done();
    });
  });

});
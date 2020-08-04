describe("Aria-valuetext Tests", function() {
      it("Sets the aria-valuetext to 'formatter' value", function() {
      var textValArrayA = new Array('Monday','Wednesday','Friday');
      var tooltipFormatterA = function(value) {
        var arrActiveValueA = value;
        return textValArrayA[arrActiveValueA-1];
      };
      
      //Formatter is used
      var testSliderA = $("#accessibilitySliderA").slider({
        formatter : tooltipFormatterA
      });
      testSliderA.slider('setValue', 2);
      
      var tooltipMessageA = $("#accessibilitySliderA").prev(".slider").children(".min-slider-handle").attr("aria-valuetext");
      var expectedMessageA = tooltipFormatterA(2);
      expect(tooltipMessageA).toBe(expectedMessageA);
     
    });
    
    it("Does not use aria-valuetext if 'formatter' is not used", function() {
    	  
      //Formatter is not used  
      var testSliderB = $("#accessibilitySliderB").slider({});
      testSliderB.slider('setValue', 1);
    
      var ariaValueTextB = $("#accessibilitySliderB").prev(".slider").children(".min-slider-handle").attr("aria-valuetext");
      expect(ariaValueTextB).not.toBeDefined();
    });
    
    it("aria-valuetext if 'formatter' is used and has min & max value", function() {
      var textValArrayC = new Array('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday');
      var tooltipFormatterC = function(value) {
          if(value[1]){
            var arrActiveValueC0 = value[0];
            var arrActiveValueC1 = value[1];  
            return [ textValArrayC[arrActiveValueC0-1], textValArrayC[arrActiveValueC1-1] ];
          } else {
          	var arrActiveValueC = value;
  			return textValArrayC[arrActiveValueC-1];
          }
      };
      
      //Formatter is used for ranges
      var testSliderC = $("#accessibilitySliderC").slider({
        range: true,
        formatter : tooltipFormatterC
      });
      var valuesToSet = [2,4];
      testSliderC.slider('setValue', valuesToSet);
      var expectedMessageC = tooltipFormatterC([2,4]);
      var ttminMessage = $("#accessibilitySliderC").prev(".slider").children(".min-slider-handle").attr("aria-valuetext");
      var ttmaxMessage = $("#accessibilitySliderC").prev(".slider").children(".max-slider-handle").attr("aria-valuetext");
      expect(ttminMessage).toBe(expectedMessageC[0]);
      expect(ttmaxMessage).toBe(expectedMessageC[1]);
    });
});

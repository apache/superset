
/*
	*************************

	Logarithmic Scale Tests

	*************************

*/
describe("Slider with logarithmic scale tests", function() {

	var testSlider;

	describe("Should properly position the slider", function() {

		function testSliderPosition(min, max, value){
			testSlider = $("#testSlider1").slider({
    			min: min,
    			max: max,
    			scale: 'logarithmic',
    			value: value // This should be at 50%
    		});
			var expectedPostition = 210 / 2 + 'px';
			var handle = $("#testSlider1").siblings('div.slider').find('.min-slider-handle');
			expect(handle.css('left')).toBe(expectedPostition);
		}

        it("with positive values", function() {
			testSliderPosition(1, 10000, 100);
    	});

        it("with zero", function() {
			testSliderPosition(0, 63, 7);
        });

        it("with a negative value", function() {
			testSliderPosition(-7, 56, 0);
        });
    });

	it("Should properly position the tick marks", function() {
		testSlider = $("#testSlider1").slider({
			min: 1,
			max: 100,
			scale: 'logarithmic',
			ticks: [1,10,20,50,100]
		});

		// Position expected for the '10' tick
		var expectedTickOnePosition = 210 / 2 + 'px'; //should be at 50%

		var handle = $("#testSlider1").siblings('div.slider').find(".slider-tick").eq(1);
		expect(handle.css('left')).toBe(expectedTickOnePosition);
	});

	it("Should use step size when navigating the keyboard", function() {
		testSlider = $("#testSlider1").slider({
			min: 1,
			max: 10000,
			scale: 'logarithmic',
			value: 100,
			step: 5
		});

		// Focus on handle1
		var handle1 = $("#testSlider1").siblings('div.slider:first').find('.slider-handle');
		handle1.focus();

		// Create keyboard event
		var keyboardEvent = document.createEvent("Events");
		keyboardEvent.initEvent("keydown", true, true);

		var keyPresses = 0;
		handle1.on("keydown", function() {
			keyPresses++;
			var value = $("#testSlider1").slider('getValue');
			expect(value).toBe(100 + keyPresses*5);
		});

		keyboardEvent.keyCode = keyboardEvent.which = 39; // RIGHT
		for (var i = 0; i < 5; i++) {
			handle1[0].dispatchEvent(keyboardEvent);
		}
	});

	afterEach(function() {
	    if(testSlider) {
	      testSlider.slider('destroy');
	      testSlider = null;
	    }
  	});
});

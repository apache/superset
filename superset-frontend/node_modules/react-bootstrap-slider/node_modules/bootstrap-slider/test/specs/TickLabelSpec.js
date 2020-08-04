/*
	Tick label Render Tests - Tests that labels render in correct positions in both horizontal and vertical orientation
*/

describe("Tick Label Render Tests", function() {			
	var testSliderH;
	var testSliderV;
	
	//setup
	beforeEach(function() {
		testSliderH = $('#testSlider1').slider({
			id: 'slider1',
			ticks: [0, 1, 2],
			ticks_labels:['x', 'y', 'z'],
			orientation:'horizontal'
		});
		
		testSliderV = $('#testSlider2').slider({
			id: 'slider2',
			ticks: [0, 1, 2],
			ticks_labels:['x', 'y', 'z'],
			orientation:'vertical'
		});
	});
	
	//cleanup
	afterEach(function() {
		testSliderH.slider('destroy');
		testSliderH = null;
		
		testSliderV.slider('destroy');
		testSliderV = null;
	});
		
	//e.g. testOrientation('horizontal', 2) will test the horizontal
	//code path using control with the id testSlider2 
	function testOrientation(orientation) {
		var sliderIndex = orientation.toLowerCase() === 'horizontal' ? 1 : 2;
		var isVertical = orientation.toLowerCase() === 'horizontal' ? false : true; 
		var sliderId = '#slider' + sliderIndex;
		
		//check elements exist
		it("Tick labels are rendered - " + orientation, function() {
			expect($(sliderId).length).toBe(1);
			
			var length = $(sliderId + ' .slider-tick-label').length;		
			expect(length).toBe(3);
		});	
		
		//check elements exist within the bounds of the slider
		it("Tick labels render inside the slider's bounds" + orientation, function() {
			expect($(sliderId).length).toBe(1);
			
			var sliderRect = $(sliderId)[0].getBoundingClientRect();
			var tickLabels = $(sliderId + ' .slider-tick-label');
			
			for (var i = 0; i < tickLabels.length; i++) {
				var labelRect = tickLabels[i].getBoundingClientRect();
				
				if (isVertical) {
					expect(labelRect.left).toBeGreaterThan(sliderRect.left);
					expect(labelRect.top + 10 >= sliderRect.top).toBeTruthy();
				} else {
					expect(labelRect.top + 10 >= sliderRect.top).toBeTruthy();
					expect(labelRect.width / 2 + labelRect.left >= sliderRect.left).toBeTruthy();
				}
			}
		});
	}
	
	//test both horizontal and vertical orientations
	testOrientation('horizontal');
	testOrientation('vertical');
});
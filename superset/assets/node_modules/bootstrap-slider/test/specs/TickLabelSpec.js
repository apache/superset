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

describe("Tick Labels 'is-selection' and 'in-selection' Tests", function() {
	var $inputSlider;
	var options;
	var keyboardEvent;
	var $slider;
	var $handle1;
	var $handle2;
	var $tickLabels;
	var tickLabelCount;

	// Setup
	beforeEach(function() {
		options = {
			id: 'slider1',
			ticks: [0, 1, 2, 3, 4],
			value: 2,
			ticks_labels:['$0', '$1', '$2', '$3', '$4'],
		};

		tickLabelCount = options.ticks_labels.length;

		// Create keyboard event
		keyboardEvent = document.createEvent('Event');
		keyboardEvent.initEvent('keydown', true, true);
	});

	// Cleanup
	afterEach(function() {
		$inputSlider.slider('destroy');
		$inputSlider = null;
	});

	describe("Tick Labels 'is-selection' Tests", function() {

		describe("'options.selection = 'before'", function() {

			beforeEach(function() {
				options.selection = 'before';
				$inputSlider = $('#testSlider1').slider(options);
				$slider = $('#slider1');
				$tickLabels = $slider.find('.slider-tick-label-container div.slider-tick-label');
			});

			it("Should show the correct tick labels as 'is-selection'", function() {
				// There should only be one tick label with the 'label-is-selection' class
				expect($slider.find('.label-is-selection').length).toBe(1);
				// Only the third tick label should have the 'label-is-selection' class
				expect($tickLabels.eq(2).hasClass('label-is-selection')).toBe(true);
			});

			it("Should show the correct tick labels as 'is-selection' when keying to the left", function(done) {
				$handle1 = $('#slider1').find('.slider-handle:first');

				expect($slider.find('.label-is-selection').length).toBe(1);
				expect($tickLabels.eq(2).hasClass('label-is-selection')).toBe(true);

				$handle1.on('keydown', function() {
					expect($slider.find('.label-is-selection').length).toBe(1);
					expect($tickLabels.eq(1).hasClass('label-is-selection')).toBe(true);
					done();
				});

				// Move handle1 to the left with keyboard
				$handle1.focus();
				keyboardEvent.keyCode = keyboardEvent.which = 37;
				$handle1[0].dispatchEvent(keyboardEvent);
			});
		});

		describe("'options.selection = 'after'", function() {

			beforeEach(function() {
				options.selection = 'after';
				$inputSlider = $('#testSlider1').slider(options);
				$slider = $('#slider1');
				$tickLabels = $slider.find('.slider-tick-label-container div.slider-tick-label');
			});

			it("Should show the correct tick labels as 'is-selection'" , function() {
				expect($slider.find('.label-is-selection').length).toBe(1);
				expect($tickLabels.eq(2).hasClass('label-is-selection')).toBe(true);
			});

			it("Should show the correct tick labels as 'is-selection' when keying to the right" , function(done) {
				$handle1 = $('#slider1').find('.slider-handle:first');

				expect($slider.find('.label-is-selection').length).toBe(1);
				expect($tickLabels.eq(2).hasClass('label-is-selection')).toBe(true);

				$handle1.on('keydown', function() {
					expect($slider.find('.label-is-selection').length).toBe(1);
					expect($tickLabels.eq(3).hasClass('label-is-selection')).toBe(true);
					done();
				});

				// Move handle1 to the right with keyboard
				$handle1.focus();
				keyboardEvent.keyCode = keyboardEvent.which = 39;
				$handle1[0].dispatchEvent(keyboardEvent);
			});
		});
	});

	describe("Tick Labels 'in-selection' Tests", function() {

		function checkTickLabels($labels, expectedLabels) {
			var next = 0;

			// There are only 5 tick labels.
			expect($labels.length).toBe(tickLabelCount);

			for (var i = 0; i < tickLabelCount; i++) {
				if (i === expectedLabels[next]) {
					expect($labels.eq(i).hasClass('label-in-selection')).toBe(true);
					next++;
				}
				else {
					expect($labels.eq(i).hasClass('label-in-selection')).toBe(false);
				}
			}
		}

		// Setup
		beforeEach(function() {
			options.value = [1, 3];
			$inputSlider = $('#testSlider1').slider(options);
			$slider = $('#slider1');
			$tickLabels = $slider.find('.slider-tick-label-container div.slider-tick-label');
		});

		it("Should show the correct tick labels as 'in-selection'", function() {
			expect($slider.find('.label-is-selection').length).toBe(3);
			checkTickLabels($tickLabels, [1, 2, 3]);
		});

		it("Should show the correct tick labels as 'in-selection' when keying to the left", function(done) {
			$handle1 = $('#slider1').find('.slider-handle:first');

			// There should be 3 tick labels with the 'label-in-selection' class
			expect($slider.find('.label-in-selection').length).toBe(3);

			// Check that the correct tick labels have the 'label-in-selection' class
			checkTickLabels($tickLabels, [1, 2, 3]);

			$handle1.on('keydown', function() {
				expect($slider.find('.label-in-selection').length).toBe(4);

				// Check the labels again
				checkTickLabels($tickLabels, [0, 1, 2, 3]);
				done();
			});

			// Move handle1 to the left with keyboard
			$handle1.focus();
			keyboardEvent.keyCode = keyboardEvent.which = 37;
			$handle1[0].dispatchEvent(keyboardEvent);
		});

		it("Should show the correct tick labels as 'in-selection' when keying to the right" , function(done) {
			$handle2 = $('#slider1').find('.slider-handle:last');

			expect($slider.find('.label-in-selection').length).toBe(3);

			checkTickLabels($tickLabels, [1, 2, 3]);

			$handle2.on('keydown', function() {
				expect($slider.find('.label-in-selection').length).toBe(4);
				checkTickLabels($tickLabels, [1, 2, 3, 4]);
				done();
			});

			// Move handle2 to the right with keyboard
			$handle2.focus();
			keyboardEvent.keyCode = keyboardEvent.which = 39;
			$handle2[0].dispatchEvent(keyboardEvent);
		});
	});
});
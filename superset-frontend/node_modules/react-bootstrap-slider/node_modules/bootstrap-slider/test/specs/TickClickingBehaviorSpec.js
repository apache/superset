describe("TickClickingBehavior", function() {
	var SLIDER_ID = "testSlider1";
	var slider;
	var options;

	describe('ticks start with 0', function() {
		beforeEach(function() {
			options = {
				ticks: [0, 1, 2, 3, 4],
				ticks_positions: [0, 25, 50, 75, 100],
				step: 1,
				value: 4
			};

			slider = new Slider(document.getElementById(SLIDER_ID), options);
		});

		it("Should set slider to corresponding value when ticks are clicked", function() {
			for (var i = 0; i < options.ticks.length; i++) {
				clickTickAtIndexAndVerify(slider, i);
			}
		});
	});

	describe('ticks start with positive value', function() {
		beforeEach(function() {
			options = {
				ticks: [1, 2, 3, 4, 5],
				ticks_positions: [0, 25, 50, 75, 100],
				step: 1,
				value: 5
			};

			slider = new Slider(document.getElementById(SLIDER_ID), options);
		});

		it("Should set slider to corresponding value when ticks are clicked", function() {
			for (var i = 0; i < options.ticks.length; i++) {
				clickTickAtIndexAndVerify(slider, i);
			}
		});
	});

	describe('ticks start with negative value', function() {
		beforeEach(function() {
			options = {
				ticks: [-5, -4, -3, -2, -1],
				ticks_positions: [0, 25, 50, 75, 100],
				step: 1,
				value: -1
			};

			slider = new Slider(document.getElementById(SLIDER_ID), options);
		});

		it("Should set slider to corresponding value when ticks are clicked", function() {
			for (var i = 0; i < options.ticks.length; i++) {
				clickTickAtIndexAndVerify(slider, i);
			}
		});
	});

	afterEach(function() { slider.destroy(); });

	// helper functions
	function clickTickAtIndexAndVerify(slider, tickIndex) {
		var sliderLeft = slider.sliderElem.offsetLeft;
		var tickLeft = slider.ticks[tickIndex].offsetLeft;
		var handleHalfWidth = $('.slider-handle.round').width() / 2;

		var offsetX = sliderLeft + tickLeft + handleHalfWidth;
		var offsetY = slider.sliderElem.offsetTop;

		var mouseEvent = getMouseDownEvent(offsetX, offsetY);

		slider.mousedown(mouseEvent);
		slider.mouseup();

		var expectedValue = slider.options.ticks[tickIndex];
		expect(slider.getValue()).toBe(expectedValue);
	}

	function getMouseDownEvent(offsetXToClick, offsetYToClick) {
		var args = [
			'mousedown', // type
			true, // canBubble
			true, // cancelable
			document, // view,
			0, // detail
			0, // screenX
			0, // screenY
			offsetXToClick, // clientX
			offsetYToClick, // clientY,
			false, // ctrlKey
			false, // altKey
			false, // shiftKey
			false, // metaKey,
			0, // button
			null // relatedTarget
		];

		var event = document.createEvent('MouseEvents');
		event.initMouseEvent.apply(event, args);

		return event;
	}
});

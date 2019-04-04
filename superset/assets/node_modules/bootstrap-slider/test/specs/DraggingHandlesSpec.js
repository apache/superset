describe("Dragging handles tests", function() {
	var testSlider;
	var mouseEventArguments;
	var tickOffsets;

	beforeEach(function() {
		// Create slider
		testSlider = new Slider(document.getElementById("testSlider1"), {
			ticks: [0, 1, 2, 3, 4, 5, 6],
			value: [4, 5],
			step: 1,
			range: true,
		});
		// Set up default set of mouse event arguments
		mouseEventArguments = [
			'mousemove', // type
			true, // canBubble
			true, // cancelable
			document, // view,
			0, // detail
			0, // screenX
			0, // screenY
			undefined, // clientX
			testSlider.sliderElem.offsetTop, // clientY,
			false, // ctrlKey
			false, // altKey
			false, // shiftKey
			false, // metaKey,
			0, // button
			null // relatedTarget
		];
		// Calculate and store the 'clientX' for each tick in the slider
		tickOffsets = testSlider.ticks.map(function (tick) {
			return tick.offsetLeft + testSlider.sliderElem.offsetLeft;
		});
	});

	afterEach(function() {
		if(testSlider) {
			if(testSlider instanceof Slider) { testSlider.destroy(); }
			testSlider = null;
		}
	});

	describe("Dragging handles over each other", function() {
		it("should swap reliably given imprecision", function() {
			// Create mouse event with position to the left of problem tick
			var mouseLeft = document.createEvent('MouseEvents');
			mouseEventArguments[7] = tickOffsets[4]; // clientX
			mouseLeft.initMouseEvent.apply(mouseLeft, mouseEventArguments);
			// Create mouse event with position on problem tick
			var mouseOverlap = document.createEvent('MouseEvents');
			mouseEventArguments[7] = tickOffsets[5]; // clientX
			mouseOverlap.initMouseEvent.apply(mouseOverlap, mouseEventArguments);
			// Create mouse event with position to the right of problem tick
			var mouseRight = document.createEvent('MouseEvents');
			mouseEventArguments[7] = tickOffsets[6]; // clientX
			mouseRight.initMouseEvent.apply(mouseRight, mouseEventArguments);
			// Same offset as 'mouseLeft'
			var mouseUp = document.createEvent('MouseEvents');
			mouseEventArguments[7] = testSlider.ticks[4].offsetLeft + testSlider.sliderElem.offsetLeft; // clientX
			mouseUp.initMouseEvent.apply(mouseUp, mouseEventArguments);
			// Simulate drag without swapping
			testSlider.mousedown(mouseLeft);
			expect(testSlider._state.dragged).toBe(0);
			expect(testSlider.getValue()).toEqual([4, 5]);
			// Simulate handle overlap
			testSlider.mousemove(mouseOverlap);
			expect(testSlider._state.dragged).toBe(0);
			expect(testSlider.getValue()).toEqual([5, 5]);
			// Simulate left over right drag with imprecision in reported percentage
			testSlider.mousemove(mouseRight);
			expect(testSlider._state.dragged).toBe(1);
			expect(testSlider.getValue()).toEqual([5, 6]);
			// Simulate handle overlap
			testSlider.mousemove(mouseOverlap);
			expect(testSlider._state.dragged).toBe(1);
			expect(testSlider.getValue()).toEqual([5, 5]);
			// Simulator handle overlap with click
			testSlider.mousemove(mouseOverlap);
			testSlider.mousedown(mouseLeft);
			expect(testSlider._state.dragged).toBe(0);
			expect(testSlider.getValue()).toEqual([4, 5]);
			// Simulate right over left drag with imprecision in reported percentage
			testSlider.mousemove(mouseLeft);
			expect(testSlider._state.dragged).toBe(0);
			expect(testSlider.getValue()).toEqual([4, 5]);
			// End with mouse up
			testSlider.mouseup(mouseUp);
			expect(testSlider._state.dragged).toBeNull();
			expect(testSlider.getValue()).toEqual([4, 5]);
		});
	});

	describe("Drag handles over each other and use keyboard to move handles over each other", function() {
		var keyboardEvent;

		function createMouseEvent(type, tickIdx) {
			var mouseEvent = document.createEvent('MouseEvent');
			mouseEventArguments[0] = type;
			mouseEventArguments[7] = tickOffsets[tickIdx];
			mouseEvent.initMouseEvent.apply(mouseEvent, mouseEventArguments);
			return mouseEvent;
		}

		beforeEach(function() {
			// Create keyboard event
			keyboardEvent = document.createEvent('Event');
			keyboardEvent.initEvent('keydown', true, true);
		});

		afterEach(function() {
			keyboardEvent = null;
		});

		it("should drag and keydown handles properly to the right then back to the left", function() {
			// Simulate drag without swapping
			testSlider.mousedown(createMouseEvent('mousedown', 4));
			expect(testSlider._state.dragged).toBe(0);
			expect(testSlider.getValue()).toEqual([4, 5]);

			// Simulate handle overlap
			testSlider.mousemove(createMouseEvent('mousemove', 5));
			expect(testSlider._state.dragged).toBe(0);
			expect(testSlider.getValue()).toEqual([5, 5]);

			// Simulate left over right drag
			testSlider.mousemove(createMouseEvent('mousemove', 6));
			expect(testSlider._state.dragged).toBe(1);
			expect(testSlider.getValue()).toEqual([5, 6]);

			// End with mouse up
			testSlider.mouseup(createMouseEvent('mouseup', 6));
			expect(testSlider._state.dragged).toBeNull();
			expect(testSlider.getValue()).toEqual([5, 6]);

			// Now move the handles past each other with the Left arrow key
			keyboardEvent.keyCode = keyboardEvent.which = 37;

			// Move handle2 to the left with keyboard
			testSlider.handle2Keydown(keyboardEvent);
			expect(testSlider._state.keyCtrl).toBeUndefined();
			expect(testSlider.getValue()).toEqual([5, 5]);

			// Move handle2 to the left again
			testSlider.handle2Keydown(keyboardEvent);
			expect(testSlider._state.keyCtrl).toBeUndefined();
			expect(testSlider.getValue()).toEqual([4, 5]);
		});

		it("should drag and keydown handles properly to the left then back to the right", function() {
			// Simulate drag without swapping
			testSlider.mousedown(createMouseEvent('mousedown', 5));
			expect(testSlider._state.dragged).toBe(1);
			expect(testSlider.getValue()).toEqual([4, 5]);

			// Simulate handle overlap
			testSlider.mousemove(createMouseEvent('mousemove', 4));
			expect(testSlider._state.dragged).toBe(1);
			expect(testSlider.getValue()).toEqual([4, 4]);

			// Simulate left over right drag
			testSlider.mousemove(createMouseEvent('mousemove', 3));
			expect(testSlider._state.dragged).toBe(0);
			expect(testSlider.getValue()).toEqual([3, 4]);

			// End with mouse up
			testSlider.mouseup(createMouseEvent('mouseup', 3));
			expect(testSlider._state.dragged).toBeNull();
			expect(testSlider.getValue()).toEqual([3, 4]);

			// Now move the handles past each other with the Right arrow key
			keyboardEvent.keyCode = keyboardEvent.which = 39;

			// Move handle1 to the right with keyboard
			testSlider.handle1Keydown(keyboardEvent);
			expect(testSlider._state.keyCtrl).toBeUndefined();
			expect(testSlider.getValue()).toEqual([4, 4]);

			// Move handle1 to the right again
			testSlider.handle1Keydown(keyboardEvent);
			expect(testSlider._state.keyCtrl).toBeUndefined();
			expect(testSlider.getValue()).toEqual([4, 5]);
		});
    });

    it("Should snap to a tick within tick bounds when using the mouse navigation", function() {

        testSlider.setAttribute('range', true);
        testSlider.setAttribute('ticks_snap_bounds', 0.45);
        testSlider.setAttribute('step', 0.1);
        testSlider.refresh();

		// Create mouse events
        var mouseDown = document.createEvent("MouseEvents");
        mouseEventArguments[7] = tickOffsets[1];
        mouseDown.initMouseEvent.apply(mouseDown, mouseEventArguments);

        var mouseRight = document.createEvent("MouseEvents");
        mouseEventArguments[7] = tickOffsets[2] - 2;
        mouseRight.initMouseEvent.apply(mouseRight, mouseEventArguments);

        testSlider.mousedown(mouseDown);
		expect(testSlider.getValue()).toEqual([0.7, 5]);

        testSlider.mousemove(mouseRight);
        expect(testSlider.getValue()).toEqual([2, 5]);

		// FIXME: Use 'mouseup' event type
        // End with mouse up
        testSlider.mouseup(mouseRight);
        expect(testSlider.getValue()).toEqual([2, 5]);

	});

	describe("Test 'mousemove' and 'mouseup' produces correct results", function() {
		var $mySlider;
		var $handle1;

		function arraysEqual(a, b) {
			if (a === b) { return true; }
			if (a == null || b == null) { return false; }
			if (a.length !== b.length) { return false; }

			for (var i = 0; i < a.length; ++i) {
				if (a[i] !== b[i]) { return false; }
			}
			return true;
		}

		it("Last value changed in 'change' event should equal 'mouseup' event value for slider", function(done) {
			// Change attributes for 'testSlider'
			testSlider.setAttribute('value', 3);
			testSlider.setAttribute('range', false);
			testSlider.refresh();

			$mySlider = $('#testSlider1');

			function createMouseEvent(type, tickIdx) {
				var mouseEvent = document.createEvent('MouseEvent');
				mouseEventArguments[0] = type;
				mouseEventArguments[7] = tickOffsets[tickIdx];
				mouseEvent.initMouseEvent.apply(mouseEvent, mouseEventArguments);
				return mouseEvent;
			}

			var lastValue = 99;  // Dummy value
			$mySlider.on('change', function(eventData) {
				lastValue = eventData.value.newValue;
			});

			$mySlider.on('slideStop', function(eventData) {
				var value = eventData.value;
				var isEqual = Array.isArray(value) ? arraysEqual(lastValue, value) : value === lastValue;
				expect(isEqual).toBe(true);
				done();
			});

			// Simulate drag and release from tick[1] to tick[4]
			$handle1 = testSlider.$sliderElem.find('.slider-handle:first');
			$handle1[0].dispatchEvent(createMouseEvent('mousedown', 1));
			$handle1[0].dispatchEvent(createMouseEvent('mousemove', 4));
			$handle1[0].dispatchEvent(createMouseEvent('mouseup', 4));
		});
	});
});

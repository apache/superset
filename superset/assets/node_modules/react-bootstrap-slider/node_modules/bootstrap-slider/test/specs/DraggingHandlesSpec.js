describe("Dragging handles tests", function() {
	var testSlider;
	describe("Dragging handles over each other", function() {
		it("should swap reliably given imprecision", function() {
			testSlider = new Slider(document.getElementById("testSlider1"), {
				ticks: [0, 1, 2, 3, 4, 5, 6],
				value: [4, 5],
				step: 1,
				range: true,
			});
			var mouseEventArguments = [
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
			// Create mouse event with position to the left of problem tick
			var mouseLeft = document.createEvent('MouseEvents');
			mouseEventArguments[7] = testSlider.ticks[4].offsetLeft + testSlider.sliderElem.offsetLeft; // clientX
			mouseLeft.initMouseEvent.apply(mouseLeft, mouseEventArguments);
			// Create mouse event with position on problem tick
			var mouseOverlap = document.createEvent('MouseEvents');
			mouseEventArguments[7] = testSlider.ticks[5].offsetLeft + testSlider.sliderElem.offsetLeft; // clientX
			mouseOverlap.initMouseEvent.apply(mouseOverlap, mouseEventArguments);
			// Create mouse event with position to the right of problem tick
			var mouseRight = document.createEvent('MouseEvents');
			mouseEventArguments[7] = testSlider.ticks[6].offsetLeft + testSlider.sliderElem.offsetLeft; // clientX
			mouseRight.initMouseEvent.apply(mouseRight, mouseEventArguments);
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
			testSlider.mouseup();
			expect(testSlider._state.dragged).toBe(0);
			expect(testSlider.getValue()).toEqual([4, 5]);
		});
	});
	afterEach(function() {
		if(testSlider) {
			if(testSlider instanceof Slider) { testSlider.destroy(); }
			testSlider = null;
		}
	});
});
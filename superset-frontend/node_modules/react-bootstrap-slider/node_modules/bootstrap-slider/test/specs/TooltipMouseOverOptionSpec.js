describe("'ticks_tooltip' Option tests", function() {
	var testSlider;
	describe("ticks_tooltip states", function() {
        it("should have the tooltip above the last hovered over element", function() {
            testSlider = new Slider(document.getElementById("testSlider1"), {
				ticks: [0, 1, 2, 3, 4, 5, 6],
				ticks_positions: [0, 19, 29, 39, 49, 95, 100],
				step: 1,
				value: 4,
                ticks_tooltip: true,
                orientation: 'horizontal'
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
			var mouse49 = document.createEvent('MouseEvents');
			mouseEventArguments[7] = testSlider.ticks[4].offsetLeft + testSlider.sliderElem.offsetLeft; // clientX
			mouse49.initMouseEvent.apply(mouse49, mouseEventArguments);
			var mouse95 = document.createEvent('MouseEvents');
			mouseEventArguments[7] = testSlider.ticks[5].offsetLeft + testSlider.sliderElem.offsetLeft; // clientX
			mouse95.initMouseEvent.apply(mouse95, mouseEventArguments);
			var mouse100 = document.createEvent('MouseEvents');
			mouseEventArguments[7] = testSlider.ticks[6].offsetLeft + testSlider.sliderElem.offsetLeft; // clientX
			mouse100.initMouseEvent.apply(mouse100, mouseEventArguments);
			var mouseStart = document.createEvent('MouseEvents');
			mouseEventArguments[7] = testSlider.ticks[0].offsetLeft + testSlider.sliderElem.offsetLeft; // clientX
			mouseStart.initMouseEvent.apply(mouseStart, mouseEventArguments);

			//Simulate random movements
			testSlider.mousedown(mouse49);
			testSlider.mousemove(mouse95);
			testSlider.mouseup();
			testSlider.mousedown(mouse49);
			testSlider.mousemove(mouse100);
			testSlider.mousemove(mouse95);
			testSlider.mousemove(mouse95);
			testSlider.mousemove(mouseStart);
            expect(testSlider.tooltip.style.left).toBe("0%");
		});
	});
	afterEach(function() {
		if(testSlider) {
			if(testSlider instanceof Slider) { testSlider.destroy(); }
			testSlider = null;
		}
	});
});
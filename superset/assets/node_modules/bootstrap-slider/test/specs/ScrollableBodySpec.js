describe("Scrollable body test", function() {
    var testSlider;
    var sliderHandleTopPos;
    var sliderHandleLeftPos;

    describe("Vertical scrolled body", function() {
        beforeEach(function() {
            testSlider = new Slider("#veryLowPositionedSlider", {
                id: "scrollTestSliderId",
                orientation: "vertical",
                min: 0,
                max: 20,
                value: 10,
                step: 1
            });

            document.body.scrollTop = 2000;

            var sliderHandleEl = document.querySelector("#scrollTestSliderId .slider-handle");
            var sliderHandleBoundingBoxInfo = sliderHandleEl.getBoundingClientRect();
            sliderHandleTopPos = sliderHandleBoundingBoxInfo.top;
            sliderHandleLeftPos = sliderHandleBoundingBoxInfo.left;
        });

        afterEach(function() {
            if(testSlider) {
                testSlider.destroy();
            }
            document.body.scrollTop = 0;
        });

        // The difference between sliderHandleTopPos and mousemoveY is equal to 50 in both cases,
        // but difference between initial and final slider value is not equal (6 and 4).
        // It happens because we don't 'hit' the center of handle but the top left corner.

        it("slides up when handle moves upwards after scroll page down", function() {
            var mousemove = document.createEvent('MouseEvents');
            var mousemoveX = sliderHandleLeftPos;
            var mousemoveY = sliderHandleTopPos - 50;
            var newSliderValue;

            mousemove.initMouseEvent(
                "mousedown",
                true /* bubble */,
                true  /* cancelable */,
                window,
                null,
                0, 0, mousemoveX, mousemoveY, /* coordinates */
                false, false, false, false, /* modifier keys */
                0 /*left*/,
                null
            );
            testSlider.sliderElem.dispatchEvent(mousemove);
            newSliderValue = testSlider.getValue();

            expect(newSliderValue).toEqual(4);
        });

        it("slides down when handle moves downwards after scroll page down", function() {
            var mousemove = document.createEvent('MouseEvents');
            var mousemoveX = sliderHandleLeftPos;
            var mousemoveY = sliderHandleTopPos + 50;
            var newSliderValue;

            mousemove.initMouseEvent(
                "mousedown",
                true /* bubble */,
                true /* cancelable */,
                window,
                null,
                0, 0, mousemoveX, mousemoveY, /* coordinates */
                false, false, false, false, /* modifier keys */
                0 /*left*/,
                null
            );
            testSlider.sliderElem.dispatchEvent(mousemove);
            newSliderValue = testSlider.getValue();

            expect(newSliderValue).toEqual(14);
        });
    });


    describe('Horizontal scrolled body', function() {
        beforeEach(function() {
            testSlider = new Slider('#offRightEdgeSliderInput', {
                id: 'offRightEdgeSlider',
                orientation: 'horizontal',
                min: 0,
                max: 20,
                value: 10,
                step: 1,
            });

            testSlider.sliderElem.scrollIntoView();

            var handle = document.querySelector('#offRightEdgeSlider .slider-handle');
            var handleRect = handle.getBoundingClientRect();
            sliderHandleTopPos = handleRect.top;
            sliderHandleLeftPos = handleRect.left;
        });

        afterEach(function() {
            if (testSlider) {
                testSlider.destroy();
            }
            window.scrollTo(0, 0);
        });

        it('slides left when clicked on the left of the handle', function() {
            var x = sliderHandleLeftPos - 50;
            var y = sliderHandleTopPos;
            var mousedown, newSliderValue;

            mousedown = createMouseDownEvent(x, y);
            testSlider.sliderElem.dispatchEvent(mousedown);
            newSliderValue = testSlider.getValue();

            expect(newSliderValue).toEqual(4);
        });

        it('slides right when clicked on the left of the handle', function() {
            var x = sliderHandleLeftPos + 50;
            var y = sliderHandleTopPos;
            var mousedown, newSliderValue;

            mousedown = createMouseDownEvent(x, y);
            testSlider.sliderElem.dispatchEvent(mousedown);
            newSliderValue = testSlider.getValue();

            expect(newSliderValue).toEqual(14);
        });

        function createMouseDownEvent(x, y) {
            var mousedown = document.createEvent('MouseEvents');
            mousedown.initMouseEvent(
                'mousedown',
                false     /* bubble */,
                true      /* cancelable */,
                window,   /* view */
                null,     /* detail */
                0, 0, x, y,                   /* coordinates */
                false, false, false, false,   /* modifier keys */
                0,     /* button: left */
                null   /* relatedTarget */
            );
            return mousedown;
        }
    });
});

var el,
    hammer,
    pressPeriod = 200,
    pressThreshold = 20,
    pressCount = 0,
    panStartCount = 0,
    swipeCount = 0;

module('Require Failure ( Swipe & Press )', {
    setup: function() {
        el = utils.createHitArea();
        hammer = new Hammer(el, {recognizers: []});

        var swipe = new Hammer.Swipe({threshold: 1});
        var press = new Hammer.Press({time: pressPeriod, threshold: pressThreshold});

        hammer.add(swipe);
        hammer.add(press);

        swipe.recognizeWith(press);
        press.requireFailure(swipe);

        pressCount = 0;
        swipeCount = 0;
        hammer.on('press', function() {
            pressCount++;
        });
        hammer.on('swipe', function() {
            swipeCount++;
        });
    },
    teardown: function() {
        hammer.destroy();
    }
});

asyncTest('When swipe does not recognize the gesture, a press gesture can be fired', function() {
    expect(1);

    utils.dispatchTouchEvent(el, 'start', 50, 50);

    setTimeout(function() {
        start();
        equal(pressCount, 1);
    }, pressPeriod + 100);
});

asyncTest('When swipe does recognize the gesture, a press gesture cannot be fired', function() {
    expect(2);

    Simulator.gestures.swipe(el, null, function() {
        start();

        ok(swipeCount > 0, 'swipe gesture should be recognizing');
        equal(pressCount, 0, 'press gesture should not be recognized because swipe gesture is recognizing');
    });
});
module('Require Failure ( Pan & Press )', {
    setup: function() {
        el = document.createElement('div');
        document.body.appendChild(el);

        hammer = new Hammer(el, {recognizers: []});

        var pan = new Hammer.Pan({threshold: 1});
        var press = new Hammer.Press({time: pressPeriod, threshold: pressThreshold});

        hammer.add([pan, press]);

        pan.recognizeWith(press);
        press.requireFailure(pan);

        pressCount = 0;
        panStartCount = 0;
        hammer.on('press', function() {
            pressCount++;
        });
        hammer.on('panstart', function() {
            panStartCount++;
        });
    },
    teardown: function() {
        document.body.removeChild(el);
        hammer.destroy();
    }
});

asyncTest('When pan does not recognize the gesture, a press gesture can be fired', function() {
    expect(1);

    utils.dispatchTouchEvent(el, 'start', 50, 50);

    setTimeout(function() {
        start();
        equal(pressCount, 1);
    }, pressPeriod + 100);
});

asyncTest('When pan recognizes the gesture, a press gesture cannot be fired', function() {
    expect(2);

    utils.dispatchTouchEvent(el, 'start', 50, 50);
    utils.dispatchTouchEvent(el, 'move', 50 + pressThreshold / 4, 50);

    setTimeout(function() {
        start();

        ok(panStartCount > 0, 'pan gesture should be recognizing');
        equal(pressCount, 0, 'press gesture should not be recognized because pan gesture is recognizing');
    }, pressPeriod + 100);
});

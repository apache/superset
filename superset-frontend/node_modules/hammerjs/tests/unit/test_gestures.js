// TODO: this tests fails because tapRecognizer changes
// it could be that tapRecognizer setup its BEGAN state and
// disable the other gesture recognition
var el, hammer, events;
var allGestureEvents = [
    'tap doubletap press',
    'pinch pinchin pinchout pinchstart pinchmove pinchend pinchcancel',
    'rotate rotatestart rotatemove rotateend rotatecancel',
    'pan panstart panmove panup pandown panleft panright panend pancancel',
    'swipe swipeleft swiperight swipeup swipedown'
].join(' ');

module('Gesture recognition', {
    setup: function() {
        el = utils.createHitArea();
        hammer = new Hammer(el);
        hammer.get('pinch')
            .set({ // some threshold, since the simulator doesnt stays at scale:1 when rotating
                enable: true,
                threshold: .1
            });

        hammer.get('rotate')
            .set({ enable: true });

        hammer.on(allGestureEvents, function(ev) {
            events[ev.type] = true;
        });
        events = {};
    },
    teardown: function() {
        hammer && hammer.destroy();
        events = null;
    }
});

asyncTest('recognize pan', function() {
    expect(1);

    Simulator.gestures.pan(el, { duration: 500, deltaX: 100, deltaY: 0 }, function() {
        start();
        deepEqual(events, {
            pan: true,
            panstart: true,
            panmove: true,
            panright: true,
            panend: true
        });
    });
});

asyncTest('recognize press', function() {
    expect(1);

    Simulator.gestures.press(el, null, function() {
        start();
        deepEqual(events, {
            press: true
        });
    });
});

asyncTest('recognize swipe', function() {
    expect(1);

    Simulator.gestures.swipe(el, { duration: 300, deltaX: 400, deltaY: 0 }, function() {
        start();
        deepEqual(events, {
            pan: true,
            panstart: true,
            panmove: true,
            panright: true,
            panend: true,
            swipe: true,
            swiperight: true
        });
    });
});

asyncTest('recognize pinch', function() {
    expect(1);

    Simulator.gestures.pinch(el, { duration: 500, scale: .5 }, function() {
        start();
        deepEqual(events, {
            pinch: true,
            pinchstart: true,
            pinchmove: true,
            pinchend: true,
            pinchin: true
        });
    });
});

asyncTest('recognize children multitouch pinch', function() {
    expect(1);

    var el1 = utils.createHitArea(el),
        el2 = utils.createHitArea(el);

    Simulator.gestures.pinch([el1, el2], { duration: 500, scale: .5 }, function() {
        start();
        deepEqual(events, {
            pinch: true,
            pinchstart: true,
            pinchmove: true,
            pinchend: true,
            pinchin: true
        });
    });
});

asyncTest('recognize parent-child multitouch pinch', function() {
    expect(1);

    var el1 = utils.createHitArea(el);

    Simulator.gestures.pinch([el, el1], { duration: 100, scale: .5 }, function() {
        start();
        deepEqual(events, {
            pinch: true,
            pinchstart: true,
            pinchmove: true,
            pinchend: true,
            pinchin: true
        });
    });
});

asyncTest('recognize rotate', function() {
    expect(1);

    Simulator.gestures.rotate(el, { duration: 500, scale: 1 }, function() {
        start();
        deepEqual(events, {
            rotate: true,
            rotatestart: true,
            rotatemove: true,
            rotateend: true
        });
    });
});

asyncTest('recognize multitouch rotate', function() {
    expect(1);

    var el1 = utils.createHitArea(el);

    Simulator.gestures.rotate([el, el1], { duration: 500, scale: 1 }, function() {
        start();
        deepEqual(events, {
            rotate: true,
            rotatestart: true,
            rotatemove: true,
            rotateend: true
        });
    });
});

asyncTest('recognize rotate and pinch simultaneous', function() {
    expect(1);

    Simulator.gestures.pinchRotate(el, { duration: 500, scale: 2 }, function() {
        start();
        deepEqual(events, {
            rotate: true,
            rotatestart: true,
            rotatemove: true,
            rotateend: true,
            pinch: true,
            pinchstart: true,
            pinchmove: true,
            pinchend: true,
            pinchout: true
        });
    });
});

asyncTest('don\'t recognize pan and swipe when moving down, when only horizontal is allowed', function() {
    expect(1);

    Simulator.gestures.swipe(el, { duration: 250, deltaX: 0, deltaZ: 200 }, function() {
        start();
        deepEqual(events, { });
    });
});

asyncTest('don\'t recognize press if duration is too short.', function() {
    expect(1);

    Simulator.gestures.press(el, { duration: 240 });

    setTimeout(function() {
        start();
        deepEqual(events, { tap: true }, 'Tap gesture has been recognized.');
    }, 275);
});

asyncTest('don\'t recognize tap if duration is too long.', function() {
    expect(1);

    Simulator.gestures.tap(el, { duration: 255 });

    setTimeout(function() {
        start();
        deepEqual(events, { press: true }, 'Press gesture has been recognized.');
    }, 275);
});

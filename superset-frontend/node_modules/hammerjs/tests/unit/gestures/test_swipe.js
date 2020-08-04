var el,
    hammer,
    swipeCount = 0;

module('Swipe Gesture', {
    setup: function() {
        el = utils.createHitArea();
        hammer = new Hammer(el, {recognizers: []});
        swipeCount = 0;
    },
    teardown: function() {
        hammer.destroy();
    }
});

test('swipe can be recognized', function() {
    expect(1);

    var swipe = new Hammer.Swipe({threshold: 1});
    hammer.add(swipe);
    hammer.on('swipe', function() {
        ok(true);
        start();
    });

    stop();

    Simulator.gestures.swipe(el);
});

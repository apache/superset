var el, hammer, events;

var jQueryPluginPath = '../../node_modules/jquery-hammerjs/jquery.hammer.js';

module('jQuery plugin', {
    setup: function() {
        el = utils.createHitArea();
        events = {};
    },
    teardown: function() {
        hammer && hammer.destroy();
    }
});

asyncTest('trigger pan with jQuery', function() {
    expect(2);

    $.getScript(jQueryPluginPath, function() {
        jQuery(el).hammer();
        jQuery(el).bind('panstart pan panmove panright panend', function(ev) {
            if (ev.gesture) {
                events[ev.type] = true;
            }
        });

        Simulator.gestures.pan(el, { deltaX: 50, deltaY: 0 }, function() {
            start();
            deepEqual(events, {
                pan: true,
                panstart: true,
                panmove: true,
                panright: true,
                panend: true
            });

            ok(jQuery(el).data('hammer') instanceof Hammer.Manager, 'data attribute refers to the instance');
        });
    });
});

asyncTest('trigger pan without jQuery should still work', function() {
    expect(1);

    var hammer = Hammer(el);
    hammer.on('panstart pan panmove panright panend', function(ev) {
        events[ev.type] = true;
    });

    Simulator.gestures.pan(el, { deltaX: 50, deltaY: 0 }, function() {
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

var el,
    hammer;

module('Pan Gesture', {
    setup: function() {
        el = document.createElement('div');
        document.body.appendChild(el);

        hammer = new Hammer(el, {recognizers: []});
    },
    teardown: function() {
        document.body.removeChild(el);
        hammer.destroy();
    }
});

test('`panstart` and `panmove` should be recognized', function() {
    expect(2);

    var panMoveCount = 0;
    var pan = new Hammer.Pan({threshold: 1});

    hammer.add(pan);
    hammer.on('panstart', function() {
      ok(true);
    });
    hammer.on('panmove', function() {
      panMoveCount++;
    });

    utils.dispatchTouchEvent(el, 'start', 50, 50);
    utils.dispatchTouchEvent(el, 'move', 70, 50);
    utils.dispatchTouchEvent(el, 'move', 90, 50);

    equal(panMoveCount, 1);
});

asyncTest('Pan event flow should be start -> left -> end', function() {
    expect(1);
    var pan = new Hammer.Pan({threshold: 1});
    hammer.add(pan);

    var eventflow = "";
    var isCalledPanleft = false;
    hammer.on('panstart', function() {
        eventflow += "start";
    });
    hammer.on('panleft', function() {
        if(!isCalledPanleft){
            isCalledPanleft = true;
            eventflow += "left";
        }
    });
    hammer.on('panend', function() {
        eventflow += "end";
        isCalledPanleft = true;
    });

    Simulator.gestures.pan(el, { deltaX: -100, deltaY: 0 }, function() {
        equal(eventflow,"startleftend");
        start();
    });
});

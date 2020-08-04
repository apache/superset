var el,
    hammer;

module('Pinch Gesture', {
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

asyncTest('Pinch event flow should be start -> in -> end', function() {
    expect(1);
    var pinch = new Hammer.Pinch({enable: true, threshold: .1});
    hammer.add(pinch);

    var eventflow = "";
    var isFiredPinchin = false;
    hammer.on('pinchstart', function() {
        eventflow += "start";
    });
    hammer.on('pinchin', function() {
        if(!isFiredPinchin){
            isFiredPinchin = true;
            eventflow += "in";
        }
    });
    hammer.on('pinchend', function() {
        eventflow += "end";
        isFiredPinchin = false;
    });

    Simulator.gestures.pinch(el, { duration: 500, scale: .5 }, function() {
        equal(eventflow,"startinend");
        start();
    });
});


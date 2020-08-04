var parent,
    child,
    hammerChild,
    hammerParent;

module('Nested gesture recognizers (Tap Child + Pan Parent)', {
    setup: function() {
        parent = document.createElement('div');
        child = document.createElement('div');

        document.getElementById('qunit-fixture').appendChild(parent);
        parent.appendChild(child);

        hammerParent = new Hammer.Manager(parent, {
            touchAction: 'none'
        });
        hammerChild = new Hammer.Manager(child, {
            touchAction: 'none'
        });

        hammerChild.add(new Hammer.Tap());
        hammerParent.add(new Hammer.Pan({threshold: 5, pointers: 1}));
    },
    teardown: function() {
        hammerChild.destroy();
        hammerParent.destroy();
    }
});

test('Tap on the child', function() {
    expect(1);

    hammerChild.on('tap', function() {
        ok(true);
    });
    hammerParent.on('tap', function() {
        throw new Error('tap should not fire on parent');
    });

    utils.dispatchTouchEvent(child, 'start', 0, 10);
    utils.dispatchTouchEvent(child, 'end', 0, 10);
});

test('Panning on the child should fire parent pan and should not fire child tap event', function() {
    expect(1);

    hammerChild.on('tap', function() {
        throw new Error('tap should not fire on parent');
    });
    hammerParent.on('panend', function() {
        ok(true);
    });

    utils.dispatchTouchEvent(child, 'start', 10, 0);
    utils.dispatchTouchEvent(child, 'move', 20, 0);
    utils.dispatchTouchEvent(child, 'end', 30, 0);

});

/*
 // test (optional pointers validation)
 test('Panning with one finger down on child, other on parent', function () {
 expect(1);

 var event,
 touches;

 hammerParent.on('panend', function () {
 ok(true);
 });

 // one finger one child
 utils.dispatchTouchEvent(child, 'start', 10, 0, 0);
 utils.dispatchTouchEvent(parent, 'start', 12, 0, 1);

 touches = [
 {clientX: 20, clientY: 0, identifier: 0 },
 {clientX: 20, clientY: 0, identifier: 1 }
 ];

 event = document.createEvent('Event');
 event.initEvent('touchmove', true, true);
 event.touches = touches;
 event.changedTouches = touches;

 parent.dispatchEvent(event);

 touches = [
 {clientX: 30, clientY: 0, identifier: 0 },
 {clientX: 30, clientY: 0, identifier: 1 }
 ];

 event = document.createEvent('Event');
 event.initEvent('touchend', true, true);
 event.touches = touches;
 event.changedTouches = touches;

 parent.dispatchEvent(event);
 });
 */

var pressPeriod = 600;
module('Nested gesture recognizers (Press Child + Pan Parent)', {
    setup: function() {
        parent = document.createElement('div');
        child = document.createElement('div');

        document.getElementById('qunit-fixture').appendChild(parent);
        parent.appendChild(child);

        hammerParent = new Hammer.Manager(parent, {
            touchAction: 'none'
        });
        hammerChild = new Hammer.Manager(child, {
            touchAction: 'none'
        });

        hammerChild.add(new Hammer.Press({time: pressPeriod}));
        hammerParent.add(new Hammer.Pan({threshold: 5, pointers: 1}));
    },
    teardown: function() {
        hammerChild.destroy();
        hammerParent.destroy();
    }
});

test('Press on the child', function() {
    expect(1);

    hammerChild.on('press', function() {
        ok(true);
    });
    hammerParent.on('press', function() {
        throw new Error('press should not fire on parent');
    });

    utils.dispatchTouchEvent(child, 'start', 0, 10);

    stop();

    setTimeout(function() {
        start();
    }, pressPeriod);
});

test('When Press is followed by Pan on the same element, both gestures are recognized', function() {
    expect(2);
    hammerChild.on('press', function() {
        ok(true);
    });
    hammerParent.on('panend', function() {
        ok(true);
    });

    utils.dispatchTouchEvent(child, 'start', 0, 10);
    stop();

    setTimeout(function() {
        start();

        utils.dispatchTouchEvent(child, 'move', 10, 10);
        utils.dispatchTouchEvent(child, 'move', 20, 10);
        utils.dispatchTouchEvent(child, 'move', 30, 10);
        utils.dispatchTouchEvent(child, 'end', 30, 10);

    }, pressPeriod);
});

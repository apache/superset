var utils = {
    /**
     * trigger simple dom event
     * @param obj
     * @param name
     */
    triggerDomEvent: function(obj, name) {
        var event = document.createEvent('Event');
        event.initEvent(name, true, true);
        obj.dispatchEvent(event);
    },


    createTouchEvent: function(name, x, y, identifier) {
        var event = document.createEvent('Event');
        event.initEvent('touch' + name, true, true);

        event.touches = event.targetTouches = [{
            clientX: x,
            clientY: y,
            identifier: identifier || 0
        }];

        //https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent.changedTouches
        event.changedTouches = [{
            clientX: x,
            clientY: y,
            identifier: identifier || 0
        }];

        return event;
    },

    dispatchTouchEvent: function(el, name, x, y, identifier) {
        var event = utils.createTouchEvent(name, x, y, identifier);
        el.dispatchEvent(event);
    },

    createHitArea: function(parent) {
        if (parent == null) {
            parent = document.getElementById('qunit-fixture')
        }
        var hitArea = document.createElement('div');
        hitArea.style.background = '#eee';
        hitArea.style.height = '300px';

        parent.appendChild(hitArea);
        return hitArea;
    }
};

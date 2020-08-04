import {assert} from 'chai';

import OrderedElements from '../src/ordered-elements';

describe('OrderedElements', () => {
    it('can identify elements it has', () => {
        const elems = new OrderedElements();

        elems.set('a', 1);
        assert.equal(elems.has('a'), true);
    });

    it('can identify elements it does not have', () => {
        const elems = new OrderedElements();

        elems.set('a', 1);
        assert.equal(elems.has('b'), false);
    });

    it('can get elements it has', () => {
        const elems = new OrderedElements();

        elems.set('a', 1);
        assert.equal(elems.get('a'), 1);
    });

    it('adds new elements in order', () => {
        const elems = new OrderedElements();

        elems.set('a', 1);
        elems.set('b', 2);

        assert.deepEqual({
            elements: {
                a: 1,
                b: 2,
            },
            keyOrder: ['a', 'b'],
        }, elems);
    });

    it("overrides old elements but doesn't add to the key ordering", () => {
        const elems = new OrderedElements();

        elems.set('a', 1);
        elems.set('a', 2);

        assert.deepEqual({
            elements: {
                a: 2,
            },
            keyOrder: ['a'],
        }, elems);
    });

    it('preserves original order when overriding', () => {
        const elems = new OrderedElements();

        elems.set('a', 1);
        elems.set('b', 1);
        elems.set('a', 2);

        assert.deepEqual({
            elements: {
                a: 2,
                b: 1,
            },
            keyOrder: ['a', 'b'],
        }, elems);
    });

    it('can reorder when overriding', () => {
        const elems = new OrderedElements();

        elems.set('a', 1);
        elems.set('b', 1);
        elems.set('a', 2, true);

        assert.deepEqual({
            elements: {
                b: 1,
                a: 2,
            },
            keyOrder: ['b', 'a'],
        }, elems);
    });

    it('iterates over the elements in the correct order', () => {
        const elems = new OrderedElements();

        elems.set('a', 1);
        elems.set('b', 2);
        elems.set('c', 3);

        const order = [];

        elems.forEach((value, key) => {
            order.push([key, value]);
        });

        assert.deepEqual([
            ['a', 1],
            ['b', 2],
            ['c', 3],
        ], order);
    });

    it('works with nested Maps', () => {
        const elems = new OrderedElements();
        elems.set('a', 1);
        elems.set('b', new Map([['ba', 1], ['bb', 2]]));
        elems.set('c', 3);

        elems.set('b', new Map([['ba', 3]]));

        assert.deepEqual({
            elements: {
                a: 1,
                b: {
                    elements: {
                        ba: 3,
                        bb: 2,
                    },
                    keyOrder: ['ba', 'bb'],
                },
                c: 3,
            },
            keyOrder: ['a', 'b', 'c'],
        }, elems);
    });
});

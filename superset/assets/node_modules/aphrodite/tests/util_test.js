import {assert} from 'chai';

import {kebabifyStyleName} from '../src/util.js';

describe('Utils', () => {
    describe('kebabifyStyleName', () => {
        it('kebabifies camelCase', () => {
            assert.equal(kebabifyStyleName('fooBarBaz'), 'foo-bar-baz');
        });
        it('kebabifies PascalCase', () => {
            assert.equal(kebabifyStyleName('FooBarBaz'), '-foo-bar-baz');
        });
        it('does not force -webkit-', () => {
            assert.equal(kebabifyStyleName('webkitFooBarBaz'), 'webkit-foo-bar-baz');
        });
        it('forces -ms-', () => {
            assert.equal(kebabifyStyleName('msFooBarBaz'), '-ms-foo-bar-baz');
        });
    });
});

import asap from 'asap';
import {assert} from 'chai';
import jsdom from 'jsdom';

import {
  StyleSheet,
  css
} from '../src/no-important.js';
import { reset } from '../src/inject.js';

describe('css', () => {
    beforeEach(() => {
        global.document = jsdom.jsdom();
        reset();
    });

    afterEach(() => {
        global.document.close();
        global.document = undefined;
    });

    it('adds styles to the DOM', done => {
        const sheet = StyleSheet.create({
            red: {
                color: 'red',
            },
        });

        css(sheet.red);

        asap(() => {
            const styleTags = global.document.getElementsByTagName("style");
            const lastTag = styleTags[styleTags.length - 1];

            assert.include(lastTag.textContent, `${sheet.red._name}{`);
            assert.match(lastTag.textContent, /color:red/);
            assert.notMatch(lastTag.textContent, /!important/);
            done();
        });
    });
});

import asap from 'asap';
import {assert} from 'chai';
import {JSDOM} from 'jsdom';

import {
  StyleSheet,
  css
} from '../src/no-important.js';
import { reset } from '../src/inject.js';
import { getSheetText } from './testUtils.js';

describe('css', () => {
    beforeEach(() => {
        global.document = new JSDOM('').window.document;
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
            const styles = getSheetText(lastTag.sheet);

            assert.include(styles, `${sheet.red._name} {`);
            assert.match(styles, /color: red/);
            assert.notMatch(styles, /!important/);
            done();
        });
    });
});

it('no-important exports match default package exports', () => {
    const defaultExports = require('../src/index');
    const noImportantExports = require('../src/no-important');
    assert.hasAllKeys(noImportantExports, Object.keys(defaultExports));
});

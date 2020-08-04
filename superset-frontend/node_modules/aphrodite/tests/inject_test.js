import asap from 'asap';
import {assert} from 'chai';
import {JSDOM} from 'jsdom';

import { StyleSheet, css, minify } from '../src/index';
import {
    injectAndGetClassName,
    injectStyleOnce,
    reset,
    startBuffering,
    flushToString,
    flushToStyleTag,
    addRenderedClassNames,
    getRenderedClassNames,
} from '../src/inject';
import { defaultSelectorHandlers } from '../src/generate';
import { getSheetText } from './testUtils';

const sheet = StyleSheet.create({
    red: {
        color: 'red',
    },

    blue: {
        color: 'blue',
    },

    green: {
        color: 'green',
    },
});

describe('injection', () => {
    beforeEach(() => {
        global.document = new JSDOM('').window.document;
        reset();
    });

    afterEach(() => {
        global.document.close();
        global.document = undefined;
    });

    describe('injectAndGetClassName', () => {
        it('uses hashed class name', () => {
            const className = injectAndGetClassName(false, [sheet.red], defaultSelectorHandlers);
            assert.equal(className, 'red_137u7ef');
        });

        it('combines class names', () => {
            const className = injectAndGetClassName(false, [sheet.red, sheet.blue, sheet.green], defaultSelectorHandlers);
            assert.equal(className, 'red_137u7ef-o_O-blue_1tsdo2i-o_O-green_1jzdmtb');
        });

        it('ignores null values in styleDefinitions', () => {
            const className = injectAndGetClassName(false, [sheet.red, sheet.blue, null], defaultSelectorHandlers);
            assert.equal(className, 'red_137u7ef-o_O-blue_1tsdo2i');
        });

        describe('process.env.NODE_ENV === \'production\'', () => {
            let prodSheet;
            beforeEach(() => {
                process.env.NODE_ENV = 'production';
                minify(true);
                prodSheet = StyleSheet.create({
                    red: {
                        color: 'red',
                    },

                    blue: {
                        color: 'blue',
                    },

                    green: {
                        color: 'green',
                    },
                });
            });

            afterEach(() => {
                delete process.env.NODE_ENV;
                minify(false);
            });

            it('uses hashed class name (does not re-hash)', () => {
                const className = injectAndGetClassName(false, [prodSheet.red], defaultSelectorHandlers);
                assert.equal(className, `_${prodSheet.red._name}`);
            });

            it('creates minified combined class name', () => {
                const className = injectAndGetClassName(false, [prodSheet.red, prodSheet.blue, prodSheet.green], defaultSelectorHandlers);
                assert.equal(className, '_11v1eztc');
            });

            it('ignores null values in styleDefinitions', () => {
                const className = injectAndGetClassName(false, [
                    null,
                    prodSheet.red,
                    null,
                    prodSheet.blue,
                    prodSheet.green,
                    null
                ], defaultSelectorHandlers);
                assert.equal(className, '_11v1eztc');
            });
        });
    });

    describe('injectStyleOnce', () => {
        it('causes styles to automatically be added', done => {
            injectStyleOnce("x", ".x", [{ color: "red" }], false);

            asap(() => {
                const styleTags = global.document.getElementsByTagName("style");
                assert.equal(styleTags.length, 1);
                const styles = getSheetText(styleTags[0].sheet);

                assert.include(styles, ".x {");
                assert.include(styles, "color: red");

                done();
            });
        });

        it('causes styles to be added async, and buffered', done => {
            injectStyleOnce("x", ".x", [{ color: "red" }], false);

            const styleTags = global.document.getElementsByTagName("style");
            assert.equal(styleTags.length, 0);

            injectStyleOnce("y", ".y", [{ color: "blue" }], false);

            asap(() => {
                const styleTags = global.document.getElementsByTagName("style");
                assert.equal(styleTags.length, 1);
                const styles = getSheetText(styleTags[0].sheet);

                assert.include(styles, ".x {");
                assert.include(styles, ".y {");
                assert.include(styles, "color: red");
                assert.include(styles, "color: blue");

                done();
            });
        });

        it('doesn\'t inject the same style twice', done => {
            injectStyleOnce("x", ".x", [{ color: "red" }], false);
            injectStyleOnce("x", ".x", [{ color: "blue" }], false);

            asap(() => {
                const styleTags = global.document.getElementsByTagName("style");
                assert.equal(styleTags.length, 1);
                const styles = getSheetText(styleTags[0].sheet);

                assert.include(styles, ".x {");
                assert.include(styles, "color: red");
                assert.notInclude(styles, "color: blue");
                assert.equal(styles.match(/\.x {/g).length, 1);

                done();
            });
        });

        it('throws an error if we\'re not buffering and on the server', () => {
            const oldDocument = global.document;
            global.document = undefined;

            assert.throws(() => {
                injectStyleOnce("x", ".x", [{ color: "red" }], false);
            }, "Cannot automatically buffer");

            global.document = oldDocument;
        });

        // browser-specific tests
        it('adds to .innerText if insertRule is not available', done => {
            const styleTag = global.document.createElement("style");
            styleTag.setAttribute("data-aphrodite", "");
            document.head.appendChild(styleTag);
            styleTag.sheet.insertRule = null;

            injectStyleOnce("x", ".x", [{ color: "red" }], false);

            asap(() => {
                assert.include(styleTag.innerText, ".x{");
                assert.include(styleTag.innerText, "color:red");
                done();
            });
        });

        it('uses document.getElementsByTagName without document.head', done => {
            Object.defineProperty(global.document, "head", {
                value: null,
            });

            injectStyleOnce("x", ".x", [{ color: "red" }], false);

            asap(() => {
                const styleTags = global.document.getElementsByTagName("style");
                assert.equal(styleTags.length, 1);
                const styles = getSheetText(styleTags[0].sheet);

                assert.include(styles, ".x {");
                assert.include(styles, "color: red");

                done();
            });
        });
    });

    describe('startBuffering', () => {
        it('causes styles to not be added automatically', done => {
            startBuffering();

            css(sheet.red);

            asap(() => {
                const styleTags = global.document.getElementsByTagName("style");
                assert.equal(styleTags.length, 0);
                done();
            });
        });

        it('throws an error if we try to buffer twice', () => {
            startBuffering();

            assert.throws(() => {
                startBuffering();
            }, "already buffering");
        });
    });

    describe('flushToStyleTag', () => {
        it('adds a style tag with all the buffered styles', () => {
            startBuffering();

            css(sheet.red);
            css(sheet.blue);

            flushToStyleTag();

            const styleTags = global.document.getElementsByTagName("style");
            const lastTag = styleTags[styleTags.length - 1];
            const styles = getSheetText(lastTag.sheet);

            assert.include(styles, `.${sheet.red._name} {`);
            assert.include(styles, `.${sheet.blue._name} {`);
            assert.match(styles, /color: red/);
            assert.match(styles, /color: blue/);
        });

        it('clears the injection buffer', () => {
            startBuffering();

            css(sheet.red);
            css(sheet.blue);

            flushToStyleTag();

            let styleTags = global.document.getElementsByTagName("style");
            assert.equal(styleTags.length, 1);
            const styleContentLength = getSheetText(styleTags[0].sheet).length;

            startBuffering();
            flushToStyleTag();

            styleTags = global.document.getElementsByTagName("style");
            assert.equal(styleTags.length, 1);
            assert.equal(getSheetText(styleTags[0].sheet).length, styleContentLength);
        });
    });

    describe('flushToString', () => {
        it('returns the buffered styles', () => {
            startBuffering();

            css(sheet.red);
            css(sheet.blue);

            const styles = flushToString();

            assert.include(styles, `.${sheet.red._name}{`);
            assert.include(styles, `.${sheet.blue._name}{`);
            assert.match(styles, /color:red/);
            assert.match(styles, /color:blue/);
        });

        it('clears the injection buffer', () => {
            startBuffering();

            css(sheet.red);
            css(sheet.blue);

            assert.notEqual(flushToString(), "");

            startBuffering();
            assert.equal(flushToString(), "");
        });
    });

    describe('getRenderedClassNames', () => {
        it('returns classes that have been rendered', () => {
            css(sheet.red);
            css(sheet.blue);

            const classNames = getRenderedClassNames();

            assert.include(classNames, sheet.red._name);
            assert.include(classNames, sheet.blue._name);
            assert.notInclude(classNames, sheet.green._name);
        });
    });

    describe('addRenderedClassNames', () => {
        it('doesn\'t render classnames that were added', () => {
            startBuffering();
            addRenderedClassNames([sheet.red._name, sheet.blue._name]);

            css(sheet.red);
            css(sheet.blue);
            css(sheet.green);

            flushToStyleTag();

            const styleTags = global.document.getElementsByTagName("style");
            assert.equal(styleTags.length, 1);
            const styles = getSheetText(styleTags[0].sheet);

            assert.include(styles, `.${sheet.green._name} {`);
            assert.notInclude(styles, `.${sheet.red._name} {`);
            assert.notInclude(styles, `.${sheet.blue._name} {`);
            assert.match(styles, /color: green/);
            assert.notMatch(styles, /color: red/);
            assert.notMatch(styles, /color: blue/);
        });
    });
});

describe('String handlers', () => {
    beforeEach(() => {
        global.document = new JSDOM('').window.document;
        reset();
    });

    afterEach(() => {
        global.document.close();
        global.document = undefined;
    });

    function assertStylesInclude(str) {
        const styleTags = global.document.getElementsByTagName("style");
        const styles = getSheetText(styleTags[0].sheet);

        assert.include(styles, str);
    }

    describe('fontFamily', () => {
        it('leaves plain strings alone', () => {
            const sheet = StyleSheet.create({
                base: {
                    fontFamily: "Helvetica",
                },
            });

            startBuffering();
            css(sheet.base);
            flushToStyleTag();

            assertStylesInclude('font-family: Helvetica !important');
        });

        it('concatenates arrays', () => {
            const sheet = StyleSheet.create({
                base: {
                    fontFamily: ["Helvetica", "sans-serif"],
                },
            });

            startBuffering();
            css(sheet.base);
            flushToStyleTag();

            assertStylesInclude('font-family: Helvetica,sans-serif !important');
        });

        it('adds @font-face rules for objects', () => {
            const fontface = {
                fontFamily: "CoolFont",
                src: "url('coolfont.ttf')",
            };

            const sheet = StyleSheet.create({
                base: {
                    fontFamily: [fontface, "sans-serif"],
                },
            });

            startBuffering();
            css(sheet.base);
            flushToStyleTag();

            assertStylesInclude('font-family: "CoolFont",sans-serif !important');
            assertStylesInclude('font-family: CoolFont;');
            assertStylesInclude("src: url('coolfont.ttf');");
        });

        it('supports multiple @font-face with the same family name', () => {
            const sheet = StyleSheet.create({
                base: {
                    fontFamily: [
                        {
                            fontFamily: "CoolFont",
                            src: "url('coolfont.ttf')",
                        },
                        {
                            fontFamily: "CoolFont",
                            fontStyle: "italic",
                            src: "url('coolfont-italic.ttf')",
                        },
                        {
                            fontFamily: "CoolFont",
                            fontWeight: 300,
                            src: "url('coolfont-bold.ttf')",
                        },
                        "sans-serif",
                    ],
                },
            });

            startBuffering();
            css(sheet.base);
            flushToStyleTag();

            assertStylesInclude('font-family: "CoolFont",sans-serif !important');
            assertStylesInclude('font-family: CoolFont;');
            assertStylesInclude("src: url('coolfont.ttf');");
            assertStylesInclude("font-style: italic; src: url('coolfont-italic.ttf');");
            assertStylesInclude("font-weight: 300; src: url('coolfont-bold.ttf');");
        });

        it('supports multiple @font-face with different family names', () => {
            const sheet = StyleSheet.create({
                base: {
                    fontFamily: [
                        {
                            fontFamily: "CoolFont",
                            src: "url('coolfont.ttf')",
                        },
                        {
                            fontFamily: "AwesomeFont",
                            src: "url('awesomefont.ttf')",
                        },
                        {
                            fontFamily: "SuperFont",
                            src: "url('superfont.ttf')",
                        },
                        "sans-serif",
                    ],
                },
            });

            startBuffering();
            css(sheet.base);
            flushToStyleTag();

            assertStylesInclude('font-family: "CoolFont","AwesomeFont","SuperFont",sans-serif !important');
            assertStylesInclude('font-family: CoolFont;');
            assertStylesInclude("src: url('coolfont.ttf');");
            assertStylesInclude('font-family: AwesomeFont;');
            assertStylesInclude("src: url('awesomefont.ttf');");
            assertStylesInclude('font-family: SuperFont;');
            assertStylesInclude("src: url('superfont.ttf');");
        });
    });

    describe('animationName', () => {
        it('leaves plain strings alone', () => {
            const sheet = StyleSheet.create({
                animate: {
                    animationName: "boo",
                },
            });

            startBuffering();
            css(sheet.animate);
            flushToStyleTag();

            assertStylesInclude('animation-name: boo !important');
        });

        it('generates css for keyframes', () => {
            const sheet = StyleSheet.create({
                animate: {
                    animationName: {
                        'from': {
                            left: 10,
                        },
                        '50%': {
                            left: 20,
                        },
                        'to': {
                            left: 40,
                        },
                    },
                },
            });

            startBuffering();
            css(sheet.animate);
            flushToStyleTag();

            assertStylesInclude('@keyframes keyframe_tmjr6');
            assertStylesInclude('from {left: 10px;}');
            assertStylesInclude('50% {left: 20px;}');
            assertStylesInclude('to {left: 40px;}');
            assertStylesInclude('animation-name: keyframe_tmjr6');
        });

        it('generates css for keyframes with multiple properties', () => {
            const sheet = StyleSheet.create({
                animate: {
                    animationName: {
                        '0%': {
                            opacity: 0,
                            transform: 'scale(0.75) translate3d(1px, 2px, 0)',
                        },
                        '100%': {
                            opacity: 1,
                            transform: 'scale(1) translate3d(1px, 2px, 0)',
                        },
                    },
                },
            });

            startBuffering();
            css(sheet.animate);
            flushToStyleTag();

            assertStylesInclude('@keyframes keyframe_d35t13');
            assertStylesInclude('0% {opacity: 0; -webkit-transform: scale(0.75) translate3d(1px, 2px, 0); -ms-transform: scale(0.75) translate3d(1px, 2px, 0); transform: scale(0.75) translate3d(1px, 2px, 0);}');
            assertStylesInclude('100% {opacity: 1; -webkit-transform: scale(1) translate3d(1px, 2px, 0); -ms-transform: scale(1) translate3d(1px, 2px, 0); transform: scale(1) translate3d(1px, 2px, 0);}');
            assertStylesInclude('animation-name: keyframe_d35t13');
        });

        it('doesn\'t add the same keyframes twice', () => {
            const keyframes = {
                'from': {
                    left: 10,
                },
                '50%': {
                    left: 20,
                },
                'to': {
                    left: 40,
                },
            };

            const sheet = StyleSheet.create({
                animate: {
                    animationName: keyframes,
                },
                animate2: {
                    animationName: keyframes,
                },
            });

            startBuffering();
            css(sheet.animate);
            css(sheet.animate2);
            flushToStyleTag();

            const styleTags = global.document.getElementsByTagName("style");
            const styles = getSheetText(styleTags[0].sheet);

            assert.include(styles, '@keyframes keyframe_tmjr6');
            assert.equal(styles.match(/@keyframes/g).length, 1);
        });

        it('concatenates arrays of custom keyframes', () => {
            const keyframes1 = {
                'from': {
                    left: 10,
                },
                'to': {
                    left: 50,
                },
            };

            const keyframes2 = {
                'from': {
                    top: -50,
                },
                'to': {
                    top: 0,
                },
            };

            const sheet = StyleSheet.create({
                animate: {
                    animationName: [keyframes1, keyframes2],
                },
            });

            startBuffering();
            css(sheet.animate);
            flushToStyleTag();

            assertStylesInclude('@keyframes keyframe_1a8sduu');
            assertStylesInclude('@keyframes keyframe_1wnshbu');
            assertStylesInclude('animation-name: keyframe_1a8sduu,keyframe_1wnshbu')
        });

        it('concatenates a custom keyframe animation with a plain string', () => {
            const keyframes1 = {
                'from': {
                    left: 10,
                },
                'to': {
                    left: 50,
                },
            };

            const sheet = StyleSheet.create({
                animate: {
                    animationName: [keyframes1, 'hoo'],
                },
            });

            startBuffering();
            css(sheet.animate);
            flushToStyleTag();

            assertStylesInclude('@keyframes keyframe_1a8sduu');
            assertStylesInclude('animation-name: keyframe_1a8sduu,hoo')
        });
    });
});

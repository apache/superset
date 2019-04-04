import asap from 'asap';
import {assert} from 'chai';
import jsdom from 'jsdom';

import {
  StyleSheet,
  StyleSheetServer,
  StyleSheetTestUtils,
  css
} from '../src/index.js';
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

    it('generates class names', () => {
        const sheet = StyleSheet.create({
            red: {
                color: 'red',
            },

            blue: {
                color: 'blue'
            }
        });

        assert.ok(css(sheet.red, sheet.blue));
    });

    it('filters out falsy inputs', () => {
        const sheet = StyleSheet.create({
            red: {
                color: 'red',
            },
        });

        assert.equal(css(sheet.red), css(sheet.red, false));
        assert.equal(css(sheet.red), css(false, sheet.red));
    });

    it('accepts arrays of styles', () => {
        const sheet = StyleSheet.create({
            red: {
                color: 'red',
            },

            blue: {
                color: 'blue'
            }
        });

        assert.equal(css(sheet.red, sheet.blue), css([sheet.red, sheet.blue]));
        assert.equal(css(sheet.red, sheet.blue), css(sheet.red, [sheet.blue]));
        assert.equal(css(sheet.red, sheet.blue), css([sheet.red, [sheet.blue]]));
        assert.equal(css(sheet.red), css(false, [null, false, sheet.red]));
    });

    it('succeeds for with empty args', () => {
        assert(css() != null);
        assert(css(false) != null);
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
            assert.match(lastTag.textContent, /color:red !important/);
            done();
        });
    });

    it('only ever creates one style tag', done => {
        const sheet = StyleSheet.create({
            red: {
                color: 'red',
            },
            blue: {
                color: 'blue',
            },
        });

        css(sheet.red);

        asap(() => {
            const styleTags = global.document.getElementsByTagName("style");
            assert.equal(styleTags.length, 1);

            css(sheet.blue);

            asap(() => {
                const styleTags = global.document.getElementsByTagName("style");
                assert.equal(styleTags.length, 1);
                done();
            });
        });
    });

    it('automatically uses a style tag with the data-aphrodite attribute', done => {
        const style = document.createElement("style");
        style.setAttribute("data-aphrodite", "");
        document.head.appendChild(style);

        const sheet = StyleSheet.create({
            red: {
                color: 'red',
            },
            blue: {
                color: 'blue',
            },
        });

        css(sheet.red);

        asap(() => {
            const styleTags = global.document.getElementsByTagName("style");
            assert.equal(styleTags.length, 1);
            const styles = styleTags[0].textContent;

            assert.include(styles, `${sheet.red._name}{`);
            assert.include(styles, 'color:red');

            done();
        });
    });
});

describe('StyleSheet.create', () => {
    it('assigns a name to stylesheet properties', () => {
        const sheet = StyleSheet.create({
            red: {
                color: 'red',
            },
            blue: {
                color: 'blue'
            }
        });

        assert.ok(sheet.red._name);
        assert.ok(sheet.blue._name);
        assert.notEqual(sheet.red._name, sheet.blue._name);
    });

    it('assign different names to two different create calls', () => {
        const sheet1 = StyleSheet.create({
            red: {
                color: 'blue',
            },
        });

        const sheet2 = StyleSheet.create({
            red: {
                color: 'red',
            },
        });

        assert.notEqual(sheet1.red._name, sheet2.red._name);
    });

    it('assigns the same name to identical styles from different create calls', () => {
        const sheet1 = StyleSheet.create({
            red: {
                color: 'red',
                height: 20,

                ':hover': {
                    color: 'blue',
                    width: 40,
                },
            },
        });

        const sheet2 = StyleSheet.create({
            red: {
                color: 'red',
                height: 20,

                ':hover': {
                    color: 'blue',
                    width: 40,
                },
            },
        });

        assert.equal(sheet1.red._name, sheet2.red._name);
    });

    it('hashes style names correctly', () => {
        const sheet = StyleSheet.create({
            test: {
                color: 'red',
                height: 20,

                ':hover': {
                    color: 'blue',
                    width: 40,
                },
            },
        });

        assert.equal(sheet.test._name, 'test_j5rvvh');
    });

    it('works for empty stylesheets and styles', () => {
        const emptySheet = StyleSheet.create({});

        assert.ok(emptySheet);

        const sheet = StyleSheet.create({
            empty: {}
        });

        assert.ok(sheet.empty._name);
    });

    describe('process.env.NODE_ENV === \'production\'', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
        });

        afterEach(() => {
            delete process.env.NODE_ENV;
        });

        it('hashes style names correctly', () => {
            const sheet = StyleSheet.create({
                test: {
                    color: 'red',
                    height: 20,

                    ':hover': {
                        color: 'blue',
                        width: 40,
                    },
                },
            });

            assert.equal(sheet.test._name, 'j5rvvh');
        });
    })
});

describe('rehydrate', () => {
    beforeEach(() => {
        global.document = jsdom.jsdom();
        reset();
    });

    afterEach(() => {
        global.document.close();
        global.document = undefined;
    });

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

    it('doesn\'t render styles in the renderedClassNames arg', done => {
        StyleSheet.rehydrate([sheet.red._name, sheet.blue._name]);

        css(sheet.red);
        css(sheet.blue);
        css(sheet.green);

        asap(() => {
            const styleTags = global.document.getElementsByTagName("style");
            assert.equal(styleTags.length, 1);
            const styles = styleTags[0].textContent;

            assert.notInclude(styles, `.${sheet.red._name}{`);
            assert.notInclude(styles, `.${sheet.blue._name}{`);
            assert.include(styles, `.${sheet.green._name}{`);
            assert.notMatch(styles, /color:blue/);
            assert.notMatch(styles, /color:red/);
            assert.match(styles, /color:green/);

            done();
        });
    });

    it('doesn\'t fail with no argument passed in', () => {
        StyleSheet.rehydrate();
    });
});

describe('StyleSheet.extend', () => {
    beforeEach(() => {
        global.document = jsdom.jsdom();
        reset();
    });

    afterEach(() => {
        global.document.close();
        global.document = undefined;
    });

    it('accepts empty extensions', () => {
        const newAphrodite = StyleSheet.extend([]);

        assert(newAphrodite.css);
        assert(newAphrodite.StyleSheet);
    });

    it('uses a new selector handler', done => {
        const descendantHandler = (selector, baseSelector,
                                   generateSubtreeStyles) => {
            if (selector[0] !== '^') {
                return null;
            }
            return generateSubtreeStyles(
                `.${selector.slice(1)} ${baseSelector}`);
        };

        const descendantHandlerExtension = {
            selectorHandler: descendantHandler,
        };

        // Pull out the new StyleSheet/css functions to use for the rest of
        // this test.
        const {StyleSheet: newStyleSheet, css: newCss} = StyleSheet.extend([
            descendantHandlerExtension]);

        const sheet = newStyleSheet.create({
            foo: {
                '^bar': {
                    '^baz': {
                        color: 'orange',
                    },
                    color: 'red',
                },
                color: 'blue',
            },
        });

        newCss(sheet.foo);

        asap(() => {
            const styleTags = global.document.getElementsByTagName("style");
            assert.equal(styleTags.length, 1);
            const styles = styleTags[0].textContent;

            assert.notInclude(styles, '^bar');
            assert.include(styles, '.bar .foo');
            assert.include(styles, '.baz .bar .foo');
            assert.include(styles, 'color:red');
            assert.include(styles, 'color:blue');
            assert.include(styles, 'color:orange');

            done();
        });
    });
});

describe('StyleSheetServer.renderStatic', () => {
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

    it('returns the correct data', () => {
        const render = () => {
            css(sheet.red);
            css(sheet.blue);

            return "html!";
        };

        const ret = StyleSheetServer.renderStatic(render);

        assert.equal(ret.html, "html!");

        assert.include(ret.css.content, `.${sheet.red._name}{`);
        assert.include(ret.css.content, `.${sheet.blue._name}{`);
        assert.match(ret.css.content, /color:red/);
        assert.match(ret.css.content, /color:blue/);

        assert.include(ret.css.renderedClassNames, sheet.red._name);
        assert.include(ret.css.renderedClassNames, sheet.blue._name);
    });

    it('succeeds even if a previous renderStatic crashed', () => {
        const badRender = () => {
            css(sheet.red);
            css(sheet.blue);
            throw new Error("boo!");
        };

        const goodRender = () => {
            css(sheet.blue);
            return "html!";
        };

        assert.throws(() => {
            StyleSheetServer.renderStatic(badRender);
        }, "boo!");

        const ret = StyleSheetServer.renderStatic(goodRender);

        assert.equal(ret.html, "html!");

        assert.include(ret.css.content, `.${sheet.blue._name}{`);
        assert.notInclude(ret.css.content, `.${sheet.red._name}{`);
        assert.include(ret.css.content, 'color:blue');
        assert.notInclude(ret.css.content, 'color:red');

        assert.include(ret.css.renderedClassNames, sheet.blue._name);
        assert.notInclude(ret.css.renderedClassNames, sheet.red._name);
    });

    it('doesn\'t mistakenly return styles if called a second time', () => {
        const render = () => {
            css(sheet.red);
            css(sheet.blue);

            return "html!";
        };

        const emptyRender = () => {
            return "";
        };

        const ret = StyleSheetServer.renderStatic(render);
        assert.notEqual(ret.css.content, "");

        const newRet = StyleSheetServer.renderStatic(emptyRender);
        assert.equal(newRet.css.content, "");
    });

    it('should inject unique font-faces by src', () => {
        const fontSheet = StyleSheet.create({
            test: {
                fontFamily: [{
                    fontStyle: "normal",
                    fontWeight: "normal",
                    fontFamily: "My Font",
                    src: 'url(blah) format("woff"), url(blah) format("truetype")'
                }, {
                    fontStyle: "italic",
                    fontWeight: "normal",
                    fontFamily: "My Font",
                    src: 'url(blahitalic) format("woff"), url(blahitalic) format("truetype")'
                }],
            },

            anotherTest: {
                fontFamily: [{
                    fontStyle: "normal",
                    fontWeight: "normal",
                    fontFamily: "My Font",
                    src: 'url(blah) format("woff"), url(blah) format("truetype")'
                }, {
                    fontStyle: "normal",
                    fontWeight: "normal",
                    fontFamily: "My Other Font",
                    src: 'url(other-font) format("woff"), url(other-font) format("truetype")',
                }],
            },
        });

        const render = () => {
            css(fontSheet.test);
            css(fontSheet.anotherTest);
            return "html!";
        };

        const ret = StyleSheetServer.renderStatic(render);

        // 3 unique @font-faces should be added
        assert.equal(3, ret.css.content.match(/@font\-face/g).length);

        assert.include(ret.css.content, "font-style:normal");
        assert.include(ret.css.content, "font-style:italic");

        assert.include(ret.css.content, 'font-family:"My Font"');
        assert.include(ret.css.content, 'font-family:"My Font","My Other Font"');
    });
});

describe('StyleSheetTestUtils.suppressStyleInjection', () => {
    beforeEach(() => {
        StyleSheetTestUtils.suppressStyleInjection();
    });

    afterEach(() => {
        StyleSheetTestUtils.clearBufferAndResumeStyleInjection();
    });

    it('allows css to be called without requiring a DOM', (done) => {
        const sheet = StyleSheet.create({
            red: {
                color: 'red',
            },
        });

        css(sheet.red);
        asap(done);
    });
});

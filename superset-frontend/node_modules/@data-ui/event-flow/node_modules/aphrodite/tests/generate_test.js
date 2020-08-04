import {assert} from 'chai';

import OrderedElements from '../src/ordered-elements';
import {
    generateCSSRuleset, generateCSS, defaultSelectorHandlers
} from '../src/generate';

describe('generateCSSRuleset', () => {
    const assertCSSRuleset = (selector, declarations, expected) => {
        const orderedDeclarations = new OrderedElements();
        Object.keys(declarations).forEach((key) => {
            orderedDeclarations.set(key, declarations[key]);
        });

        const actual = generateCSSRuleset(selector, orderedDeclarations);
        const expectedNormalized = expected.split('\n').map(x => x.trim()).join('');
        const formatStyles = (styles) => styles.replace(/(;|{|})/g, '$1\n');
        assert.equal(
            actual,
            expectedNormalized,
            `
Expected:

${formatStyles(expectedNormalized)}

Actual:

${formatStyles(actual)}
`
        );
    };
    it('returns a CSS string for a single property', () => {
        assertCSSRuleset('.foo', {
            color: 'red'
        }, '.foo{color:red !important;}');
    });

    it('returns a CSS string for multiple properties', () => {
        assertCSSRuleset('.foo', {
            color: 'red',
            background: 'blue'
        }, `.foo{
            color:red !important;
            background:blue !important;
        }`);
    });

    it('converts camelCase to kebab-case', () => {
        assertCSSRuleset('.foo', {
            backgroundColor: 'red'
        }, '.foo{background-color:red !important;}');
    });

    it('prefixes vendor props with a dash', () => {
        assertCSSRuleset('.foo', {
            transition: 'none'
        }, '.foo{-webkit-transition:none !important;' +
           '-moz-transition:none !important;' +
           'transition:none !important;' +
           '}');
    });

    it('converts ms prefix to -ms-', () => {
        assertCSSRuleset('.foo', {
            MsTransition: 'none'
        }, '.foo{-ms-transition:none !important;}');
    });

    it('returns an empty string if no props are set', () => {
        assertCSSRuleset('.foo', {}, '');
    });

    it('correctly adds px to number units', () => {
        assertCSSRuleset('.foo', {
            width: 10,
            zIndex: 5
        }, '.foo{width:10px !important;z-index:5 !important;}');
    });

    it("doesn't break content strings which contain semicolons during importantify", () => {
        assertCSSRuleset('.foo', {
            content: '"foo;bar"'
        }, '.foo{content:"foo;bar" !important;}');
    });

    it("doesn't break quoted url() arguments during importantify", () => {
        assertCSSRuleset('.foo', {
            background: 'url("data:image/svg+xml;base64,myImage")'
        }, '.foo{background:url("data:image/svg+xml;base64,myImage") !important;}');
    });

    it("doesn't break unquoted url() arguments during importantify", () => {
        assertCSSRuleset('.foo', {
            background: 'url(data:image/svg+xml;base64,myImage)'
        }, '.foo{background:url(data:image/svg+xml;base64,myImage) !important;}');
    });

    it("doesn't importantify rules that are already !important", () => {
        assertCSSRuleset('.foo', {
            color: 'blue !important',
        }, '.foo{color:blue !important;}');
    });
});
describe('generateCSS', () => {
    const assertCSS = (className, styleTypes, expected, selectorHandlers = [],
                       stringHandlers = {}, useImportant = true) => {
        const actual = generateCSS(className, styleTypes, selectorHandlers,
                                   stringHandlers, useImportant);
        const expectedNormalized = expected.split('\n').map(x => x.trim()).join('');
        const formatStyles = (styles) => styles.replace(/(;|{|})/g, '$1\n');
        assert.equal(
            actual,
            expectedNormalized,
            `
Expected:

${formatStyles(expectedNormalized)}

Actual:

${formatStyles(actual)}
`
        );
    };

    it('returns a CSS string for a single property', () => {
        assertCSS('.foo', [{
            color: 'red'
        }], '.foo{color:red !important;}');
    });

    it('works with Map', () => {
        assertCSS('.foo', [new Map([
            ['color', 'red']
        ])], '.foo{color:red !important;}');
    });

    it('works with two Maps', () => {
        assertCSS('.foo', [
            new Map([
                ['color', 'red']
            ]),
            new Map([
                ['color', 'blue']
            ]),
        ], '.foo{color:blue !important;}');
    });

    it('implements override logic', () => {
        assertCSS('.foo', [{
            color: 'red'
        }, {
            color: 'blue'
        }], '.foo{color:blue !important;}');
    });

    it('does not mutate nested objects', () => {
        const styles = {
            a: {
                ':after': {
                    content: 'a',
                }
            },
            b: {
                ':after': {
                    content: 'b',
                }
            }
        };
        generateCSS('.foo', [styles.a, styles.b], [], {}, true);
        assert.equal(styles.a[':after'].content, 'a');
        assert.equal(styles.b[':after'].content, 'b');
    });

    it('supports pseudo selectors', () => {
        assertCSS('.foo', [{
            ':hover': {
                color: 'red'
            }
        }], '.foo:hover{color:red !important;}', defaultSelectorHandlers);
    });

    it('works with a nested Map', () => {
        assertCSS('.foo', [{
            ':hover': new Map([
                ['color', 'red'],
            ])
        }], '.foo:hover{color:red !important;}', defaultSelectorHandlers);
    });

    it('works with two nested Maps', () => {
        assertCSS('.foo', [
            {':hover': new Map([
                ['color', 'red'],
            ])},
            {':hover': new Map([
                ['color', 'blue'],
            ])}
        ], '.foo:hover{color:blue !important;}', defaultSelectorHandlers);
    });

    it('supports media queries', () => {
        assertCSS('.foo', [{
            "@media (max-width: 400px)": {
                color: "blue"
            }
        }], `@media (max-width: 400px){
            .foo{color:blue !important;}
        }`, defaultSelectorHandlers);
    });

    it('supports pseudo selectors inside media queries', () => {
        assertCSS('.foo', [{
            "@media (max-width: 400px)": {
                ":hover": {
                    color: "blue"
                }
            }
        }], `@media (max-width: 400px){
            .foo:hover{color:blue !important;}
        }`, defaultSelectorHandlers);
    });

    it('vendor prefixes in pseudo selectors inside media queries', () => {
        assertCSS('.foo', [{
            "@media (max-width: 400px)": {
                ":hover": {
                    transform: "translateX(0)"
                }
            }
        }], `@media (max-width: 400px){
            .foo:hover{
                -webkit-transform:translateX(0) !important;
                -ms-transform:translateX(0) !important;
                transform:translateX(0) !important;
            }
        }`, defaultSelectorHandlers);
    });

    it('supports combining pseudo selectors inside media queries', () => {
        assertCSS('.foo', [
            {"@media (max-width: 400px)": {
                ":hover": {
                    background: "blue",
                    color: "blue"
                }
            }},
            {"@media (max-width: 400px)": {
                ":hover": {
                    color: "red"
                }
            }}
        ], `@media (max-width: 400px){
            .foo:hover{
                background:blue !important;
                color:red !important;
            }
        }`, defaultSelectorHandlers);
    });

    it('orders overrides in the expected way', () => {
        assertCSS('.foo', [
            {
                "@media (min-width: 400px)": {
                    padding: 10,
                }
            },
            {
                "@media (min-width: 200px)": {
                    padding: 20,
                },
                "@media (min-width: 400px)": {
                    padding: 30,
                }
            }
        ], `
        @media (min-width: 200px){
            .foo{
                padding:20px !important;
            }
        }
        @media (min-width: 400px){
            .foo{
                padding:30px !important;
            }
        }`, defaultSelectorHandlers);
    });

    it('supports custom string handlers', () => {
        assertCSS('.foo', [{
            fontFamily: ["Helvetica", "sans-serif"]
        }], '.foo{font-family:Helvetica, sans-serif !important;}', [], {
            fontFamily: (val) => val.join(", "),
        });
    });

    it('make it possible to disable !important', () => {
        assertCSS('@font-face', [{
            fontFamily: ["FontAwesome"],
            fontStyle: "normal",
        }], '@font-face{font-family:FontAwesome;font-style:normal;}',
        defaultSelectorHandlers, {
            fontFamily: (val) => val.join(", "),
        }, false);
    });

    it('adds browser prefixes', () => {
        assertCSS('.foo', [{
            display: 'flex',
            transition: 'all 0s',
            alignItems: 'center',
            WebkitAlignItems: 'center',
            justifyContent: 'center',
        }], '.foo{' +
            '-webkit-box-pack:center !important;' +
            '-ms-flex-pack:center !important;' +
            '-webkit-box-align:center !important;' +
            '-ms-flex-align:center !important;' +
            'display:-webkit-box !important;' +
            'display:-moz-box !important;' +
            'display:-ms-flexbox !important;' +
            'display:-webkit-flex !important;' +
            'display:flex !important;' +
            '-webkit-transition:all 0s !important;' +
            '-moz-transition:all 0s !important;' +
            'transition:all 0s !important;' +
            'align-items:center !important;' +
            '-webkit-align-items:center !important;' +
            '-webkit-justify-content:center !important;' +
            'justify-content:center !important;' +
        '}',
        defaultSelectorHandlers);
    });

    it('supports other selector handlers', () => {
        const handler = (selector, baseSelector, callback) => {
            if (selector[0] !== '^') {
                return null;
            }
            return callback(`.${selector.slice(1)} ${baseSelector}`);
        };

        assertCSS('.foo', [{
            '^bar': {
                color: 'red',
            },
            color: 'blue',
        }], '.foo{color:blue;}.bar .foo{color:red;}', [handler], {}, false);
    });

    it('correctly prefixes border-color transition properties', () => {
        assertCSS('.foo', [{
            'transition': 'border-color 200ms linear'
        }], '.foo{' +
          '-webkit-transition:border-color 200ms linear !important;' +
          '-moz-transition:border-color 200ms linear !important;' +
          'transition:border-color 200ms linear !important;' +
      '}');
    });

    // TODO(emily): In the future, filter out null values.
    it('handles nullish values', () => {
        assertCSS('.foo', [{
            'color': null,
            'margin': undefined,
        }], '.foo{' +
          'color:null !important;' +
          'margin:undefined !important;' +
      '}');
    });
});

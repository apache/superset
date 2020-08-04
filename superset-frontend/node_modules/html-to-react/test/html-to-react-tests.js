'use strict';
const assert = require('assert');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const R = require('ramda');

const Parser = require('..').Parser;
const ProcessNodeDefinitions = require('..').ProcessNodeDefinitions;

describe('Html2React', function () {
  const parser = new Parser();

  describe('parse valid HTML', function () {
    it('should return a valid HTML string', function () {
      const htmlInput = '<p>Does this work?</p>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlInput);
    });

    it('should return a valid HTML string with nested elements', function () {
      const htmlInput = '<div><h1>Heading</h1></div>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlInput);
    });

    it('should return a valid HTML string with inline styles', function () {
      const htmlInput = '<div style="background-image:url(' +
        '&quot;http://lorempixel.com/400/200/&quot;);background-color:red;color:white;' +
        'font-family:&quot;Open Sans&quot;"></div>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlInput);
    });

    it('should return a valid HTML string with inline image in style', function () {
      const htmlInput = '<div style="background:url(' +
        'data:image/png;base64,iVBORw0KGgoAAA);color:white;' +
        'font-family:&quot;Open Sans&quot;"></div>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlInput);
    });

    it('should return a valid HTML string with empty inline styles', function () {
      const htmlInput = '<div style=""></div>';
      const htmlExpected = '<div></div>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlExpected);
    });

    it('should return a valid HTML string with data attributes', function () {
      const htmlInput = '<div data-test-attribute="data attribute value"></div>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlInput);
    });

    it('should return a valid HTML string with aria attributes', function () {
      const htmlInput = '<div aria-labelledby="label1"></div>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlInput);
    });

    it('should return a valid HTML string with a class attribute', function () {
      const htmlInput = '<div class="class-one"></div>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlInput);
    });

    it('should return a valid HTML string with a for attribute', function () {
      const htmlInput = '<label for="input"></label>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlInput);
    });

    it('should return a valid HTML string with a react camelCase attribute', function () {
      const htmlInput = '<div contenteditable="true"></div>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlInput);
    });

    it('should handle dashed attributes', function () {
      const input = '<form accept-charset="en"><svg viewBox="0 0 10 10"><text text-anchor="left">' +
        '</text><circle stroke="black" stroke-width="42"></circle></svg></form>';
      const reactComponent = parser.parse(input);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, input);
    });

    // FIXME: See lib/process-node-definitions.js -> processDefaultNode()
    it.skip('should return a valid HTML string with comments', function () {
      const htmlInput = '<div><!-- This is a comment --></div>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlInput);
    });

    // FIXME: If / when React implements HTML comments, this test can be removed
    it('should return a valid HTML string without comments', function () {
      const htmlInput = '<div><!-- This is a comment --></div>';
      const htmlExpected = '<div></div>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlExpected);
    });

    it('should parse br elements without warnings', function () {
      const htmlInput = '<div><p>Line one<br>Line two<br/>Line three</p></div>';
      const htmlExpected = '<div><p>Line one<br/>Line two<br/>Line three</p></div>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlExpected);
    });

    it('should not generate children for br tags', function () {
      const htmlInput = '<br/>';

      const reactComponent = parser.parse(htmlInput);
      assert.strictEqual((reactComponent.props.children || []).length, 0);
    });

    it('should parse void elements with all attributes and no warnings', function () {
      const htmlInput = '<p><img src="www.google.ca/logo.png"/></p>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlInput);
    });

    // Covers issue #9
    it('should parse textarea elements', function () {
      const htmlInput = '<textarea></textarea>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlInput);
    });

    it('should generate keys for sequence items', function () {
      const htmlInput = '<ul><li>Item 1</li><li>Item 2</li><</ul>';

      const reactComponent = parser.parse(htmlInput);

      const children = R.filter(function (c) {
        return R.has('key', c);
      }, R.flatten(reactComponent.props.children));
      const keys = R.map(function (child) {
        return child.key;
      }, children);
      assert.deepStrictEqual(keys, ['0', '1', ]);
    });

    it('should parse br elements without warnings', function () {
      const htmlInput = '<div><p>Line one<br>Line two<br/>Line three</p></div>';
      const htmlExpected = '<div><p>Line one<br/>Line two<br/>Line three</p></div>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlExpected);
    });

    it('should parse src elements with all attributes but without warnings', function () {
      const htmlInput = '<p><img src="www.google.ca/logo.png"/></p>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlInput);
    });

    it('should decode character entities in text nodes', function () {
      const htmlInput = '<div>1 &lt; 2</div>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlInput);
    });

    it('should not generate children for childless elements', function () {
      const htmlInput = '<div></div>';

      const reactComponent = parser.parse(htmlInput);

      assert.strictEqual((reactComponent.props.children || []).length, 0);
    });

    it('should fill in the key name with boolean attribute', function () {
      const htmlInput = '<input type="checkbox" disabled required/>';
      const htmlExpected = '<input type="checkbox" disabled="" required=""/>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlExpected);
    });

    it('should decode attribute values to avoid React re-encoding them', function () {
      const htmlInput = '<p><a href="http://domain.com/search?query=1&amp;lang=en">A link</a></p>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlInput);
    });

    it('should handle spaces in inline styles', function () {
      const htmlInput = '<p style="text-align: center"></p>';

      const reactComponent = parser.parse(htmlInput);

      assert.equal(reactComponent.props.style.textAlign, 'center');
    });

    it('should handle doctype directives', function () {
      const htmlInput = '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.0 Transitional//EN" ' +
      '"http://www.w3.org/TR/REC-html40/loose.dtd"><html><body><div></div></body></html>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, '<html><body><div></div></body></html>');
    });

    it('should handle free text nodes', function () {
      const htmlInput = 'text<div></div>text';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, 'text<div></div>text');
    });

    it('should handle onclick attributes', function () {
      const htmlInput = '<button onclick="alert(\'hello!\')">Hello</button>';

      const reactElem = parser.parse(htmlInput);

      assert.strictEqual(reactElem.props.onClick, 'alert(\'hello!\')');
    });
  });

  describe('parse invalid HTML', function () {
    it('should fix missing closing tags', function () {
      const htmlInput = '<div><p></div>';
      const htmlExpected = '<div><p></p></div>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlExpected);
    });

    it('should handle invalid style tag', function () {
      const htmlInput = '<div style="color:black;href="></div>';
      const htmlExpected = '<div style="color:black"></div>';

      const reactComponent = parser.parse(htmlInput);
      const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

      assert.equal(reactHtml, htmlExpected);
    });
  });

  describe('with custom processing instructions', function () {
    const parser = new Parser();
    const processNodeDefinitions = new ProcessNodeDefinitions(React);

    describe('parse valid HTML', function () {
      it('should return nothing with only a single <p> element', function () {
        const htmlInput = '<p>Does this work?</p>';
        const isValidNode = function () {
          return true;
        };
        const processingInstructions = [{
          shouldProcessNode: function (node) {
            return node.name && node.name !== 'p';
          },
          processNode: processNodeDefinitions.processDefaultNode,
        },];
        const reactComponent = parser.parseWithInstructions(htmlInput, isValidNode,
          processingInstructions);

          // With only 1 <p> element, nothing is rendered
          assert.equal(reactComponent, false);
      });

      it('should return a single <h1> element within a div of <h1> and <p> as siblings',
          function () {
        const htmlInput = '<div><h1>Title</h1><p>Paragraph</p></div>';
        const htmlExpected = '<div><h1>Title</h1></div>';

        const isValidNode = function () {
          return true;
        };

        const processingInstructions = [{
          shouldProcessNode: function (node) {
            return node.type === 'text' || node.name !== 'p';
          },
          processNode: processNodeDefinitions.processDefaultNode,
        },];
        const reactComponent = parser.parseWithInstructions(htmlInput, isValidNode,
          processingInstructions);
        const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);
        assert.equal(reactHtml, htmlExpected);
      });

      it('should replace the children of an element if configured so', function () {
        const htmlInput = '<div><div data-test="foo"><p>Text</p><p>Text</p></div></div>';
        const htmlExpected = '<div><div data-test="foo"><h1>Heading</h1></div></div>';

        const isValidNode = function () {
          return true;
        };

        const processingInstructions = [
          {
            replaceChildren: true,
            shouldProcessNode: function (node) {
              return (node.attribs || {})['data-test'] === 'foo';
            },
            processNode: function (node, children, index) {
              return React.createElement('h1', {key: index,}, 'Heading');
            },
          },
          {
            // Anything else
            shouldProcessNode: function (node) {
              return true;
            },
            processNode: processNodeDefinitions.processDefaultNode,
          },
        ];

        const reactComponent = parser.parseWithInstructions(htmlInput, isValidNode,
          processingInstructions);
        const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);
        assert.equal(reactHtml, htmlExpected);
      });

      it('should return capitalized content for all <h1> elements', function () {
        const htmlInput = '<div><h1>Title</h1><p>Paragraph</p>' +
        '<h1>Another title</h1></div>';
        const htmlExpected = '<div><h1>TITLE</h1><p>Paragraph</p>' +
        '<h1>ANOTHER TITLE</h1></div>';

        const isValidNode = function () {
          return true;
        };

        const processingInstructions = [
          {
            // Custom <h1> processing
            shouldProcessNode: function (node) {
              return node.parent && node.parent.name &&
              node.parent.name === 'h1';
            },
            processNode: function (node, children) {
              return node.data.toUpperCase();
            },
          }, {
            // Anything else
            shouldProcessNode: function (node) {
              return true;
            },
            processNode: processNodeDefinitions.processDefaultNode,
          },
        ];
        const reactComponent = parser.parseWithInstructions(htmlInput, isValidNode,
          processingInstructions);
        const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);
        assert.equal(reactHtml, htmlExpected);
      });

      it('should return false in case of invalid node', function () {
        const htmlInput = '<p></p>';
        const processingInstructions = [{
          shouldProcessNode: function (node) { return true; },
          processNode: processNodeDefinitions.processDefaultNode,
        }, ];
        const reactComponent = parser.parseWithInstructions(htmlInput,
          function () { return false; }, processingInstructions);

        assert.equal(reactComponent, false);
      });

      it('should generate only valid children', function () {
        const htmlInput = '<div> <p></p> <p></p> </div>';

        const processingInstructions = [{
          shouldProcessNode: function (node) { return true; },
          processNode: processNodeDefinitions.processDefaultNode,
        }, ];
        const reactComponent = parser.parseWithInstructions(htmlInput, function (node) {
          // skip whitespace text nodes to clean up children
          if (node.type === 'text') {
            return node.data.trim() !== '';
          }
          return true;
        }, processingInstructions);

        assert.equal(reactComponent.props.children.length, 2);
      });

      it('should not affect unhandled whitespace', function () {
        const htmlInput = '<div> <p></p> <p></p> </div>';

        const reactComponent = parser.parse(htmlInput);

        assert.equal(reactComponent.props.children.length, 5);
      });
    });

    it('should support preprocessing instructions', function () {
      var htmlInput = '<div>' +
        '<div id="first" data-process="shared"><p>Sample For First</p></div>' +
        '<div id="second" data-process="shared"><p>Sample For Second</p></div>' +
        '</div>';
      var htmlExpected = '<div><h1 id="preprocessed-first">First</h1>' +
        '<h2 id="preprocessed-second">Second</h2></div>';

      var isValidNode = function () {
        return true;
      };
      // We have two preprocessing instructions; the first sets the attribute data-preprocessed,
      // and the second one changes the ID of nodes that have the data-preprocessed attribute
      // (i.e., it will only affect nodes touched by the previous preprocessor).
      var preprocessingInstructions = [
        {
          shouldPreprocessNode: function (node) {
            return (node.attribs || {})['data-process'] === 'shared';
          },
          preprocessNode: function (node) {
            if (node.attribs == null) {
              node.attribs = {};
            }
            node.attribs['data-preprocessed'] = 'true';
          },
        },
        {
          shouldPreprocessNode: function (node) {
            return (node.attribs || {})['data-preprocessed'] === 'true';
          },
          preprocessNode: function (node) {
            node.attribs.id = `preprocessed-${node.attribs.id}`;
          },
        },
      ];
      var processingInstructions = [
        {
          shouldProcessNode: function (node) {
            return (node.attribs || {}).id === 'preprocessed-first';
          },
          processNode: function (node, children, index) {
            return React.createElement('h1', {
              key: index,
              id: node.attribs.id,
            }, 'First');
          },
        },
        {
          shouldProcessNode: function (node) {
            return (node.attribs || {}).id === 'preprocessed-second';
          },
          processNode: function (node, children, index) {
            return React.createElement('h2', {
              key: index,
              id: node.attribs.id,
            }, 'Second');
          },
        },
        {
          shouldProcessNode: function () {
            return true;
          },
          processNode: processNodeDefinitions.processDefaultNode,
        },
      ];
      var reactComponent = parser.parseWithInstructions(htmlInput, isValidNode,
        processingInstructions, preprocessingInstructions);

      var reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);
      assert.strictEqual(reactHtml, htmlExpected);
    });
  });

  describe('parse SVG', function () {
    it('should have correct attributes', function () {
      const input2RegExp = {
        '<svg><image xlink:href="http://i.imgur.com/w7GCRPb.png"/></svg>':
          /<svg><image xlink:href="http:\/\/i\.imgur\.com\/w7GCRPb\.png"/,
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"></svg>':
          // eslint-disable-next-line max-len
          /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"><\/svg>/,
      };
      R.forEach(function (inputAndRegExp) {
        const input = inputAndRegExp[0], regExp = inputAndRegExp[1];
        const reactComponent = parser.parse(input);
        const reactHtml = ReactDOMServer.renderToStaticMarkup(reactComponent);

        assert(regExp.test(reactHtml), reactHtml + ' has expected attributes');
      }, R.toPairs(input2RegExp));
    });
  });

  describe('parsing multiple elements', function () {
    it('should result in a list of React elements', function () {
      const htmlInput = '<div></div><div></div>';
      const elements = parser.parse(htmlInput);
      const output = elements.map(ReactDOMServer.renderToStaticMarkup).join('');
      assert.equal(htmlInput, output);
    });
  });
});

'use strict';
/*jshint asi: true, browser: true */

var test = require('tape');

+function setup() {

  function createEditorElem(lang) {
    var elem = document.createElement('div')
    elem.setAttribute('id', lang + '-editor')
    elem.setAttribute('class', 'editor')
    document.body.appendChild(elem)
  }

  function loadStyle() {
    var css = require('./stringified/style');
    var head   =  document.getElementsByTagName('head')[0];
    var style =  document.createElement('style');

    style.type = 'text/css';

    if (style.styleSheet){
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
    head.appendChild(style);
  }

  ['javascript', 'coffee', 'json', 'lua', 'xml'].forEach(createEditorElem);
  loadStyle();

  require('./fixtures/javascript-editor');
  require('./fixtures/coffee-editor');
  require('./fixtures/json-editor');
  require('./fixtures/lua-editor');
  require('./fixtures/xml-editor');
}()

test('error annotations provided by inlined worker', function (t) {
  function getError(lang) {
    var editor = document.getElementById(lang + '-editor');
    var errors = editor.getElementsByClassName('ace_error')
    return { length: errors.length, line: errors[0] && errors[0].textContent }
  }

  // give editors time to initialize and workers to do the annotations
  var jsCount     =  0
    , coffeeCount =  0
    , jsonCount   =  0
    , luaCount    =  0
    , xmlCount   =  0;

  var max = 10; // give it a max of 10 seconds

  +function javascript() {
    var err = getError('javascript')
    if (!err.length && ++jsCount < max) return setTimeout(javascript, 1000)

    t.equal(err.length, 1, 'javascript editor shows one error')
    t.equal(err.line, '5', 'on line 5')
  }()

  +function coffee() {
    var err = getError('coffee')
    if (!err.length && ++coffeeCount < max) return setTimeout(coffee, 1000)

    t.equal(err.length, 1, 'coffee editor shows one error')
    t.equal(err.line, '5', 'on line 5')
  }()

  +function json() {
    var err = getError('json')
    if (!err.length && ++jsonCount < max) return setTimeout(json, 1000)

    t.equal(err.length, 1, 'json editor shows one error')
    t.equal(err.line, '5', 'on line 5')
  }()

  +function lua() {
    var err = getError('lua')
    if (!err.length && ++luaCount < max) return setTimeout(lua, 1000)

    t.equal(err.length, 1, 'lua editor shows one error')
    t.equal(err.line, '6', 'on line 6')

    t.end()
  }()
  +function xml() {
    var err = getError('xml')
    if (!err.length && ++xmlCount < max) return setTimeout(xml, 1000)

    t.equal(err.length, 1, 'xml editor shows one error')
    t.equal(err.line, '5', 'on line 5')
  }()
})

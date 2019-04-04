var ace = require('brace');
require('brace/mode/javascript');
require('brace/theme/monokai');
require('brace/keybinding/vim');

var editor = ace.edit('javascript-editor');
editor.getSession().setMode('ace/mode/javascript');
editor.setTheme('ace/theme/monokai');
editor.setKeyboardHandler('ace/keyboard/vim');
editor.setValue([
    '// JavaScript'
  , 'var a = 3;'
  , ''
  , '// below line has an error which is annotated'
  , 'var b ='
  ].join('\n')
);
editor.clearSelection();

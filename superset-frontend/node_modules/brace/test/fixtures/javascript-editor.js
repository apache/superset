var ace = require('../..');
require('../../mode/javascript');
require('../../theme/monokai');

var editor = ace.edit('javascript-editor');
editor.getSession().setMode('ace/mode/javascript');
editor.setTheme('ace/theme/monokai');
editor.setValue([
    '// JavaScript'
  , 'var a = 3;'
  , ''
  , '// below line has an error which is annotated'
  , 'var b ='
  ].join('\n')
);
editor.clearSelection();

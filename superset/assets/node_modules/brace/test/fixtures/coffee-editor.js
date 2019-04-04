var ace = require('../..');
require('../../mode/coffee');
require('../../theme/vibrant_ink');

var editor = ace.edit('coffee-editor');
editor.setTheme('ace/theme/vibrant_ink');
editor.getSession().setMode('ace/mode/coffee');
editor.setValue([
    '# Coffee'
  , 'square = (x) -> x * x'
  , ''
  , '# below line has an error which is annotated'
  , 'square = x -> x * '
  ].join('\n')
);
editor.clearSelection();

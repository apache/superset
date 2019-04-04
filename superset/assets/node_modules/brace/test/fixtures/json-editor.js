var ace = require('../..');
require('../../mode/json');
require('../../theme/solarized_light');

var editor = ace.edit('json-editor');
editor.getSession().setMode('ace/mode/json');
editor.setTheme('ace/theme/solarized_light');
editor.setValue([
    '{'
  , ' "language": "JSON",'
  , ' "foo": "bar",'
  , ' "trailing": "comma",'
  , '}'
  ].join('\n')
);
editor.clearSelection();

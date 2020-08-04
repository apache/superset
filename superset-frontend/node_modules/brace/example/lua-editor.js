var ace = require('brace');
require('brace/mode/lua');
require('brace/theme/solarized_dark');

var editor = ace.edit('lua-editor');
editor.setTheme('ace/theme/solarized_dark');
editor.getSession().setMode('ace/mode/lua');
editor.setValue([
    '--- Lua'
  , 'for i = 5, 11, 0.5 do'
  , '    print(i)'
  , 'end'
  , '--- error below should be marked'
  , 'for i ='
  ].join('\n')
);
editor.clearSelection();

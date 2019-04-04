var ace = require('../..');
require('../../mode/xml');
require('../../theme/tomorrow_night_bright');

var editor = ace.edit('xml-editor');
editor.getSession().setMode('ace/mode/xml');
editor.setTheme('ace/theme/tomorrow_night_bright');
editor.setValue([
    '<root>'
  , '  <some>content</some>'
  , '  <with an="attribute"></with>'
  , '  <invalid>tagname<>'
  , '</root>'
  ].join('\n')
);
editor.clearSelection();

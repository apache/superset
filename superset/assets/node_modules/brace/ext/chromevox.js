ace.define("ace/ext/chromevox",["require","exports","module","ace/editor","ace/config"], function(acequire, exports, module) {
var cvoxAce = {};
cvoxAce.SpeechProperty;
cvoxAce.Cursor;
cvoxAce.Token;
cvoxAce.Annotation;
var CONSTANT_PROP = {
  'rate': 0.8,
  'pitch': 0.4,
  'volume': 0.9
};
var DEFAULT_PROP = {
  'rate': 1,
  'pitch': 0.5,
  'volume': 0.9
};
var ENTITY_PROP = {
  'rate': 0.8,
  'pitch': 0.8,
  'volume': 0.9
};
var KEYWORD_PROP = {
  'rate': 0.8,
  'pitch': 0.3,
  'volume': 0.9
};
var STORAGE_PROP = {
  'rate': 0.8,
  'pitch': 0.7,
  'volume': 0.9
};
var VARIABLE_PROP = {
  'rate': 0.8,
  'pitch': 0.8,
  'volume': 0.9
};
var DELETED_PROP = {
  'punctuationEcho': 'none',
  'relativePitch': -0.6
};
var ERROR_EARCON = 'ALERT_NONMODAL';
var MODE_SWITCH_EARCON = 'ALERT_MODAL';
var NO_MATCH_EARCON = 'INVALID_KEYPRESS';
var INSERT_MODE_STATE = 'insertMode';
var COMMAND_MODE_STATE = 'start';

var REPLACE_LIST = [
  {
    substr: ';',
    newSubstr: ' semicolon '
  },
  {
    substr: ':',
    newSubstr: ' colon '
  }
];
var Command = {
  SPEAK_ANNOT: 'annots',
  SPEAK_ALL_ANNOTS: 'all_annots',
  TOGGLE_LOCATION: 'toggle_location',
  SPEAK_MODE: 'mode',
  SPEAK_ROW_COL: 'row_col',
  TOGGLE_DISPLACEMENT: 'toggle_displacement',
  FOCUS_TEXT: 'focus_text'
};
var KEY_PREFIX = 'CONTROL + SHIFT ';
cvoxAce.editor = null;
var lastCursor = null;
var annotTable = {};
var shouldSpeakRowLocation = false;
var shouldSpeakDisplacement = false;
var changed = false;
var vimState = null;
var keyCodeToShortcutMap = {};
var cmdToShortcutMap = {};
var getKeyShortcutString = function(keyCode) {
  return KEY_PREFIX + String.fromCharCode(keyCode);
};
var isVimMode = function() {
  var keyboardHandler = cvoxAce.editor.keyBinding.getKeyboardHandler();
  return keyboardHandler.$id === 'ace/keyboard/vim';
};
var getCurrentToken = function(cursor) {
  return cvoxAce.editor.getSession().getTokenAt(cursor.row, cursor.column + 1);
};
var getCurrentLine = function(cursor) {
  return cvoxAce.editor.getSession().getLine(cursor.row);
};
var onRowChange = function(currCursor) {
  if (annotTable[currCursor.row]) {
    cvox.Api.playEarcon(ERROR_EARCON);
  }
  if (shouldSpeakRowLocation) {
    cvox.Api.stop();
    speakChar(currCursor);
    speakTokenQueue(getCurrentToken(currCursor));
    speakLine(currCursor.row, 1);
  } else {
    speakLine(currCursor.row, 0);
  }
};
var isWord = function(cursor) {
  var line = getCurrentLine(cursor);
  var lineSuffix = line.substr(cursor.column - 1);
  if (cursor.column === 0) {
    lineSuffix = ' ' + line;
  }
  var firstWordRegExp = /^\W(\w+)/;
  var words = firstWordRegExp.exec(lineSuffix);
  return words !== null;
};
var rules = {
  'constant': {
    prop: CONSTANT_PROP
  },
  'entity': {
    prop: ENTITY_PROP
  },
  'keyword': {
    prop: KEYWORD_PROP
  },
  'storage': {
    prop: STORAGE_PROP
  },
  'variable': {
    prop: VARIABLE_PROP
  },
  'meta': {
    prop: DEFAULT_PROP,
    replace: [
      {
        substr: '</',
        newSubstr: ' closing tag '
      },
      {
        substr: '/>',
        newSubstr: ' close tag '
      },
      {
        substr: '<',
        newSubstr: ' tag start '
      },
      {
        substr: '>',
        newSubstr: ' tag end '
      }
    ]
  }
};
var DEFAULT_RULE = {
  prop: DEFAULT_RULE
};
var expand = function(value, replaceRules) {
  var newValue = value;
  for (var i = 0; i < replaceRules.length; i++) {
    var replaceRule = replaceRules[i];
    var regexp = new RegExp(replaceRule.substr, 'g');
    newValue = newValue.replace(regexp, replaceRule.newSubstr);
  }
  return newValue;
};
var mergeTokens = function(tokens, start, end) {
  var newToken = {};
  newToken.value = '';
  newToken.type = tokens[start].type;
  for (var j = start; j < end; j++) {
    newToken.value += tokens[j].value;
  }
  return newToken;
};
var mergeLikeTokens = function(tokens) {
  if (tokens.length <= 1) {
    return tokens;
  }
  var newTokens = [];
  var lastLikeIndex = 0;
  for (var i = 1; i < tokens.length; i++) {
    var lastLikeToken = tokens[lastLikeIndex];
    var currToken = tokens[i];
    if (getTokenRule(lastLikeToken) !== getTokenRule(currToken)) {
      newTokens.push(mergeTokens(tokens, lastLikeIndex, i));
      lastLikeIndex = i;
    }
  }
  newTokens.push(mergeTokens(tokens, lastLikeIndex, tokens.length));
  return newTokens;
};
var isRowWhiteSpace = function(row) {
  var line = cvoxAce.editor.getSession().getLine(row);
  var whiteSpaceRegexp = /^\s*$/;
  return whiteSpaceRegexp.exec(line) !== null;
};
var speakLine = function(row, queue) {
  var tokens = cvoxAce.editor.getSession().getTokens(row);
  if (tokens.length === 0 || isRowWhiteSpace(row)) {
    cvox.Api.playEarcon('EDITABLE_TEXT');
    return;
  }
  tokens = mergeLikeTokens(tokens);
  var firstToken = tokens[0];
  tokens = tokens.filter(function(token) {
    return token !== firstToken;
  });
  speakToken_(firstToken, queue);
  tokens.forEach(speakTokenQueue);
};
var speakTokenFlush = function(token) {
  speakToken_(token, 0);
};
var speakTokenQueue = function(token) {
  speakToken_(token, 1);
};
var getTokenRule = function(token) {
  if (!token || !token.type) {
    return;
  }
  var split = token.type.split('.');
  if (split.length === 0) {
    return;
  }
  var type = split[0];
  var rule = rules[type];
  if (!rule) {
    return DEFAULT_RULE;
  }
  return rule;
};
var speakToken_ = function(token, queue) {
  var rule = getTokenRule(token);
  var value = expand(token.value, REPLACE_LIST);
  if (rule.replace) {
    value = expand(value, rule.replace);
  }
  cvox.Api.speak(value, queue, rule.prop);
};
var speakChar = function(cursor) {
  var line = getCurrentLine(cursor);
  cvox.Api.speak(line[cursor.column], 1);
};
var speakDisplacement = function(lastCursor, currCursor) {
  var line = getCurrentLine(currCursor);
  var displace = line.substring(lastCursor.column, currCursor.column);
  displace = displace.replace(/ /g, ' space ');
  cvox.Api.speak(displace);
};
var speakCharOrWordOrLine = function(lastCursor, currCursor) {
  if (Math.abs(lastCursor.column - currCursor.column) !== 1) {
    var currLineLength = getCurrentLine(currCursor).length;
    if (currCursor.column === 0 || currCursor.column === currLineLength) {
      speakLine(currCursor.row, 0);
      return;
    }
    if (isWord(currCursor)) {
      cvox.Api.stop();
      speakTokenQueue(getCurrentToken(currCursor));
      return;
    }
  }
  speakChar(currCursor);
};
var onColumnChange = function(lastCursor, currCursor) {
  if (!cvoxAce.editor.selection.isEmpty()) {
    speakDisplacement(lastCursor, currCursor);
    cvox.Api.speak('selected', 1);
  }
  else if (shouldSpeakDisplacement) {
    speakDisplacement(lastCursor, currCursor);
  } else {
    speakCharOrWordOrLine(lastCursor, currCursor);
  }
};
var onCursorChange = function(evt) {
  if (changed) {
    changed = false;
    return;
  }
  var currCursor = cvoxAce.editor.selection.getCursor();
  if (currCursor.row !== lastCursor.row) {
    onRowChange(currCursor);
  } else {
    onColumnChange(lastCursor, currCursor);
  }
  lastCursor = currCursor;
};
var onSelectionChange = function(evt) {
  if (cvoxAce.editor.selection.isEmpty()) {
    cvox.Api.speak('unselected');
  }
};
var onChange = function(delta) {
  switch (delta.action) {
  case 'remove':
    cvox.Api.speak(delta.text, 0, DELETED_PROP);
    changed = true;
    break;
  case 'insert':
    cvox.Api.speak(delta.text, 0);
    changed = true;
    break;
  }
};
var isNewAnnotation = function(annot) {
  var row = annot.row;
  var col = annot.column;
  return !annotTable[row] || !annotTable[row][col];
};
var populateAnnotations = function(annotations) {
  annotTable = {};
  for (var i = 0; i < annotations.length; i++) {
    var annotation = annotations[i];
    var row = annotation.row;
    var col = annotation.column;
    if (!annotTable[row]) {
      annotTable[row] = {};
    }
    annotTable[row][col] = annotation;
  }
};
var onAnnotationChange = function(evt) {
  var annotations = cvoxAce.editor.getSession().getAnnotations();
  var newAnnotations = annotations.filter(isNewAnnotation);
  if (newAnnotations.length > 0) {
    cvox.Api.playEarcon(ERROR_EARCON);
  }
  populateAnnotations(annotations);
};
var speakAnnot = function(annot) {
  var annotText = annot.type + ' ' + annot.text + ' on ' +
      rowColToString(annot.row, annot.column);
  annotText = annotText.replace(';', 'semicolon');
  cvox.Api.speak(annotText, 1);
};
var speakAnnotsByRow = function(row) {
  var annots = annotTable[row];
  for (var col in annots) {
    speakAnnot(annots[col]);
  }
};
var rowColToString = function(row, col) {
  return 'row ' + (row + 1) + ' column ' + (col + 1);
};
var speakCurrRowAndCol = function() {
  cvox.Api.speak(rowColToString(lastCursor.row, lastCursor.column));
};
var speakAllAnnots = function() {
  for (var row in annotTable) {
    speakAnnotsByRow(row);
  }
};
var speakMode = function() {
  if (!isVimMode()) {
    return;
  }
  switch (cvoxAce.editor.keyBinding.$data.state) {
  case INSERT_MODE_STATE:
    cvox.Api.speak('Insert mode');
    break;
  case COMMAND_MODE_STATE:
    cvox.Api.speak('Command mode');
    break;
  }
};
var toggleSpeakRowLocation = function() {
  shouldSpeakRowLocation = !shouldSpeakRowLocation;
  if (shouldSpeakRowLocation) {
    cvox.Api.speak('Speak location on row change enabled.');
  } else {
    cvox.Api.speak('Speak location on row change disabled.');
  }
};
var toggleSpeakDisplacement = function() {
  shouldSpeakDisplacement = !shouldSpeakDisplacement;
  if (shouldSpeakDisplacement) {
    cvox.Api.speak('Speak displacement on column changes.');
  } else {
    cvox.Api.speak('Speak current character or word on column changes.');
  }
};
var onKeyDown = function(evt) {
  if (evt.ctrlKey && evt.shiftKey) {
    var shortcut = keyCodeToShortcutMap[evt.keyCode];
    if (shortcut) {
      shortcut.func();
    }
  }
};
var onChangeStatus = function(evt, editor) {
  if (!isVimMode()) {
    return;
  }
  var state = editor.keyBinding.$data.state;
  if (state === vimState) {
    return;
  }
  switch (state) {
  case INSERT_MODE_STATE:
    cvox.Api.playEarcon(MODE_SWITCH_EARCON);
    cvox.Api.setKeyEcho(true);
    break;
  case COMMAND_MODE_STATE:
    cvox.Api.playEarcon(MODE_SWITCH_EARCON);
    cvox.Api.setKeyEcho(false);
    break;
  }
  vimState = state;
};
var contextMenuHandler = function(evt) {
  var cmd = evt.detail['customCommand'];
  var shortcut = cmdToShortcutMap[cmd];
  if (shortcut) {
    shortcut.func();
    cvoxAce.editor.focus();
  }
};
var initContextMenu = function() {
  var ACTIONS = SHORTCUTS.map(function(shortcut) {
    return {
      desc: shortcut.desc + getKeyShortcutString(shortcut.keyCode),
      cmd: shortcut.cmd
    };
  });
  var body = document.querySelector('body');
  body.setAttribute('contextMenuActions', JSON.stringify(ACTIONS));
  body.addEventListener('ATCustomEvent', contextMenuHandler, true);
};
var onFindSearchbox = function(evt) {
  if (evt.match) {
    speakLine(lastCursor.row, 0);
  } else {
    cvox.Api.playEarcon(NO_MATCH_EARCON);
  }
};
var focus = function() {
  cvoxAce.editor.focus();
};
var SHORTCUTS = [
  {
    keyCode: 49,
    func: function() {
      speakAnnotsByRow(lastCursor.row);
    },
    cmd: Command.SPEAK_ANNOT,
    desc: 'Speak annotations on line'
  },
  {
    keyCode: 50,
    func: speakAllAnnots,
    cmd: Command.SPEAK_ALL_ANNOTS,
    desc: 'Speak all annotations'
  },
  {
    keyCode: 51,
    func: speakMode,
    cmd: Command.SPEAK_MODE,
    desc: 'Speak Vim mode'
  },
  {
    keyCode: 52,
    func: toggleSpeakRowLocation,
    cmd: Command.TOGGLE_LOCATION,
    desc: 'Toggle speak row location'
  },
  {
    keyCode: 53,
    func: speakCurrRowAndCol,
    cmd: Command.SPEAK_ROW_COL,
    desc: 'Speak row and column'
  },
  {
    keyCode: 54,
    func: toggleSpeakDisplacement,
    cmd: Command.TOGGLE_DISPLACEMENT,
    desc: 'Toggle speak displacement'
  },
  {
    keyCode: 55,
    func: focus,
    cmd: Command.FOCUS_TEXT,
    desc: 'Focus text'
  }
];
var onFocus = function(_, editor) {
  cvoxAce.editor = editor;
  editor.getSession().selection.on('changeCursor', onCursorChange);
  editor.getSession().selection.on('changeSelection', onSelectionChange);
  editor.getSession().on('change', onChange);
  editor.getSession().on('changeAnnotation', onAnnotationChange);
  editor.on('changeStatus', onChangeStatus);
  editor.on('findSearchBox', onFindSearchbox);
  editor.container.addEventListener('keydown', onKeyDown);

  lastCursor = editor.selection.getCursor();
};
var init = function(editor) {
  onFocus(null, editor);
  SHORTCUTS.forEach(function(shortcut) {
    keyCodeToShortcutMap[shortcut.keyCode] = shortcut;
    cmdToShortcutMap[shortcut.cmd] = shortcut;
  });

  editor.on('focus', onFocus);
  if (isVimMode()) {
    cvox.Api.setKeyEcho(false);
  }
  initContextMenu();
};
function cvoxApiExists() {
  return (typeof(cvox) !== 'undefined') && cvox && cvox.Api;
}
var tries = 0;
var MAX_TRIES = 15;
function watchForCvoxLoad(editor) {
  if (cvoxApiExists()) {
    init(editor);
  } else {
    tries++;
    if (tries >= MAX_TRIES) {
      return;
    }
    window.setTimeout(watchForCvoxLoad, 500, editor);
  }
}

var Editor = acequire('../editor').Editor;
acequire('../config').defineOptions(Editor.prototype, 'editor', {
  enableChromevoxEnhancements: {
    set: function(val) {
      if (val) {
        watchForCvoxLoad(this);
      }
    },
    value: true // turn it on by default or check for window.cvox
  }
});

});
                (function() {
                    ace.acequire(["ace/ext/chromevox"], function() {});
                })();
            
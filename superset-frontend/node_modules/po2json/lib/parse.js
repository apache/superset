/**
 * Parse PO buffer to JSON
 *
 * @param {Buffer|String} buffer - Buffer PO object or unicode string with PO data
 * @param {Object} [options]
 * @return {Object|String} Translation JSON
 */

module.exports = function(buffer, options) {

  // Setup options and load in defaults
  options = options || {};
  var defaults = {
    pretty: false,
    fuzzy: false,
    stringify: false,
    format: 'raw',
    domain: 'messages',
    charset: 'utf8'
  };

  for (var property in defaults) {
    options[property] = 'undefined' !== typeof options[property] ? options[property] : defaults[property];
  }

  // Parse the PO file
  var parsed = require('gettext-parser').po.parse( buffer, defaults.charset );

  // Create gettext/Jed compatible JSON from parsed data
  var result = {},
      contexts = parsed.translations;

  Object.keys(contexts).forEach(function (context) {
    var translations = parsed.translations[context];
    var pluralForms = parsed.headers ? parsed.headers['plural-forms'] : '';

    Object.keys(translations).forEach(function (key, i) {
      var t = translations[key],
          translationKey = context.length ? context + '\u0004' + key : key,
          fuzzy = t.comments && t.comments.flag && t.comments.flag.match(/fuzzy/) !== null;

      if (!fuzzy || options.fuzzy) {
        if (options.format === 'mf') {
          result[translationKey] = t.msgstr[0];
        } else if (options.format === 'jed1.x') {
          result[translationKey] = [ t.msgid_plural ? t.msgid_plural : null ].concat(t.msgstr);
        } else {
          if(pluralForms == 'nplurals=1; plural=0;') {
            msgstr = t.msgid_plural ? [t.msgstr] : t.msgstr
            result[translationKey] = [ t.msgid_plural ? t.msgid_plural : null ].concat(msgstr);
          } else {
            result[translationKey] = [ t.msgid_plural ? t.msgid_plural : null ].concat(t.msgstr);
          }
        }
      }

      // In the case of fuzzy or empty messages, use msgid(/msgid_plural)
      if (options['fallback-to-msgid'] && (fuzzy && !options.fuzzy || t.msgstr[0] === '')) {
        if (options.format === 'mf') {
          result[translationKey] = key;
        } else {
          result[translationKey] = [ t.msgid_plural ? t.msgid_plural : null ]
              .concat(t.msgid_plural ? [key, t.msgid_plural] : [key]);
        }
      }

    });
  });

  // Attach headers (overwrites any empty translation keys that may have somehow gotten in)
  if (parsed.headers) {
    result[''] = parsed.headers;
  }

  if (options.format === 'mf') {
    delete result[''];
  }

  // Make JSON fully Jed-compatible
  if (options.format.indexOf('jed') === 0) {
    var jed = {
      domain: options.domain,
      locale_data: {}
    };
    if (options.format === 'jed1.x'){
      for (var key in result) {
        if (result.hasOwnProperty(key) && key !== ''){
          for (var i = 2; i < result[key].length; i++){
            if ('' === result[key][i]){
              result[key][i] = result[key][0];
            }
          }
          result[key].shift();
        }
      }
    }
    jed.locale_data[options.domain] = result;
    jed.locale_data[options.domain][''] = {
      domain: options.domain,
      plural_forms: result['']['plural-forms'],
      lang: result['']['language']
    };

    result = jed;
  }

  return options.stringify ? JSON.stringify( result, null, options.pretty ? '   ' : null ) : result;
}

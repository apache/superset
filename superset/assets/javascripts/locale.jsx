import Jed from 'jed';
import React from 'react';
import { getTranslations } from './translations';
import { sprintf } from 'sprintf-js';
import { getLanguage } from './explore/stores/language';

let LOCALE_DEBUG = false;

if (sessionStorage && sessionStorage.getItem('localeDebug') == '1') {
  LOCALE_DEBUG = true;
}

export function setLocaleDebug(value) {
  sessionStorage.setItem('localeDebug', value ? '1' : '0');
}

let i18n = null;

export function setLocale(locale) {
  let translations = getTranslations(locale);
  i18n = new Jed({
    'domain' : 'superset',
    'missing_key_callback' : function(key) {
      // console.error(key)
    },
    'locale_data': {
      'superset': translations
    }
  });
}

setLocale(getLanguage());
// setLocale('zh');

function formatForReact(formatString, args) {
  let rv = [];
  let cursor = 0;

  sprintf.parse(formatString).forEach((match, idx) => {
    if (typeof match === 'string') {
      rv.push(match);
    } else {
      let arg = null;
      if (match[2]) {
        arg = args[0][match[2][0]];
      } else if (match[1]) {
        arg = args[parseInt(match[1], 10) - 1];
      } else {
        arg = args[cursor++];
      }

      if (React.isValidElement(arg)) {
        rv.push(React.cloneElement(arg, {key: idx}));
      } else {
        match[2] = null;
        match[1] = 1;
        rv.push(<span key={idx++}>
          {sprintf.format([match], [null, arg])}
        </span>);
      }
    }
  });

  return rv;
}

function argsInvolveReact(args) {
  if (args.some(React.isValidElement)) {
    return true;
  }
  if (args.length == 1 && typeof args[0] === 'object') {
    return Object.keys(args[0]).some((key) => {
      return React.isValidElement(args[0][key]);
    });
  }
  return false;
}

export function parseComponentTemplate(string) {
  let rv = {};

  function process(startPos, group, inGroup) {
    let regex = /\[(.*?)(:|\])|\]/g;
    let match;
    let buf = [];
    let satisfied = false;

    let pos = regex.lastIndex = startPos;
    while ((match = regex.exec(string)) !== null) {
      let substr = string.substr(pos, match.index - pos);
      if (substr !== '') {
        buf.push(substr);
      }

      if (match[0] == ']') {
        if (inGroup) {
          satisfied = true;
          break;
        } else {
          pos = regex.lastIndex;
          continue;
        }
      }

      if (match[2] == ']') {
        pos = regex.lastIndex;
      } else {
        pos = regex.lastIndex = process(regex.lastIndex, match[1], true);
      }
      buf.push({group: match[1]});
    }

    let endPos = regex.lastIndex;
    if (!satisfied) {
      let rest = string.substr(pos);
      if (rest) {
        buf.push(rest);
      }
      endPos = string.length;
    }

    rv[group] = buf;
    return endPos;
  }

  process(0, 'root', false);

  return rv;
}

export function renderComponentTemplate(template, components) {
  let idx = 0;
  function renderGroup(group) {
    let children = [];

    (template[group] || []).forEach((item) => {
      if (typeof item === 'string') {
        children.push(<span key={idx++}>{item}</span>);
      } else {
        children.push(renderGroup(item.group));
      }
    });

    let reference = components[group] || <span key={idx++} />;
    if (!React.isValidElement(reference)) {
      reference = <span key={idx++}>{reference}</span>;
    }

    if (children.length > 0) {
      return React.cloneElement(reference, {key: idx++}, children);
    } else {
      return React.cloneElement(reference, {key: idx++});
    }
  }

  return renderGroup('root');
}

function mark(rv) {
  if (!LOCALE_DEBUG) {
    return rv;
  }

  let proxy = {
    $$typeof: Symbol.for('react.element'),
    type: 'span',
    key: null,
    ref: null,
    props: {
      className: 'translation-wrapper',
      children: typeof rv === 'array' ? rv : [rv]
    },
    _owner: null,
    _store: {}
  };

  proxy.toString = function() {
    return '🇦🇹' + rv + '🇦🇹';
  };

  return proxy;
}

export function format(formatString, args) {
  if (argsInvolveReact(args)) {
    return formatForReact(formatString, args);
  } else {
    return sprintf(formatString, ...args);
  }
}

export function gettext(string, ...args) {
  let rv = i18n.gettext(string);
  if (args.length > 0) {
    rv = format(rv, args);
  }
  return mark(rv);
}

export function ngettext(singular, plural, ...args) {
  return mark(format(i18n.ngettext(singular, plural, args[0] || 0), args));
}

export function gettextComponentTemplate(template, components) {
  let tmpl = parseComponentTemplate(i18n.gettext(template));
  return mark(renderComponentTemplate(tmpl, components));
}

export const t = gettext;
export const tn = ngettext;
export const tct = gettextComponentTemplate;

import Jed from 'jed';
import React from 'react';
import { sprintf } from 'sprintf-js';
import { getTranslations } from './translations';
import { getLanguage } from './explore/stores/getLanguage';

let i18n = null;

export function setLocale(locale) {
  const translations = getTranslations(locale);
  i18n = new Jed({
    domain: 'superset',
    locale_data: {
      superset: translations,
    },
  });
}

setLocale(getLanguage());

function formatForReact(formatString, args) {
  const rv = [];
  let cursor = 0;
  sprintf.parse(formatString).forEach((match, idx) => {
    const cpoyMatch = match;
    let copyIdx = idx;
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
        rv.push(React.cloneElement(arg, { key: idx }));
      } else {
        cpoyMatch[2] = null;
        cpoyMatch[1] = 1;
        rv.push(<span key={copyIdx++}>
          {sprintf.format([cpoyMatch], [null, arg])}
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
  if (args.length === 1 && typeof args[0] === 'object') {
    return Object.keys(args[0]).some(function (key) {
      return React.isValidElement(args[0][key]);
    });
  }
  return false;
}

export function parseComponentTemplate(string) {
  const rv = {};
  function process(startPos, group, inGroup) {
    const regex = /\[(.*?)(:|\])|\]/g;
    let match;
    const buf = [];
    let satisfied = false;
    let pos = regex.lastIndex = startPos;
    match = regex.exec(string);
    while (match !== null) {
      const substr = string.substr(pos, match.index - pos);
      if (substr !== '') {
        buf.push(substr);
      }
      if (match[0] === ']') {
        if (inGroup) {
          satisfied = true;
          break;
        } else {
          pos = regex.lastIndex;
          continue;
        }
      }
      if (match[2] === ']') {
        pos = regex.lastIndex;
      } else {
        pos = regex.lastIndex = process(regex.lastIndex, match[1], true);
      }
      buf.push({ group: match[1] });
      match = regex.exec(string);
    }
    let endPos = regex.lastIndex;
    if (!satisfied) {
      const rest = string.substr(pos);
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
    const children = [];
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
      return React.cloneElement(reference, { key: idx++ }, children);
    }
    return React.cloneElement(reference, { key: idx++ });
  }
  return renderGroup('root');
}

function isArrayFn(value) {
  if (typeof Array.isArray === 'function') {
    return Array.isArray(value);
  }
  return Object.prototype.toString.call(value) === '[object Array]';
}

function mark(rv) {
  if (!LOCALE_DEBUG) {
    return rv;
  }
  const proxy = {
    $$typeof: Symbol.for('react.element'),
    type: 'span',
    key: null,
    ref: null,
    props: {
      className: 'translation-wrapper',
      children: isArrayFn(rv) ? rv : [rv],
    },
    _owner: null,
    _store: {},
  };
  proxy.toString = function () {
    return '🇦🇹' + rv + '🇦🇹';
  };
  return proxy;
}

export function format(formatString, args) {
  if (argsInvolveReact(args)) {
    return formatForReact(formatString, args);
  }
  return sprintf(formatString, ...args);
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
  const tmpl = parseComponentTemplate(i18n.gettext(template));
  return mark(renderComponentTemplate(tmpl, components));
}

export const t = gettext;
export const tn = ngettext;
export const tct = gettextComponentTemplate;

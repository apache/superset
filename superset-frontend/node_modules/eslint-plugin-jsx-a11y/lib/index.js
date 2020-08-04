'use strict';

/* eslint-disable global-require */

module.exports = {
  rules: {
    'accessible-emoji': require('./rules/accessible-emoji'),
    'alt-text': require('./rules/alt-text'),
    'anchor-has-content': require('./rules/anchor-has-content'),
    'anchor-is-valid': require('./rules/anchor-is-valid'),
    'aria-activedescendant-has-tabindex': require('./rules/aria-activedescendant-has-tabindex'),
    'aria-props': require('./rules/aria-props'),
    'aria-proptypes': require('./rules/aria-proptypes'),
    'aria-role': require('./rules/aria-role'),
    'aria-unsupported-elements': require('./rules/aria-unsupported-elements'),
    'click-events-have-key-events': require('./rules/click-events-have-key-events'),
    'heading-has-content': require('./rules/heading-has-content'),
    'href-no-hash': require('./rules/href-no-hash'),
    'html-has-lang': require('./rules/html-has-lang'),
    'iframe-has-title': require('./rules/iframe-has-title'),
    'img-redundant-alt': require('./rules/img-redundant-alt'),
    'interactive-supports-focus': require('./rules/interactive-supports-focus'),
    'label-has-for': require('./rules/label-has-for'),
    lang: require('./rules/lang'),
    'media-has-caption': require('./rules/media-has-caption'),
    'mouse-events-have-key-events': require('./rules/mouse-events-have-key-events'),
    'no-access-key': require('./rules/no-access-key'),
    'no-autofocus': require('./rules/no-autofocus'),
    'no-distracting-elements': require('./rules/no-distracting-elements'),
    'no-interactive-element-to-noninteractive-role': require('./rules/no-interactive-element-to-noninteractive-role'),
    'no-noninteractive-element-interactions': require('./rules/no-noninteractive-element-interactions'),
    'no-noninteractive-element-to-interactive-role': require('./rules/no-noninteractive-element-to-interactive-role'),
    'no-noninteractive-tabindex': require('./rules/no-noninteractive-tabindex'),
    'no-onchange': require('./rules/no-onchange'),
    'no-redundant-roles': require('./rules/no-redundant-roles'),
    'no-static-element-interactions': require('./rules/no-static-element-interactions'),
    'role-has-required-aria-props': require('./rules/role-has-required-aria-props'),
    'role-supports-aria-props': require('./rules/role-supports-aria-props'),
    scope: require('./rules/scope'),
    'tabindex-no-positive': require('./rules/tabindex-no-positive')
  },
  configs: {
    recommended: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      rules: {
        'jsx-a11y/accessible-emoji': 'error',
        'jsx-a11y/alt-text': 'error',
        'jsx-a11y/anchor-has-content': 'error',
        'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
        'jsx-a11y/aria-props': 'error',
        'jsx-a11y/aria-proptypes': 'error',
        'jsx-a11y/aria-role': 'error',
        'jsx-a11y/aria-unsupported-elements': 'error',
        'jsx-a11y/click-events-have-key-events': 'error',
        'jsx-a11y/heading-has-content': 'error',
        'jsx-a11y/href-no-hash': 'error',
        'jsx-a11y/html-has-lang': 'error',
        'jsx-a11y/iframe-has-title': 'error',
        'jsx-a11y/img-redundant-alt': 'error',
        'jsx-a11y/interactive-supports-focus': ['error', {
          tabbable: ['button', 'checkbox', 'link', 'searchbox', 'spinbutton', 'switch', 'textbox']
        }],
        'jsx-a11y/label-has-for': 'error',
        'jsx-a11y/media-has-caption': 'error',
        'jsx-a11y/mouse-events-have-key-events': 'error',
        'jsx-a11y/no-access-key': 'error',
        'jsx-a11y/no-autofocus': 'error',
        'jsx-a11y/no-distracting-elements': 'error',

        'jsx-a11y/no-interactive-element-to-noninteractive-role': ['error', {
          tr: ['none', 'presentation']
        }],
        'jsx-a11y/no-noninteractive-element-interactions': ['error', {
          handlers: ['onClick', 'onMouseDown', 'onMouseUp', 'onKeyPress', 'onKeyDown', 'onKeyUp']
        }],
        'jsx-a11y/no-noninteractive-element-to-interactive-role': ['error', {
          ul: ['listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'],
          ol: ['listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'],
          li: ['menuitem', 'option', 'row', 'tab', 'treeitem'],
          table: ['grid'],
          td: ['gridcell']
        }],
        'jsx-a11y/no-noninteractive-tabindex': ['error', {
          tags: [],
          roles: ['tabpanel']
        }],
        'jsx-a11y/no-onchange': 'error',
        'jsx-a11y/no-redundant-roles': 'error',
        'jsx-a11y/no-static-element-interactions': ['error', {
          handlers: ['onClick', 'onMouseDown', 'onMouseUp', 'onKeyPress', 'onKeyDown', 'onKeyUp']
        }],
        'jsx-a11y/role-has-required-aria-props': 'error',
        'jsx-a11y/role-supports-aria-props': 'error',
        'jsx-a11y/scope': 'error',
        'jsx-a11y/tabindex-no-positive': 'error'
      }
    },
    strict: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      rules: {
        'jsx-a11y/accessible-emoji': 'error',
        'jsx-a11y/alt-text': 'error',
        'jsx-a11y/anchor-has-content': 'error',
        'jsx-a11y/anchor-is-valid': 'error',
        'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
        'jsx-a11y/aria-props': 'error',
        'jsx-a11y/aria-proptypes': 'error',
        'jsx-a11y/aria-role': 'error',
        'jsx-a11y/aria-unsupported-elements': 'error',
        'jsx-a11y/click-events-have-key-events': 'error',
        'jsx-a11y/heading-has-content': 'error',
        'jsx-a11y/href-no-hash': 'error',
        'jsx-a11y/html-has-lang': 'error',
        'jsx-a11y/iframe-has-title': 'error',
        'jsx-a11y/img-redundant-alt': 'error',
        'jsx-a11y/interactive-supports-focus': ['error', {
          tabbable: ['button', 'checkbox', 'link', 'progressbar', 'searchbox', 'slider', 'spinbutton', 'switch', 'textbox']
        }],
        'jsx-a11y/label-has-for': 'error',
        'jsx-a11y/media-has-caption': 'error',
        'jsx-a11y/mouse-events-have-key-events': 'error',
        'jsx-a11y/no-access-key': 'error',
        'jsx-a11y/no-autofocus': 'error',
        'jsx-a11y/no-distracting-elements': 'error',
        'jsx-a11y/no-interactive-element-to-noninteractive-role': 'error',
        'jsx-a11y/no-noninteractive-element-interactions': 'error',
        'jsx-a11y/no-noninteractive-element-to-interactive-role': 'error',
        'jsx-a11y/no-noninteractive-tabindex': 'error',
        'jsx-a11y/no-onchange': 'error',
        'jsx-a11y/no-redundant-roles': 'error',
        'jsx-a11y/no-static-element-interactions': 'error',
        'jsx-a11y/role-has-required-aria-props': 'error',
        'jsx-a11y/role-supports-aria-props': 'error',
        'jsx-a11y/scope': 'error',
        'jsx-a11y/tabindex-no-positive': 'error'
      }
    }
  }
};
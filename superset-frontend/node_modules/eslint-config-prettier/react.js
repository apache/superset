"use strict";

const includeDeprecated = !process.env.ESLINT_CONFIG_PRETTIER_NO_DEPRECATED;

module.exports = {
  rules: Object.assign(
    {
      "react/jsx-child-element-spacing": "off",
      "react/jsx-closing-bracket-location": "off",
      "react/jsx-closing-tag-location": "off",
      "react/jsx-curly-newline": "off",
      "react/jsx-curly-spacing": "off",
      "react/jsx-equals-spacing": "off",
      "react/jsx-first-prop-new-line": "off",
      "react/jsx-indent": "off",
      "react/jsx-indent-props": "off",
      "react/jsx-max-props-per-line": "off",
      "react/jsx-one-expression-per-line": "off",
      "react/jsx-props-no-multi-spaces": "off",
      "react/jsx-tag-spacing": "off",
      "react/jsx-wrap-multilines": "off",
    },
    includeDeprecated && {
      // Deprecated since version 7.0.0.
      // https://github.com/yannickcr/eslint-plugin-react/blob/master/CHANGELOG.md#700---2017-05-06
      "react/jsx-space-before-closing": "off",
    }
  ),
};

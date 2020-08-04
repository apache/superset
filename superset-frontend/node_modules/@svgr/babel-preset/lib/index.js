"use strict";

exports.__esModule = true;
exports.default = void 0;

var _babelPluginAddJsxAttribute = _interopRequireDefault(require("@svgr/babel-plugin-add-jsx-attribute"));

var _babelPluginRemoveJsxAttribute = _interopRequireDefault(require("@svgr/babel-plugin-remove-jsx-attribute"));

var _babelPluginRemoveJsxEmptyExpression = _interopRequireDefault(require("@svgr/babel-plugin-remove-jsx-empty-expression"));

var _babelPluginReplaceJsxAttributeValue = _interopRequireDefault(require("@svgr/babel-plugin-replace-jsx-attribute-value"));

var _babelPluginSvgDynamicTitle = _interopRequireDefault(require("@svgr/babel-plugin-svg-dynamic-title"));

var _babelPluginSvgEmDimensions = _interopRequireDefault(require("@svgr/babel-plugin-svg-em-dimensions"));

var _babelPluginTransformReactNativeSvg = _interopRequireDefault(require("@svgr/babel-plugin-transform-react-native-svg"));

var _babelPluginTransformSvgComponent = _interopRequireDefault(require("@svgr/babel-plugin-transform-svg-component"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getAttributeValue(value) {
  const literal = typeof value === 'string' && value.startsWith('{') && value.endsWith('}');
  return {
    value: literal ? value.slice(1, -1) : value,
    literal
  };
}

function propsToAttributes(props) {
  return Object.keys(props).map(name => {
    const {
      literal,
      value
    } = getAttributeValue(props[name]);
    return {
      name,
      literal,
      value
    };
  });
}

function replaceMapToValues(replaceMap) {
  return Object.keys(replaceMap).map(value => {
    const {
      literal,
      value: newValue
    } = getAttributeValue(replaceMap[value]);
    return {
      value,
      newValue,
      literal
    };
  });
}

const plugin = (api, opts) => {
  let toRemoveAttributes = ['xmlns', 'xmlnsXlink', 'version'];
  let toAddAttributes = [];

  if (opts.svgProps) {
    toAddAttributes = [...toAddAttributes, ...propsToAttributes(opts.svgProps)];
  }

  if (opts.ref) {
    toAddAttributes = [...toAddAttributes, {
      name: 'ref',
      value: 'svgRef',
      literal: true
    }];
  }

  if (opts.titleProp) {
    toAddAttributes = [...toAddAttributes, {
      name: 'aria-labelledby',
      value: 'titleId',
      literal: true
    }];
  }

  if (opts.expandProps) {
    toAddAttributes = [...toAddAttributes, {
      name: 'props',
      spread: true,
      position: opts.expandProps
    }];
  }

  if (!opts.dimensions) {
    toRemoveAttributes = [...toRemoveAttributes, 'width', 'height'];
  }

  const plugins = [[_babelPluginTransformSvgComponent.default, opts], ...(opts.icon && opts.dimensions ? [_babelPluginSvgEmDimensions.default] : []), [_babelPluginRemoveJsxAttribute.default, {
    elements: ['svg', 'Svg'],
    attributes: toRemoveAttributes
  }], [_babelPluginAddJsxAttribute.default, {
    elements: ['svg', 'Svg'],
    attributes: toAddAttributes
  }], _babelPluginRemoveJsxEmptyExpression.default];

  if (opts.replaceAttrValues) {
    plugins.push([_babelPluginReplaceJsxAttributeValue.default, {
      values: replaceMapToValues(opts.replaceAttrValues)
    }]);
  }

  if (opts.titleProp) {
    plugins.push(_babelPluginSvgDynamicTitle.default);
  }

  if (opts.native) {
    if (opts.native.expo) {
      plugins.push([_babelPluginTransformReactNativeSvg.default, opts.native]);
    } else {
      plugins.push(_babelPluginTransformReactNativeSvg.default);
    }
  }

  return {
    plugins
  };
};

var _default = plugin;
exports.default = _default;
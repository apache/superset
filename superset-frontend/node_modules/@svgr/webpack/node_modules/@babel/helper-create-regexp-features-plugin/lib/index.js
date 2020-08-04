"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createRegExpFeaturePlugin = createRegExpFeaturePlugin;

var _regexpuCore = _interopRequireDefault(require("regexpu-core"));

var _features = require("./features");

var _util = require("./util");

var _package = _interopRequireDefault(require("../package.json"));

var _core = require("@babel/core");

var _helperRegex = require("@babel/helper-regex");

var _helperAnnotateAsPure = _interopRequireDefault(require("@babel/helper-annotate-as-pure"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const version = _package.default.version.split(".").reduce((v, x) => v * 1e5 + +x, 0);

const versionKey = "@babel/plugin-regexp-features/version";

function createRegExpFeaturePlugin({
  name,
  feature,
  options = {}
}) {
  return {
    name,

    pre() {
      var _file$get;

      const {
        file
      } = this;
      const features = (_file$get = file.get(_features.featuresKey)) != null ? _file$get : 0;
      let newFeatures = (0, _features.enableFeature)(features, _features.FEATURES[feature]);
      const {
        useUnicodeFlag,
        runtime = true
      } = options;

      if (useUnicodeFlag === false) {
        newFeatures = (0, _features.enableFeature)(newFeatures, _features.FEATURES.unicodeFlag);
      }

      if (newFeatures !== features) {
        file.set(_features.featuresKey, newFeatures);
      }

      if (!runtime) {
        file.set(_features.runtimeKey, false);
      }

      if (!file.has(versionKey) || file.get(versionKey) < version) {
        file.set(versionKey, version);
      }
    },

    visitor: {
      RegExpLiteral(path) {
        var _file$get2;

        const {
          node
        } = path;
        const {
          file
        } = this;
        const features = file.get(_features.featuresKey);
        const runtime = (_file$get2 = file.get(_features.runtimeKey)) != null ? _file$get2 : true;
        const regexpuOptions = (0, _util.generateRegexpuOptions)(node, features);

        if (regexpuOptions === null) {
          return;
        }

        const namedCaptureGroups = {};

        if (regexpuOptions.namedGroup) {
          regexpuOptions.onNamedGroup = (name, index) => {
            namedCaptureGroups[name] = index;
          };
        }

        node.pattern = (0, _regexpuCore.default)(node.pattern, node.flags, regexpuOptions);

        if (regexpuOptions.namedGroup && Object.keys(namedCaptureGroups).length > 0 && runtime && !isRegExpTest(path)) {
          const call = _core.types.callExpression(this.addHelper("wrapRegExp"), [node, _core.types.valueToNode(namedCaptureGroups)]);

          (0, _helperAnnotateAsPure.default)(call);
          path.replaceWith(call);
        }

        if ((0, _features.hasFeature)(features, _features.FEATURES.unicodeFlag)) {
          (0, _helperRegex.pullFlag)(node, "u");
        }

        if ((0, _features.hasFeature)(features, _features.FEATURES.dotAllFlag)) {
          (0, _helperRegex.pullFlag)(node, "s");
        }
      }

    }
  };
}

function isRegExpTest(path) {
  return path.parentPath.isMemberExpression({
    object: path.node,
    computed: false
  }) && path.parentPath.get("property").isIdentifier({
    name: "test"
  });
}
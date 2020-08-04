"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.enableFeature = enableFeature;
exports.isLoose = isLoose;
exports.verifyUsedFeatures = verifyUsedFeatures;
exports.FEATURES = void 0;

var _decorators = require("./decorators");

const FEATURES = Object.freeze({
  fields: 1 << 1,
  privateMethods: 1 << 2,
  decorators: 1 << 3,
  privateIn: 1 << 4
});
exports.FEATURES = FEATURES;
const featuresSameLoose = new Map([[FEATURES.fields, "@babel/plugin-proposal-class-properties"], [FEATURES.privateMethods, "@babel/plugin-proposal-private-methods"], [FEATURES.privateIn, "@babel/plugin-proposal-private-private-property-in-object"]]);
const featuresKey = "@babel/plugin-class-features/featuresKey";
const looseKey = "@babel/plugin-class-features/looseKey";
const looseLowPriorityKey = "@babel/plugin-class-features/looseLowPriorityKey/#__internal__@babel/preset-env__please-overwrite-loose-instead-of-throwing";

function enableFeature(file, feature, loose) {
  if (!hasFeature(file, feature) || canIgnoreLoose(file, feature)) {
    file.set(featuresKey, file.get(featuresKey) | feature);

    if (loose === "#__internal__@babel/preset-env__prefer-true-but-false-is-ok-if-it-prevents-an-error") {
      setLoose(file, feature, true);
      file.set(looseLowPriorityKey, file.get(looseLowPriorityKey) | feature);
    } else if (loose === "#__internal__@babel/preset-env__prefer-false-but-true-is-ok-if-it-prevents-an-error") {
      setLoose(file, feature, false);
      file.set(looseLowPriorityKey, file.get(looseLowPriorityKey) | feature);
    } else {
      setLoose(file, feature, loose);
    }
  }

  let resolvedLoose;
  let higherPriorityPluginName;

  for (const [mask, name] of featuresSameLoose) {
    if (!hasFeature(file, mask)) continue;
    const loose = isLoose(file, mask);

    if (canIgnoreLoose(file, mask)) {
      continue;
    } else if (resolvedLoose === !loose) {
      throw new Error("'loose' mode configuration must be the same for @babel/plugin-proposal-class-properties, " + "@babel/plugin-proposal-private-methods and " + "@babel/plugin-proposal-private-property-in-object (when they are enabled).");
    } else {
      resolvedLoose = loose;
      higherPriorityPluginName = name;
    }
  }

  if (resolvedLoose !== undefined) {
    for (const [mask, name] of featuresSameLoose) {
      if (hasFeature(file, mask) && isLoose(file, mask) !== resolvedLoose) {
        setLoose(file, mask, resolvedLoose);
        console.warn(`Though the "loose" option was set to "${!resolvedLoose}" in your @babel/preset-env ` + `config, it will not be used for ${name} since the "loose" mode option was set to ` + `"${resolvedLoose}" for ${higherPriorityPluginName}.\nThe "loose" option must be the ` + `same for @babel/plugin-proposal-class-properties, @babel/plugin-proposal-private-methods ` + `and @babel/plugin-proposal-private-property-in-object (when they are enabled): you can ` + `silence this warning by explicitly adding\n` + `\t["${name}", { "loose": ${resolvedLoose} }]\n` + `to the "plugins" section of your Babel config.`);
      }
    }
  }
}

function hasFeature(file, feature) {
  return !!(file.get(featuresKey) & feature);
}

function isLoose(file, feature) {
  return !!(file.get(looseKey) & feature);
}

function setLoose(file, feature, loose) {
  if (loose) file.set(looseKey, file.get(looseKey) | feature);else file.set(looseKey, file.get(looseKey) & ~feature);
  file.set(looseLowPriorityKey, file.get(looseLowPriorityKey) & ~feature);
}

function canIgnoreLoose(file, feature) {
  return !!(file.get(looseLowPriorityKey) & feature);
}

function verifyUsedFeatures(path, file) {
  if ((0, _decorators.hasOwnDecorators)(path.node)) {
    if (!hasFeature(file, FEATURES.decorators)) {
      throw path.buildCodeFrameError("Decorators are not enabled." + "\nIf you are using " + '["@babel/plugin-proposal-decorators", { "legacy": true }], ' + 'make sure it comes *before* "@babel/plugin-proposal-class-properties" ' + "and enable loose mode, like so:\n" + '\t["@babel/plugin-proposal-decorators", { "legacy": true }]\n' + '\t["@babel/plugin-proposal-class-properties", { "loose": true }]');
    }

    if (path.isPrivate()) {
      throw path.buildCodeFrameError(`Private ${path.isClassMethod() ? "methods" : "fields"} in decorated classes are not supported yet.`);
    }
  }

  if (path.isPrivate() && path.isMethod()) {
    if (!hasFeature(file, FEATURES.privateMethods)) {
      throw path.buildCodeFrameError("Class private methods are not enabled.");
    }
  }

  if (path.isPrivateName() && path.parentPath.isBinaryExpression({
    operator: "in",
    left: path.node
  })) {
    if (!hasFeature(file, FEATURES.privateIn)) {
      throw path.buildCodeFrameError("Private property in checks are not enabled.");
    }
  }

  if (path.isProperty()) {
    if (!hasFeature(file, FEATURES.fields)) {
      throw path.buildCodeFrameError("Class fields are not enabled.");
    }
  }
}
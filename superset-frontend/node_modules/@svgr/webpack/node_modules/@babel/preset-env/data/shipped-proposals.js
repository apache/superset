/* eslint sort-keys: "error" */
// These mappings represent the syntax proposals that have been
// shipped by browsers, and are enabled by the `shippedProposals` option.

const proposalPlugins = new Set([
  "proposal-class-properties",
  "proposal-numeric-separator",
  "proposal-private-methods"
]);

// use intermediary object to enforce alphabetical key order
const pluginSyntaxObject = {
  "proposal-async-generator-functions": "syntax-async-generators",
  "proposal-class-properties": "syntax-class-properties",
  "proposal-json-strings": "syntax-json-strings",
  "proposal-nullish-coalescing-operator": "syntax-nullish-coalescing-operator",
  "proposal-numeric-separator": "syntax-numeric-separator",
  "proposal-object-rest-spread": "syntax-object-rest-spread",
  "proposal-optional-catch-binding": "syntax-optional-catch-binding",
  "proposal-optional-chaining": "syntax-optional-chaining",
  // note: we don't have syntax-private-methods
  "proposal-private-methods": "syntax-class-properties",
  "proposal-unicode-property-regex": null,
};

const pluginSyntaxEntries = Object.keys(pluginSyntaxObject).map(function (key) {
  return [key, pluginSyntaxObject[key]];
});

const pluginSyntaxMap = new Map(pluginSyntaxEntries);

module.exports = { pluginSyntaxMap, proposalPlugins };

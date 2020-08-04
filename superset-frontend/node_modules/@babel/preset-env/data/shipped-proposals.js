/* eslint sort-keys: "error" */
// These mappings represent the syntax proposals that have been
// shipped by browsers, and are enabled by the `shippedProposals` option.

const proposalPlugins = {};

// use intermediary object to enforce alphabetical key order
const pluginSyntaxObject = {
  "proposal-async-generator-functions": "syntax-async-generators",
  "proposal-json-strings": "syntax-json-strings",
  "proposal-nullish-coalescing-operator": "syntax-nullish-coalescing-operator",
  "proposal-object-rest-spread": "syntax-object-rest-spread",
  "proposal-optional-catch-binding": "syntax-optional-catch-binding",
  "proposal-optional-chaining": "syntax-optional-chaining",
  "proposal-unicode-property-regex": null,
};

const pluginSyntaxEntries = Object.keys(pluginSyntaxObject).map(function (key) {
  return [key, pluginSyntaxObject[key]];
});

const pluginSyntaxMap = new Map(pluginSyntaxEntries);

module.exports = { pluginSyntaxMap, proposalPlugins };

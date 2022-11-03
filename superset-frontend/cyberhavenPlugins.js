// const {
//   ModifySourcePlugin,
//   ReplaceOperation,
// } = require('modify-source-webpack-plugin');
const { ModuleReplaceWebpackPlugin } = require('./ModuleReplaceWebpackPlugin');

const plugins = [
  // new ModifySourcePlugin({
  //   rules: [
  //     {
  //       test: /formatters.js/,
  //       operations: [
  //         new ReplaceOperation(
  //           'once',
  //           'var currencyFormatter = global.OSREC && global.OSREC.CurrencyFormatter;',
  //           'var currencyFormatter = false;',
  //         ),
  //         // new ReplaceOperation('all', 'searchValue', 'replaceValue')
  //       ],
  //     },
  //   ],
  // }),
  new ModuleReplaceWebpackPlugin([
    {
      test: /Echart.tsx/,
      replace: 'EchartCyberhaven.tsx',
    },
  ]),
  //   new ModuleReplaceWebpackPlugin([
  //     {
  //       test: /App.tsx/,
  //       replace: 'App2.tsx',
  //     },
  //     {
  //       test: /sumlong/,
  //       replace: resource => {
  //         if (!resource.contextInfo.issuer.includes('sumlong2.ts')) {
  //           if (resource.request && !/sumlong2/.test(resource.request)) {
  //             resource.request = resource.request.replace(/sumlong/, `sumlong2`);
  //           }
  //           if (
  //             resource.createData.resource &&
  //             !/sumlong2/.test(resource.createData.resource)
  //           ) {
  //             resource.createData.resource = resource.createData.resource.replace(
  //               /sumlong/,
  //               `sumlong2`,
  //             );
  //           }
  //         }
  //       },
  //       // ignoreIssuer: /sumlong2.ts /,
  //     },
  //   ]),
];

module.exports = {
  cyberhavenPlugins: plugins,
};

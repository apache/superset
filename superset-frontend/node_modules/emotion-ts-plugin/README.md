# Emotion TypeScript Plugin
[![CircleCI](https://circleci.com/gh/LeetCode-OpenSource/emotion-ts-plugin.svg?style=svg)](https://circleci.com/gh/LeetCode-OpenSource/emotion-ts-plugin)
[![Coverage Status](https://coveralls.io/repos/github/LeetCode-OpenSource/emotion-ts-plugin/badge.svg?branch=master)](https://coveralls.io/github/LeetCode-OpenSource/emotion-ts-plugin?branch=master)

## Features
<table>
  <thead>
    <tr>
      <th>Feature/Syntax</th>
      <th>Native</th>
      <th>Babel Plugin</th>
      <th>TypeScript Plugin</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>css``</code></td>
      <td align="center">✅</td>
      <td align="center"></td>
      <td align="center"></td>
      <td></td>
    </tr>
    <tr>
      <td><code>css(...)</code></td>
      <td align="center">✅</td>
      <td align="center"></td>
      <td align="center"></td>
      <td>Generally used for object styles.</td>
    </tr>
    <tr>
      <td><code>styled('div')``</code> syntax</td>
      <td align="center">✅</td>
      <td align="center"></td>
      <td align="center"></td>
      <td>Both string and object styles work without this plugin.</td>
    </tr>
    <tr>
      <td><code>styled.div``</code> syntax</td>
      <td align="center">✅</td>
      <td align="center"></td>
      <td align="center"></td>
      <td>Supporting the shortcut syntax without the Babel plugin requires a large list of valid elements to be included in the bundle.</td>
    </tr>
    <tr>
      <td>components as selectors</td>
      <td align="center"></td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td>Allows an emotion component to be <a href="https://emotion.sh/docs/styled#targeting-another-emotion-component">used as a CSS selector</a>.</td>
    </tr>
    <tr>
      <td>Minification</td>
      <td align="center"></td>
      <td align="center">✅</td>
      <td align="center">⛔️</td>
      <td>Any leading/trailing space between properties in your <code>css</code> and <code>styled</code> blocks is removed. This can reduce the size of your final bundle.</td>
    </tr>
    <tr>
      <td>Dead Code Elimination</td>
      <td align="center"></td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td>Uglifyjs will use the injected <code>/*#__PURE__*/</code> flag comments to mark your <code>css</code> and <code>styled</code> blocks as candidates for dead code elimination.</td>
    </tr>
    <tr>
      <td>Source Maps</td>
      <td align="center"></td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td>When enabled, navigate directly to the style declaration in your javascript file.</td>
    </tr>
    <tr>
      <td>Contextual Class Names</td>
      <td align="center"></td>
      <td align="center">✅</td>
      <td align="center">✅</td>
      <td>Generated class names include the name of the variable or component they were defined in.</td>
    </tr>
  </tbody>
</table>

## Usage

```ts
const { join } = require('path')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

const { createEmotionPlugin } = require('emotion-ts-plugin')

module.exports = {
  entry: './tests/fixtures/simple.tsx',

  output: {
    filename: '[name].[hash].js',
    path: join(process.cwd(), 'dist'),
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
  },

  mode: 'development',

  devtool: 'cheap-module-source-map',

  module: {
    rules: [
      {
        test: /\.(jsx|tsx|js|ts)$/,
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
          getCustomTransformers: () => ({
            before: [createEmotionPlugin({ // <------------------- here
              sourcemap: true,          
              autoLabel: true,
              labelFormat: '[local]',
              autoInject: true,     //if the jsxFactory is set, should we auto insert the import statement
            })],   
          }),
          compilerOptions: {
            // set jsx pragma to jsx or alias which is from the @emotion/core package to enable css property in jsx component
            jsxFactory: "jsx"
          }
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader?minimize'],
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: join(process.cwd(), 'tests', 'fixtures', 'index.html'),
    }),
  ]
}

```

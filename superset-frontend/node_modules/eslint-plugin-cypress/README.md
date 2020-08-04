# Cypress ESLint Plugin

An ESLint plugin for your [Cypress](https://cypress.io) tests.

Specifies globals for Cypress `cy`, `Cypress`, browser and mocha globals.

## Installation

```sh
npm install eslint-plugin-cypress --save-dev
```

## Usage

Add an `.eslintrc.json` file to your `cypress` directory with the following:

```json
// my-project/cypress/.eslintrc.json

{
  "plugins": [
    "cypress"
  ],
  "extends": [
    "plugin:cypress/recommended"
  ],
  "env": {
    "cypress/globals": true
  }
}
```

## Rules

Rules are grouped by category to help you understand their purpose.

Rules with a check mark (✅) are enabled by default while using
the `plugin:cypress/recommended` config.

The --fix option on the command line automatically fixes problems reported by
rules which have a wrench (🔧) below.


### Possible Errors

|    | Rule ID | Description |
|:---|:--------|:------------|
| ✅ | [no-assigning-return-values](./docs/rules/no-assigning-return-values.md) | Prevent assigning return values of cy calls |
| ✅ | [no-unnecessary-waiting](./docs/rules/no-unnecessary-waiting.md) | Prevent waiting for arbitrary time periods |

## Chai and `no-unused-expressions`

Using an assertion such as `expect(value).to.be.true` can fail the ESLint rule `no-unused-expressions` even though it's not an error in this case. To fix this, you can install and use [eslint-plugin-chai-friendly](https://www.npmjs.com/package/eslint-plugin-chai-friendly).

```sh
npm install --save-dev eslint-plugin-chai-friendly
```

In your `.eslintrc.json`:

```json
{
  "plugins": [
    "cypress",
    "chai-friendly"
  ],
  "rules": {
    "no-unused-expressions": 0,
    "chai-friendly/no-unused-expressions": 2
  }
}
```

## Contribution Guide

To add a new rule:
  * Fork and clone this repository
  * Generate a new rule (a [yeoman generator](https://github.com/eslint/generator-eslint) is available)
  * Run `yarn start` or `npm start`
  * Write test scenarios then implement logic
  * Describe the rule in the generated `docs` file
  * Make sure all tests are passing
  * Add the rule to this README
  * Create a PR

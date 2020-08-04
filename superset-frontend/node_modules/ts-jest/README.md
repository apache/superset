# ts-jest

[![npm version](https://badge.fury.io/js/ts-jest.svg)](https://badge.fury.io/js/ts-jest)
[![NPM downloads](https://img.shields.io/npm/dm/ts-jest.svg?style=flat)](https://npmjs.org/package/ts-jest)
[![Known Vulnerabilities](https://snyk.io/test/github/kulshekhar/ts-jest/badge.svg)](https://snyk.io/test/github/kulshekhar/ts-jest)
[![Coverage Status](https://coveralls.io/repos/github/kulshekhar/ts-jest/badge.svg?branch=master)](https://coveralls.io/github/kulshekhar/ts-jest?branch=master)
[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=kulshekhar/ts-jest)](https://dependabot.com)
[![Build Status](https://travis-ci.com/kulshekhar/ts-jest.svg?branch=master)](https://travis-ci.com/kulshekhar/ts-jest)
[![doc-generator](https://github.com/kulshekhar/ts-jest/workflows/doc-generator/badge.svg)](https://github.com/kulshekhar/ts-jest/actions)

<img src="./icon.png" align="right" title="ts-jest Logo" width="128" height="128">

**`ts-jest`** is a TypeScript preprocessor with source map support for Jest that lets you use Jest to test projects written in TypeScript.

It supports all features of TypeScript including type-checking. [Read more about Babel7 + `preset-typescript` **vs** TypeScript (and `ts-jest`)](https://kulshekhar.github.io/ts-jest/user/babel7-or-ts).

---

| We are not doing semantic versioning and `23.10` is a re-write, run `npm i -D ts-jest@"<23.10.0"` to go back to the previous version |
|---|

[<img src="./docs/assets/img/documentation.png" align="left" height="24"> View the online documentation (usage & technical)](https://kulshekhar.github.io/ts-jest)

[<img src="./docs/assets/img/slack.png" align="left" height="24"> Ask for some help in the `ts-jest` community of Slack](https://bit.ly/3bRHFPQ)

[<img src="./docs/assets/img/troubleshooting.png" align="left" height="24"> Before reporting any issue, be sure to check the troubleshooting page](TROUBLESHOOTING.md)

[<img src="./docs/assets/img/pull-request.png" align="left" height="24"> We're looking for collaborators! Want to help improve `ts-jest`?](https://github.com/kulshekhar/ts-jest/issues/223)

---

## Getting Started

These instructions will get you setup to use `ts-jest` in your project. For more detailed documentation, please check [online documentation](https://kulshekhar.github.io/ts-jest).

| | using npm | using yarn |
|---:|---|---|
| **Prerequisites** | `npm i -D jest typescript` | `yarn add --dev jest typescript` |
| **Installing** | `npm i -D ts-jest @types/jest` | `yarn add --dev ts-jest @types/jest` |
| **Creating config** | `npx ts-jest config:init` | `yarn ts-jest config:init` |
| **Running tests** | `npm t` or `npx jest` | `yarn test` or `yarn jest` |

## Built With

* [TypeScript](https://www.typescriptlang.org/) - JavaScript that scales
* [Jest](https://jestjs.io/) - Delightful JavaScript Testing
* [`ts-jest`](https://kulshekhar.github.io/ts-jest) - Jest processor for TypeScript _(yes, `ts-jest` uses itself for its tests)_

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Versioning

We **DO NOT** use [SemVer](http://semver.org/) for versioning. Though you can think about SemVer when reading our version, except our major number follows the one of Jest. For the versions available, see the [tags on this repository](https://github.com/kulshekhar/ts-jest/tags).

## Authors/maintainers

* **Kulshekhar Kabra** - [kulshekhar](https://github.com/kulshekhar)
* **Gustav Wengel** - [GeeWee](https://github.com/GeeWee)
* **Ahn** - [ahnpnl](https://github.com/ahnpnl)
* **Huafu Gandon** - [huafu](https://github.com/huafu)

See also the list of [contributors](https://github.com/kulshekhar/ts-jest/contributors) who participated in this project.

## Supporters

- [JetBrains](https://www.jetbrains.com/?from=ts-jest) has been kind enough to support ts-jest with an [open source license](https://www.jetbrains.com/community/opensource/?from=ts-jest).

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

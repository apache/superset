# @svgr/core

[![Build Status][build-badge]][build]
[![version][version-badge]][package]
[![MIT License][license-badge]][license]

Node API of SVGR.

```
npm install @svgr/core
```

## Usage

```js
import svgr from '@svgr/core'

const svgCode = `
<svg xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect x="10" y="10" height="100" width="100"
    style="stroke:#ff0000; fill: #0000ff"/>
</svg>
`

svgr(svgCode, { icon: true }, { componentName: 'MyComponent' }).then(
  (jsCode) => {
    console.log(jsCode)
  },
)
```

Use `svgr.sync(code, config, state)` if you would like to use sync version.

### Plugins

By default `@svgr/core` doesn't include `svgo` and `prettier` plugins, if you want them, you have to install them and include them in config.

```js
svgr(svgCode, {
  plugins: ['@svgr/plugin-svgo', '@svgr/plugin-jsx', '@svgr/plugin-prettier'],
}).then((jsCode) => {
  console.log(jsCode)
})
```

## License

MIT

[build-badge]: https://img.shields.io/travis/smooth-code/svgr.svg?style=flat-square
[build]: https://travis-ci.org/smooth-code/svgr
[version-badge]: https://img.shields.io/npm/v/@svgr/core.svg?style=flat-square
[package]: https://www.npmjs.com/package/@svgr/core
[license-badge]: https://img.shields.io/npm/l/@svgr/core.svg?style=flat-square
[license]: https://github.com/smooth-code/svgr/blob/master/LICENSE

```

```

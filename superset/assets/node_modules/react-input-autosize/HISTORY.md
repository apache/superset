# react-input-autosize

## v2.2.1 / 2018-01-10

* fixed; invalid logic in SSR support check, thanks [Rakha Kanz Kautsar](https://github.com/rkkautsar)

## v2.2.0 / 2018-01-09

* added; `extraWidth` prop allows you to customise how much width is added to the detected width
* fixed; SSR support is more robust, thanks [Ivo Bathke](https://github.com/ivoba)

## v2.1.2 / 2017-11-27

* fixed; `window` reference is now guarded for SSR support, thanks [Wout Mertens](https://github.com/wmertens)

## v2.1.1 / 2017-11-26

* fixed; `props.id` was overriding the internal `inputId` on the input element, but not being used in the stylesheet
* fixed; IE stylesheet is now only injected when IE is detected in navigator.userAgent

## v2.1.0 / 2017-11-23

* fixed; inputId wasn't being applied correctly, thanks [Jacco Flenter](https://github.com/flenter)
* added; new `injectStyles` prop controls whether the IE stylesheet it injected
* improved; allow override of `boxSizing` and `width` styles via `inputStyles`, thanks [Mike Fanger](https://github.com/mvf4z7)
* improved; propTypes are now stripped from the production build, thanks [jochenberger](https://github.com/jochenberger)

## v2.0.1 / 2017-09-13

* fixed; peer dependencies for `prop-types`

## v2.0.0 / 2017-09-12

* fixed; converted to es6 Class and removed `create-react-class`
* changed; default export is now an es6 module

### Note:

As of 2.0.0 this package exports an es6 module in the main entry
(`/lib/AutoSizeInput.js`). If you are in an older environment, you'll need to
refer to the `.default` export:

```js
var AutoSizeInput = require('react-input-autosize').default;
```

Aside from this, the new version doesn't change any public API.

## v1.2.0 / 2017-09-12

* added; `inputRef` prop (function, passed the reference to the input node)
* fixed; resize issues in IE11, thanks [Constantine](https://github.com/costagolub)
* fixed; `copyInputStyles()` never running, thanks [Michael Elsdörfer](https://github.com/miracle2k)

# @emotion/stylis

> A custom build of Stylis

`@emotion/stylis` is a version of [Stylis](https://github.com/thysultan/stylis.js) that has been modified slightly to make it smaller. The only Stylis option that can be changed is `prefix`, the rest of the options are already set to the values shown below and cannot be changed. This package also only exports the constructer, so you have to do `new Stylis()` and use the result from that rather than directly calling `Stylis`. The result of that function also cannot be used to create a stylis instance unlike stylis.

```js
type Options = {
  global: false,
  preserve: false,
  keyframe: false,
  semicolon: true,
  cascade: true,
  compress: false,
  prefix: boolean | ((key: string, value: string, context: number) => boolean)
}
```

```jsx
import Stylis from '@emotion/stylis'

const stylis = new Stylis()

stylis('.css-hash', 'display:flex;') // .css-hash{display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;}
```

## Building this package

To build this package from a newer version of stylis, update the version of stylis that is installed as a devDependency and run `node build.js` in the directory of this package. This will read the source of stylis, transform it slightly, use the [Google Closure Compiler REST API](https://developers.google.com/closure/compiler/docs/gettingstarted_api) to minify it, format it with Prettier and then write it to `src/stylis.min.js`.

# Thanks

Stylis was written by [Sultan Tarimo](https://github.com/thysultan). ❤️

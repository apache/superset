## `@superset-ui/translation`

[![Version](https://img.shields.io/npm/v/@superset-ui/translation.svg?style=flat)](https://img.shields.io/npm/v/@superset-ui/translation.svg?style=flat)

`i18n` locales and translation for Superset

### SupersetTranslation

#### Example usage

```js
import { configure, t } from '@superset-ui/translation';

configure({
  languagePack: {...},
});

console.log(t('text to be translated'));
```

#### API

`configure({ [languagePack] })`

- Initialize the translator
- Initialize with the default language if no `languagePack` is specified.

`t(text[, args])`

- Translate `text` when no `args` is provided.
- Translate `text` and substitute `args` into the placeholders specified within `text`.

For example

```js
t('Hello %(name)s', user)
```

See [sprintf-js](https://github.com/alexei/sprintf.js) for more details on how to define placeholders.

### Development

`@data-ui/build-config` is used to manage the build configuration for this package including babel
builds, jest testing, eslint, and prettier.

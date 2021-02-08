## @superset-ui/core/translation

`i18n` locales and translation for Superset.

### SupersetTranslation

#### Example usage

```js
import { configure, t, tn } from '@superset-ui/core';

configure({
  languagePack: {...},
});

console.log(t('text to be translated'));
console.log(tn('singular text', 'plural text', value));
```

#### API

`configure({ [languagePack] })`

- Initialize the translator
- Initialize with the default language if no `languagePack` is specified.

`t(text[, args])`

- Translate `text`.
- If `args` is provided, substitute `args` into the `sprintf` placeholders specified within `text`
  translation.

For example

```js
t('Hello %(name)s', user);
```

See [sprintf-js](https://github.com/alexei/sprintf.js) for more details on how to define
placeholders.

`tn(singular, plural, num, [, args])`

- Translate and choose between `singular` and `plural` based on `num`.
- If `args` is provided, substitute `args` into the `sprintf` placeholders specified within
  `singular` or `plural` translations.

For example

```js
tn('%d duck', '%d ducks', 2, 2);
```

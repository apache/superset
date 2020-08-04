# Enforce that `RegExp#exec` is used instead of `String#match` if no global flag is provided (`prefer-regexp-exec`)

`RegExp#exec` is faster than `String#match` and both work the same when not using the `/g` flag.

## Rule Details

This rule is aimed at enforcing the more performant way of applying regular expressions on strings.

From [`String#match` on MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/match):

> If the regular expression does not include the g flag, returns the same result as `RegExp.exec()`.

From [Stack Overflow](https://stackoverflow.com/questions/9214754/what-is-the-difference-between-regexp-s-exec-function-and-string-s-match-fun)

> `RegExp.prototype.exec` is a lot faster than `String.prototype.match`, but that’s because they are not exactly the same thing, they are different.

Examples of **incorrect** code for this rule:

```ts
'something'.match(/thing/);

'some things are just things'.match(/thing/);

const text = 'something';
const search = /thing/;
text.match(search);
```

Examples of **correct** code for this rule:

```ts
/thing/.exec('something');

'some things are just things'.match(/thing/g);

const text = 'something';
const search = /thing/;
search.exec(text);
```

## Options

There are no options.

```json
{
  "@typescript-eslint/prefer-regexp-exec": "error"
}
```

## When Not To Use It

If you prefer consistent use of `String#match` for both, with `g` flag and without it, you can turn this rule off.

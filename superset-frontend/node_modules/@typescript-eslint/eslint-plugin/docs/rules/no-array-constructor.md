# Disallow generic `Array` constructors (`no-array-constructor`)

Use of the `Array` constructor to construct a new array is generally discouraged in favor of array literal notation because of the single-argument pitfall and because the `Array` global may be redefined. Two exceptions are when the Array constructor is used to intentionally create sparse arrays of a specified size by giving the constructor a single numeric argument, or when using TypeScript type parameters to specify the type of the items of the array (`new Array<Foo>()`).

## Rule Details

This rule disallows `Array` constructors.

Examples of **incorrect** code for this rule:

```ts
/*eslint no-array-constructor: "error"*/

Array(0, 1, 2);
new Array(0, 1, 2);
```

Examples of **correct** code for this rule:

```ts
/*eslint no-array-constructor: "error"*/

Array<number>(0, 1, 2);
new Array<Foo>(x, y, z);

Array(500);
new Array(someOtherArray.length);
```

## When Not To Use It

This rule enforces a nearly universal stylistic concern. That being said, this rule may be disabled if the constructor style is preferred.

<sup>Taken with ❤️ [from ESLint core](https://github.com/eslint/eslint/blob/7685fed33b15763ee3cf7dbe1facfc5ba85173f3/docs/rules/no-array-constructor.md)</sup>

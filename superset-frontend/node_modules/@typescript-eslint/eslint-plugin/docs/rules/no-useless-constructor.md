# Disallow unnecessary constructors (`no-useless-constructor`)

ES2015 provides a default class constructor if one is not specified. As such, it is unnecessary to provide an empty constructor or one that simply delegates into its parent class, as in the following examples:

```js
class A {
  constructor() {}
}

class A extends B {
  constructor(value) {
    super(value);
  }
}
```

## Rule Details

This rule flags class constructors that can be safely removed without changing how the class works.

## Examples

Examples of **incorrect** code for this rule:

```js
/*eslint @typescript-eslint/no-useless-constructor: "error"*/

class A {
  constructor() {}
}

class A extends B {
  constructor(...args) {
    super(...args);
  }
}
```

Examples of **correct** code for this rule:

```js
/*eslint @typescript-eslint/no-useless-constructor: "error"*/

class A {}

class A {
  constructor() {
    doSomething();
  }
}

class A extends B {
  constructor() {
    super('foo');
  }
}

class A extends B {
  constructor() {
    super();
    doSomething();
  }
}

class A extends B {
  constructor(protected name: string) {}
}

class A extends B {
  protected constructor() {}
}
```

## Rule Changes

```cjson
{
    // note you must disable the base rule as it can report incorrect errors
    "no-useless-constructor": "off",
    "@typescript-eslint/no-useless-constructor": "error",
}
```

## When Not To Use It

If you don't want to be notified about unnecessary constructors, you can safely disable this rule.

<sup>Taken with ❤️ [from ESLint core](https://github.com/eslint/eslint/blob/master/docs/rules/no-useless-constructor.md)</sup>

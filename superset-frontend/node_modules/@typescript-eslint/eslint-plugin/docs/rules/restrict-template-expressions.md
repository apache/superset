# Enforce template literal expressions to be of string type (`restrict-template-expressions`)

Examples of **correct** code:

```ts
const arg = 'foo';
const msg1 = `arg = ${arg}`;
const msg2 = `arg = ${arg || 'default'}`;
```

Examples of **incorrect** code:

```ts
const arg1 = [1, 2];
const msg1 = `arg1 = ${arg1}`;

const arg2 = { name: 'Foo' };
const msg2 = `arg2 = ${arg2 || null}`;
```

## Options

The rule accepts an options object with the following properties:

```ts
type Options = {
  // if true, also allow number type in template expressions
  allowNumber?: boolean;
  // if true, also allow boolean type in template expressions
  allowBoolean?: boolean;
  // if true, also allow null and undefined in template expressions
  allowNullable?: boolean;
};

const defaults = {
  allowNumber: false,
  allowBoolean: false,
  allowNullable: false,
};
```

### `allowNumber`

Examples of additional **correct** code for this rule with `{ allowNumber: true }`:

```ts
const arg = 123;
const msg1 = `arg = ${arg}`;
const msg2 = `arg = ${arg || 'zero'}`;
```

### `allowBoolean`

Examples of additional **correct** code for this rule with `{ allowBoolean: true }`:

```ts
const arg = true;
const msg1 = `arg = ${arg}`;
const msg2 = `arg = ${arg || 'not truthy'}`;
```

### `allowNullable`

Examples of additional **correct** code for this rule with `{ allowNullable: true }`:

```ts
const arg = condition ? 'ok' : null;
const msg1 = `arg = ${arg}`;
```

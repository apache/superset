# Require that interface names should or should not prefixed with `I` (`interface-name-prefix`)

Interfaces often represent important software contracts, so it can be helpful to prefix their names with `I`.
The unprefixed name is then available for a class that provides a standard implementation of the interface.
Alternatively, the contributor guidelines for the TypeScript repo suggest
[never prefixing](https://github.com/Microsoft/TypeScript/wiki/Coding-guidelines#names) interfaces with `I`.

## Rule Details

This rule enforces whether or not the `I` prefix is required for interface names.
The `_` prefix is sometimes used to designate a private declaration, so the rule also supports a private interface
that might be named `_IAnimal` instead of `IAnimal`.

## Options

This rule has an object option:

- `{ "prefixWithI": "never" }`: (default) disallows all interfaces being prefixed with `"I"` or `"_I"`
- `{ "prefixWithI": "always" }`: requires all interfaces be prefixed with `"I"` (but does not allow `"_I"`)
- `{ "prefixWithI": "always", "allowUnderscorePrefix": true }`: requires all interfaces be prefixed with
  either `"I"` or `"_I"`

For backwards compatibility, this rule supports a string option instead:

- `"never"`: Equivalent to `{ "prefixWithI": "never" }`
- `"always"`: Equivalent to `{ "prefixWithI": "always" }`

## Examples

### never

**Configuration:** `{ "prefixWithI": "never" }`

The following patterns are considered warnings:

```ts
interface IAnimal {
  name: string;
}

interface IIguana {
  name: string;
}

interface _IAnimal {
  name: string;
}
```

The following patterns are not warnings:

```ts
interface Animal {
  name: string;
}

interface Iguana {
  name: string;
}
```

### always

**Configuration:** `{ "prefixWithI": "always" }`

The following patterns are considered warnings:

```ts
interface Animal {
  name: string;
}

interface Iguana {
  name: string;
}

interface _IAnimal {
  name: string;
}
```

The following patterns are not warnings:

```ts
interface IAnimal {
  name: string;
}

interface IIguana {
  name: string;
}
```

### always and allowing underscores

**Configuration:** `{ "prefixWithI": "always", "allowUnderscorePrefix": true }`

The following patterns are considered warnings:

```ts
interface Animal {
  name: string;
}

interface Iguana {
  name: string;
}
```

The following patterns are not warnings:

```ts
interface IAnimal {
  name: string;
}

interface IIguana {
  name: string;
}

interface _IAnimal {
  name: string;
}
```

## When Not To Use It

If you do not want to enforce interface name prefixing.

## Further Reading

TypeScript [Interfaces](https://www.typescriptlang.org/docs/handbook/interfaces.html)

## Compatibility

TSLint: [interface-name](https://palantir.github.io/tslint/rules/interface-name/)

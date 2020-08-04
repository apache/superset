# Enforces naming conventions for everything across a codebase (`naming-convention`)

Enforcing naming conventions helps keep the codebase consistent, and reduces overhead when thinking about how to name a variable.
Additionally, a well designed style guide can help communicate intent, such as by enforcing all private properties begin with an `_`, and all global-level constants are written in `UPPER_CASE`.

There are many different rules that have existed over time, but they have had the problem of not having enough granularity, meaning it was hard to have a well defined style guide, and most of the time you needed 3 or more rules at once to enforce different conventions, hoping they didn't conflict.

## Rule Details

This rule allows you to enforce conventions for any identifier, using granular selectors to create a fine-grained style guide.

### Note - this rule only needs type information in specific cases, detailed below

## Options

This rule accepts an array of objects, with each object describing a different naming convention.
Each property will be described in detail below. Also see the examples section below for illustrated examples.

```ts
type Options = {
  // format options
  format:
    | (
        | 'camelCase'
        | 'strictCamelCase'
        | 'PascalCase'
        | 'StrictPascalCase'
        | 'snake_case'
        | 'UPPER_CASE'
      )[]
    | null;
  custom?: {
    regex: string;
    match: boolean;
  };
  leadingUnderscore?: 'forbid' | 'allow' | 'require';
  trailingUnderscore?: 'forbid' | 'allow' | 'require';
  prefix?: string[];
  suffix?: string[];

  // selector options
  selector: Selector;
  filter?:
    | string
    | {
        regex: string;
        match: boolean;
      };
  // the allowed values for these are dependent on the selector - see below
  modifiers?: Modifiers<Selector>[];
  types?: Types<Selector>[];
}[];

// the default config essentially does the same thing as ESLint's camelcase rule
const defaultOptions: Options = [
  {
    selector: 'default',
    format: ['camelCase'],
    leadingUnderscore: 'allow',
    trailingUnderscore: 'allow',
  },

  {
    selector: 'variable',
    format: ['camelCase', 'UPPER_CASE'],
    leadingUnderscore: 'allow',
    trailingUnderscore: 'allow',
  },

  {
    selector: 'typeLike',
    format: ['PascalCase'],
  },
];
```

### Format Options

Every single selector can have the same set of format options.
When the format of an identifier is checked, it is checked in the following order:

1. validate leading underscore
1. validate trailing underscore
1. validate prefix
1. validate suffix
1. validate custom
1. validate format

For steps 1-4, if the identifier matches the option, the matching part will be removed.
For example, if you provide the following formatting option: `{ leadingUnderscore: 'allow', prefix: ['I'], format: ['StrictPascalCase'] }`, for the identifier `_IMyInterface`, then the following checks will occur:

1. `name = _IMyInterface`
1. validate leading underscore - pass
   - Trim leading underscore - `name = IMyInterface`
1. validate trailing underscore - no check
1. validate prefix - pass
   - Trim prefix - `name = MyInterface`
1. validate suffix - no check
1. validate custom - no check
1. validate format - pass

One final note is that if the name were to become empty via this trimming process, it is considered to match all `format`s. An example of where this might be useful is for generic type parameters, where you want all names to be prefixed with `T`, but also want to allow for the single character `T` name.

#### `format`

The `format` option defines the allowed formats for the identifier. This option accepts an array of the following values, and the identifier can match any of them:

- `camelCase` - standard camelCase format - no underscores are allowed between characters, and consecutive capitals are allowed (i.e. both `myID` and `myId` are valid).
- `strictCamelCase` - same as `camelCase`, but consecutive capitals are not allowed (i.e. `myId` is valid, but `myID` is not).
- `PascalCase` - same as `camelCase`, except the first character must be upper-case.
- `StrictPascalCase` - same as `strictCamelCase`, except the first character must be upper-case.
- `snake_case` - standard snake_case format - all characters must be lower-case, and underscores are allowed.
- `UPPER_CASE` - same as `snake_case`, except all characters must be upper-case.

Instead of an array, you may also pass `null`. This signifies "this selector shall not have its format checked".
This can be useful if you want to enforce no particular format for a specific selector, after applying a group selector.

### `custom`

The `custom` option defines a custom regex that the identifier must (or must not) match. This option allows you to have a bit more finer-grained control over identifiers, letting you ban (or force) certain patterns and substrings.
Accepts an object with the following properties:

- `regex` - accepts a regular expression (anything accepted into `new RegExp(regex)`).
- `match` - true if the identifier _must_ match the `regex`, false if the identifier _must not_ match the `regex`.

### `filter`

The `filter` option operates similar to `custom`, accepting the same shaped object, except that it controls if the rest of the configuration should or should not be applied to an identifier.

You can use this to include or exclude specific identifiers from specific configurations.

Accepts an object with the following properties:

- `regex` - accepts a regular expression (anything accepted into `new RegExp(regex)`).
- `match` - true if the identifier _must_ match the `regex`, false if the identifier _must not_ match the `regex`.

Alternatively, `filter` accepts a regular expression (anything accepted into `new RegExp(filter)`). In this case, it's treated as if you had passed an object with the regex and `match: true`.

#### `leadingUnderscore` / `trailingUnderscore`

The `leadingUnderscore` / `trailingUnderscore` options control whether leading/trailing underscores are considered valid. Accepts one of the following values:

- `forbid` - a leading/trailing underscore is not allowed at all.
- `allow` - existence of a leading/trailing underscore is not explicitly enforced.
- `require` - a leading/trailing underscore must be included.

#### `prefix` / `suffix`

The `prefix` / `suffix` options control which prefix/suffix strings must exist for the identifier. Accepts an array of strings.

If these are provided, the identifier must start with one of the provided values. For example, if you provide `{ prefix: ['IFace', 'Class', 'Type'] }`, then the following names are valid: `IFaceFoo`, `ClassBar`, `TypeBaz`, but the name `Bang` is not valid, as it contains none of the prefixes.

### Selector Options

- `selector` (see "Allowed Selectors, Modifiers and Types" below).
- `modifiers` allows you to specify which modifiers to granularly apply to, such as the accessibility (`private`/`public`/`protected`), or if the thing is `static`, etc.
  - The name must match _all_ of the modifiers.
  - For example, if you provide `{ modifiers: ['private', 'static', 'readonly'] }`, then it will only match something that is `private static readonly`, and something that is just `private` will not match.
- `types` allows you to specify which types to match. This option supports simple, primitive types only (`boolean`, `string`, `number`, `array`, `function`).
  - The name must match _one_ of the types.
  - **_NOTE - Using this option will require that you lint with type information._**
  - For example, this lets you do things like enforce that `boolean` variables are prefixed with a verb.
  - `boolean` matches any type assignable to `boolean | null | undefined`
  - `string` matches any type assignable to `string | null | undefined`
  - `number` matches any type assignable to `number | null | undefined`
  - `array` matches any type assignable to `Array<unknown> | null | undefined`
  - `function` matches any type assignable to `Function | null | undefined`

The ordering of selectors does not matter. The implementation will automatically sort the selectors to ensure they match from most-specific to least specific. It will keep checking selectors in that order until it finds one that matches the name.

For example, if you provide the following config:

```ts
[
  /* 1 */ { selector: 'default', format: ['camelCase'] },
  /* 2 */ { selector: 'variable', format: ['snake_case'] },
  /* 3 */ { selector: 'variable', type: ['boolean'], format: ['UPPER_CASE'] },
  /* 4 */ { selector: 'variableLike', format: ['PascalCase'] },
];
```

Then for the code `const x = 1`, the rule will validate the selectors in the following order: `3`, `2`, `4`, `1`.

#### Allowed Selectors, Modifiers and Types

There are two types of selectors, individual selectors, and grouped selectors.

##### Individual Selectors

Individual Selectors match specific, well-defined sets. There is no overlap between each of the individual selectors.

- `variable` - matches any `var` / `let` / `const` variable name.
  - Allowed `modifiers`: none.
  - Allowed `types`: `boolean`, `string`, `number`, `function`, `array`.
- `function` - matches any named function declaration or named function expression.
  - Allowed `modifiers`: none.
  - Allowed `types`: none.
- `parameter` - matches any function parameter. Does not match parameter properties.
  - Allowed `modifiers`: none.
  - Allowed `types`: `boolean`, `string`, `number`, `function`, `array`.
- `property` - matches any object, class, or object type property. Does not match properties that have direct function expression or arrow function expression values.
  - Allowed `modifiers`: `private`, `protected`, `public`, `static`, `readonly`, `abstract`.
  - Allowed `types`: `boolean`, `string`, `number`, `function`, `array`.
- `parameterProperty` - matches any parameter property.
  - Allowed `modifiers`: `private`, `protected`, `public`, `readonly`.
  - Allowed `types`: `boolean`, `string`, `number`, `function`, `array`.
- `method` - matches any object, class, or object type method. Also matches properties that have direct function expression or arrow function expression values. Does not match accessors.
  - Allowed `modifiers`: `private`, `protected`, `public`, `static`, `readonly`, `abstract`.
  - Allowed `types`: none.
- `accessor` - matches any accessor.
  - Allowed `modifiers`: `private`, `protected`, `public`, `static`, `readonly`, `abstract`.
  - Allowed `types`: `boolean`, `string`, `number`, `function`, `array`.
- `enumMember` - matches any enum member.
  - Allowed `modifiers`: none.
  - Allowed `types`: none.
- `class` - matches any class declaration.
  - Allowed `modifiers`: `abstract`.
  - Allowed `types`: none.
- `interface` - matches any interface declaration.
  - Allowed `modifiers`: none.
  - Allowed `types`: none.
- `typeAlias` - matches any type alias declaration.
  - Allowed `modifiers`: none.
  - Allowed `types`: none.
- `enum` - matches any enum declaration.
  - Allowed `modifiers`: none.
  - Allowed `types`: none.
- `typeParameter` - matches any generic type parameter declaration.
  - Allowed `modifiers`: none.
  - Allowed `types`: none.

##### Group Selectors

Group Selectors are provided for convenience, and essentially bundle up sets of individual selectors.

- `default` - matches everything.
  - Allowed `modifiers`: `private`, `protected`, `public`, `static`, `readonly`, `abstract`.
  - Allowed `types`: none.
- `variableLike` - matches the same as `variable`, `function` and `parameter`.
  - Allowed `modifiers`: none.
  - Allowed `types`: none.
- `memberLike` - matches the same as `property`, `parameterProperty`, `method`, `accessor`, `enumMember`.
  - Allowed `modifiers`: `private`, `protected`, `public`, `static`, `readonly`, `abstract`.
  - Allowed `types`: none.
- `typeLike` - matches the same as `class`, `interface`, `typeAlias`, `enum`, `typeParameter`.
  - Allowed `modifiers`: `abstract`.
  - Allowed `types`: none.

## Examples

### Enforce that all variables, functions and properties follow are camelCase

```json
{
  "@typescript-eslint/naming-convention": [
    "error",
    { "selector": "variableLike", "format": ["camelCase"] }
  ]
}
```

### Enforce that private members are prefixed with an underscore

```json
{
  "@typescript-eslint/naming-convention": [
    "error",
    {
      "selector": "memberLike",
      "modifiers": ["private"],
      "format": ["camelCase"],
      "leadingUnderscore": "require"
    }
  ]
}
```

### Enforce that boolean variables are prefixed with an allowed verb

```json
{
  "@typescript-eslint/naming-convention": [
    "error",
    {
      "selector": "variable",
      "types": ["boolean"],
      "format": ["PascalCase"],
      "prefix": ["is", "should", "has", "can", "did", "will"]
    }
  ]
}
```

### Enforce that all variables are either in camelCase or UPPER_CASE

```json
{
  "@typescript-eslint/naming-convention": [
    "error",
    {
      "selector": "variable",
      "format": ["camelCase", "UPPER_CASE"]
    }
  ]
}
```

### Enforce that type parameters (generics) are prefixed with `T`

```json
{
  "@typescript-eslint/naming-convention": [
    "error",
    {
      "selector": "typeParameter",
      "format": ["PascalCase"],
      "prefix": ["T"]
    }
  ]
}
```

### Enforce the codebase follows ESLint's `camelcase` conventions

```json
{
  "@typescript-eslint/naming-convention": [
    "error",
    {
      "selector": "default",
      "format": ["camelCase"]
    },

    {
      "selector": "variable",
      "format": ["camelCase", "UPPER_CASE"]
    },
    {
      "selector": "parameter",
      "format": ["camelCase"],
      "leadingUnderscore": "allow"
    },

    {
      "selector": "memberLike",
      "modifiers": ["private"],
      "format": ["camelCase"],
      "leadingUnderscore": "require"
    },

    {
      "selector": "typeLike",
      "format": ["PascalCase"]
    }
  ]
}
```

## When Not To Use It

If you do not want to enforce naming conventions for anything.

# Require a consistent member declaration order (`member-ordering`)

A consistent ordering of fields, methods and constructors can make interfaces, type literals, classes and class
expressions easier to read, navigate and edit.

## Rule Details

This rule aims to standardize the way class declarations, class expressions, interfaces and type literals are structured.

It allows to group members by their type (e.g. `public-static-field`, `protected-static-field`, `private-static-field`, `public-instance-field`, ...). By default, their order is the same inside `classes`, `classExpressions`, `interfaces` and `typeLiterals` (note: not all member types apply to `interfaces` and `typeLiterals`). It is possible to define the order for any of those individually or to change the default order for all of them by setting the `default` option.

## Options

```ts
{
  default?: Array<MemberType> | never
  classes?: Array<MemberType> | never
  classExpressions?: Array<MemberType> | never

  interfaces?: ['signature' | 'field' | 'method' | 'constructor'] | never
  typeLiterals?: ['signature' | 'field' | 'method' | 'constructor'] | never
}
```

See below for the possible definitions of `MemberType`.

### Member types (granular form)

There are multiple ways to specify the member types. The most explicit and granular form is the following:

```json5
[
  // Index signature
  'signature',

  // Fields
  'public-static-field',
  'protected-static-field',
  'private-static-field',
  'public-instance-field',
  'protected-instance-field',
  'private-instance-field',
  'public-abstract-field',
  'protected-abstract-field',
  'private-abstract-field',

  // Constructors
  'public-constructor',
  'protected-constructor',
  'private-constructor',

  // Methods
  'public-static-method',
  'protected-static-method',
  'private-static-method',
  'public-instance-method',
  'protected-instance-method',
  'private-instance-method',
  'public-abstract-method',
  'protected-abstract-method',
  'private-abstract-method',
]
```

Note: If you only specify some of the possible types, the non-specified ones can have any particular order. This means that they can be placed before, within or after the specified types and the linter won't complain about it.

### Member group types (with accessibility, ignoring scope)

It is also possible to group member types by their accessibility (`static`, `instance`, `abstract`), ignoring their scope.

```json5
[
  // Index signature
  // No accessibility for index signature. See above.

  // Fields
  'public-field', // = ['public-static-field', 'public-instance-field'])
  'protected-field', // = ['protected-static-field', 'protected-instance-field'])
  'private-field', // = ['private-static-field', 'private-instance-field'])

  // Constructors
  // Only the accessibility of constructors is configurable. See below.

  // Methods
  'public-method', // = ['public-static-method', 'public-instance-method'])
  'protected-method', // = ['protected-static-method', 'protected-instance-method'])
  'private-method', // = ['private-static-method', 'private-instance-method'])
]
```

### Member group types (with scope, ignoring accessibility)

Another option is to group the member types by their scope (`public`, `protected`, `private`), ignoring their accessibility.

```json5
[
  // Index signature
  // No scope for index signature. See above.

  // Fields
  'static-field', // = ['public-static-field', 'protected-static-field', 'private-static-field'])
  'instance-field', // = ['public-instance-field', 'protected-instance-field', 'private-instance-field'])
  'abstract-field', // = ['public-abstract-field', 'protected-abstract-field', 'private-abstract-field'])

  // Constructors
  'constructor', // = ['public-constructor', 'protected-constructor', 'private-constructor'])

  // Methods
  'static-method', // = ['public-static-method', 'protected-static-method', 'private-static-method'])
  'instance-method', // = ['public-instance-method', 'protected-instance-method', 'private-instance-method'])
  'abstract-method', // = ['public-abstract-method', 'protected-abstract-method', 'private-abstract-method'])
]
```

### Member group types (with scope and accessibility)

The third grouping option is to ignore both scope and accessibility.

```json5
[
  // Index signature
  // No grouping for index signature. See above.

  // Fields
  'field', // = ['public-static-field', 'protected-static-field', 'private-static-field', 'public-instance-field', 'protected-instance-field', 'private-instance-field',
  //              'public-abstract-field', 'protected-abstract-field', private-abstract-field'])

  // Constructors
  // Only the accessibility of constructors is configurable. See above.

  // Methods
  'method', // = ['public-static-method', 'protected-static-method', 'private-static-method', 'public-instance-method', 'protected-instance-method', 'private-instance-method',
  //                'public-abstract-method', 'protected-abstract-method', 'private-abstract-method'])
]
```

### Default configuration

The default configuration looks as follows:

```json
{
  "default": [
    "signature",

    "public-static-field",
    "protected-static-field",
    "private-static-field",

    "public-instance-field",
    "protected-instance-field",
    "private-instance-field",

    "public-abstract-field",
    "protected-abstract-field",
    "private-abstract-field",

    "public-field",
    "protected-field",
    "private-field",

    "static-field",
    "instance-field",
    "abstract-field",

    "field",

    "constructor",

    "public-static-method",
    "protected-static-method",
    "private-static-method",

    "public-instance-method",
    "protected-instance-method",
    "private-instance-method",

    "public-abstract-method",
    "protected-abstract-method",
    "private-abstract-method",

    "public-method",
    "protected-method",
    "private-method",

    "static-method",
    "instance-method",
    "abstract-method",

    "method"
  ]
}
```

Note: The default configuration contains member group types which contain other member types (see above). This is intentional to provide better error messages.

## Examples

### Custom `default` configuration

Note: The `default` options are overwritten in these examples.

#### Configuration: `{ "default": ["signature", "method", "constructor", "field"] }`

##### Incorrect examples

```ts
interface Foo {
  B: string; // -> field

  new (); // -> constructor

  A(): void; // -> method

  [Z: string]: any; // -> signature
}
```

Note: Wrong order.

```ts
type Foo = {
  B: string; // -> field

  // no constructor

  A(): void; // -> method

  // no signature
};
```

Note: Not all specified member types have to exist.

```ts
class Foo {
  private C: string; // -> field
  public D: string; // -> field
  protected static E: string; // -> field

  constructor() {} // -> constructor

  public static A(): void {} // -> method
  public B(): void {} // -> method

  [Z: string]: any; // -> signature
}
```

Note: Accessibility or scope are ignored with this configuration.

```ts
const Foo = class {
  private C: string; // -> field
  public D: string; // -> field

  constructor() {} // -> constructor

  public static A(): void {} // -> method
  public B(): void {} // -> method

  [Z: string]: any; // -> signature

  protected static E: string; // -> field
};
```

Note: Not all members have to be grouped to find rule violations.

##### Correct examples

```ts
interface Foo {
  [Z: string]: any; // -> signature

  A(): void; // -> method

  new (); // -> constructor

  B: string; // -> field
}
```

```ts
type Foo = {
  // no signature

  A(): void; // -> method

  // no constructor

  B: string; // -> field
};
```

```ts
class Foo {
  [Z: string]: any; // -> signature

  public static A(): void {} // -> method
  public B(): void {} // -> method

  constructor() {} // -> constructor

  private C: string; // -> field
  public D: string; // -> field
  protected static E: string; // -> field
}
```

```ts
const Foo = class {
  [Z: string]: any; // -> signature

  public static A(): void {} // -> method
  public B(): void {} // -> method

  constructor() {} // -> constructor

  private C: string; // -> field
  public D: string; // -> field
  protected static E: string; // -> field
};
```

#### Configuration: `{ "default": ["public-instance-method", "public-static-field"] }`

Note: This configuration does not apply to interfaces/type literals as accessibility and scope are not part of interfaces/type literals.

##### Incorrect examples

```ts
class Foo {
  private C: string; // (irrelevant)

  public D: string; // (irrelevant)

  public static E: string; // -> public static field

  constructor() {} // (irrelevant)

  public static A(): void {} // (irrelevant)

  [Z: string]: any; // (irrelevant)

  public B(): void {} // -> public instance method
}
```

Note: Public instance methods should come first before public static fields. Everything else can be placed anywhere.

```ts
const Foo = class {
  private C: string; // (irrelevant)

  [Z: string]: any; // (irrelevant)

  public static E: string; // -> public static field

  public D: string; // (irrelevant)

  constructor() {} // (irrelevant)

  public static A(): void {} // (irrelevant)

  public B(): void {} // -> public instance method
};
```

Note: Public instance methods should come first before public static fields. Everything else can be placed anywhere.

##### Correct examples

```ts
class Foo {
  public B(): void {} // -> public instance method

  private C: string; // (irrelevant)

  public D: string; // (irrelevant)

  public static E: string; // -> public static field

  constructor() {} // (irrelevant)

  public static A(): void {} // (irrelevant)

  [Z: string]: any; // (irrelevant)
}
```

```ts
const Foo = class {
  public B(): void {} // -> public instance method

  private C: string; // (irrelevant)

  [Z: string]: any; // (irrelevant)

  public D: string; // (irrelevant)

  constructor() {} // (irrelevant)

  public static A(): void {} // (irrelevant)

  public static E: string; // -> public static field
};
```

#### Configuration: `{ "default": ["public-static-field", "static-field", "instance-field"] }`

Note: This configuration does not apply to interfaces/type literals as accessibility and scope are not part of interfaces/type literals.

##### Incorrect examples

```ts
class Foo {
  private E: string; // -> instance field

  private static B: string; // -> static field
  protected static C: string; // -> static field
  private static D: string; // -> static field

  public static A: string; // -> public static field

  [Z: string]: any; // (irrelevant)
}
```

Note: Public static fields should come first, followed by static fields and instance fields.

```ts
const foo = class {
  public T(): void {} // (irrelevant)

  private static B: string; // -> static field

  constructor() {} // (irrelevant)

  private E: string; // -> instance field

  protected static C: string; // -> static field
  private static D: string; // -> static field

  [Z: string]: any; // (irrelevant)

  public static A: string; // -> public static field
};
```

Issue: Public static fields should come first, followed by static fields and instance fields.

##### Correct examples

```ts
class Foo {
  public static A: string; // -> public static field

  private static B: string; // -> static field
  protected static C: string; // -> static field
  private static D: string; // -> static field

  private E: string; // -> instance field
}
```

```ts
const foo = class {
  [Z: string]: any; // -> signature

  public static A: string; // -> public static field

  constructor() {} // -> constructor

  private static B: string; // -> static field
  protected static C: string; // -> static field
  private static D: string; // -> static field

  private E: string; // -> instance field

  public T(): void {} // -> method
};
```

### Custom `classes` configuration

Note: If this is not set, the `default` will automatically be applied to classes as well. If a `classes` configuration is provided, only this configuration will be used for `classes` (i.e. nothing will be merged with `default`).

Note: The configuration for `classes` does not apply to class expressions (use `classExpressions` for them).

#### Configuration: `{ "classes": ["method", "constructor", "field"] }`

##### Incorrect example

```ts
class Foo {
  private C: string; // -> field
  public D: string; // -> field
  protected static E: string; // -> field

  constructor() {} // -> constructor

  public static A(): void {} // -> method
  public B(): void {} // -> method
}
```

##### Correct example

```ts
class Foo {
  public static A(): void {} // -> method
  public B(): void {} // -> method

  constructor() {} // -> constructor

  private C: string; // -> field
  public D: string; // -> field
  protected static E: string; // -> field
}
```

#### Configuration: `{ "classes": ["public-instance-method", "public-static-field"] }`

##### Incorrect example

```ts
class Foo {
  private C: string; // (irrelevant)

  public D: string; // (irrelevant)

  public static E: string; // -> public static field

  constructor() {} // (irrelevant)

  public static A(): void {} // (irrelevant)

  public B(): void {} // -> public instance method
}
```

##### Correct example

Examples of **correct** code for `{ "classes": [...] }` option:

```ts
class Foo {
  private C: string; // (irrelevant)

  public D: string; // (irrelevant)

  public static E: string; // -> public static field

  constructor() {} // (irrelevant)

  public static A(): void {} // (irrelevant)

  public B(): void {} // -> public instance method
}
```

### Custom `classExpressions` configuration

Note: If this is not set, the `default` will automatically be applied to classes expressions as well. If a `classExpressions` configuration is provided, only this configuration will be used for `classExpressions` (i.e. nothing will be merged with `default`).

Note: The configuration for `classExpressions` does not apply to classes (use `classes` for them).

#### Configuration: `{ "classExpressions": ["method", "constructor", "field"] }`

##### Incorrect example

```ts
const foo = class {
  private C: string; // -> field
  public D: string; // -> field
  protected static E: string; // -> field

  constructor() {} // -> constructor

  public static A(): void {} // -> method
  public B(): void {} // -> method
};
```

##### Correct example

```ts
const foo = class {
  public static A(): void {} // -> method
  public B(): void {} // -> method

  constructor() {} // -> constructor

  private C: string; // -> field
  public D: string; // -> field
  protected static E: string; // -> field
};
```

#### Configuration: `{ "classExpressions": ["public-instance-method", "public-static-field"] }`

##### Incorrect example

```ts
const foo = class {
  private C: string; // (irrelevant)

  public D: string; // (irrelevant)

  public static E: string; // -> public static field

  constructor() {} // (irrelevant)

  public static A(): void {} // (irrelevant)

  public B(): void {} // -> public instance method
};
```

##### Correct example

```ts
const foo = class {
  private C: string; // (irrelevant)

  public D: string; // (irrelevant)

  public B(): void {} // -> public instance method

  public static E: string; // -> public static field

  constructor() {} // (irrelevant)

  public static A(): void {} // (irrelevant)
};
```

### Custom `interfaces` configuration

Note: If this is not set, the `default` will automatically be applied to classes expressions as well. If a `interfaces` configuration is provided, only this configuration will be used for `interfaces` (i.e. nothing will be merged with `default`).

Note: The configuration for `interfaces` only allows a limited set of member types: `signature`, `field`, `constructor` and `method`.

Note: The configuration for `interfaces` does not apply to type literals (use `typeLiterals` for them).

#### Configuration: `{ "interfaces": ["signature", "method", "constructor", "field"] }`

##### Incorrect example

```ts
interface Foo {
  B: string; // -> field

  new (); // -> constructor

  A(): void; // -> method

  [Z: string]: any; // -> signature
}
```

##### Correct example

```ts
interface Foo {
  [Z: string]: any; // -> signature

  A(): void; // -> method

  new (); // -> constructor

  B: string; // -> field
}
```

### Custom `typeLiterals` configuration

Note: If this is not set, the `default` will automatically be applied to classes expressions as well. If a `typeLiterals` configuration is provided, only this configuration will be used for `typeLiterals` (i.e. nothing will be merged with `default`).

Note: The configuration for `typeLiterals` only allows a limited set of member types: `signature`, `field`, `constructor` and `method`.

Note: The configuration for `typeLiterals` does not apply to interfaces (use `interfaces` for them).

#### Configuration: `{ "typeLiterals": ["signature", "method", "constructor", "field"] }`

##### Incorrect example

```ts
type Foo = {
  B: string; // -> field

  A(): void; // -> method

  new (); // -> constructor

  [Z: string]: any; // -> signature
};
```

##### Correct example

```ts
type Foo = {
  [Z: string]: any; // -> signature

  A(): void; // -> method

  new (); // -> constructor

  B: string; // -> field
};
```

## When Not To Use It

If you don't care about the general structure of your classes and interfaces, then you will not need this rule.

## Compatibility

- TSLint: [member-ordering](https://palantir.github.io/tslint/rules/member-ordering/)

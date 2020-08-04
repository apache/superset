# Bans specific types from being used (`ban-types`)

This rule bans specific types and can suggest alternatives. It does not ban the
corresponding runtime objects from being used.

## Rule Details

Examples of **incorrect** code for this rule `"String": "Use string instead"`

```ts
class Foo<F = String> extends Bar<String> implements Baz<String> {
  constructor(foo: String) {}

  exit(): Array<String> {
    const foo: String = 1 as String;
  }
}
```

Examples of **correct** code for this rule `"String": "Use string instead"`

```ts
class Foo<F = string> extends Bar<string> implements Baz<string> {
  constructor(foo: string) {}

  exit(): Array<string> {
    const foo: string = 1 as string;
  }
}
```

## Options

The banned type can either be a type name literal (`Foo`), a type name with generic parameter instantiations(s) (`Foo<Bar>`), or the empty object literal (`{}`).

```CJSON
{
    "@typescript-eslint/ban-types": ["error", {
        "types": {
            // report usages of the type using the default error message
            "Foo": null,

            // add a custom message to help explain why not to use it
            "Bar": "Don't use bar!",

            // add a custom message, AND tell the plugin how to fix it
            "String": {
                "message": "Use string instead",
                "fixWith": "string"
            }

            "{}": {
              "message": "Use object instead",
              "fixWith": "object"
            }
        }
    }]
}
```

### Example

```json
{
  "@typescript-eslint/ban-types": [
    "error",
    {
      "types": {
        "Array": null,
        "Object": "Use {} instead",
        "String": {
          "message": "Use string instead",
          "fixWith": "string"
        }
      }
    }
  ]
}
```

## Compatibility

- TSLint: [ban-types](https://palantir.github.io/tslint/rules/ban-types/)

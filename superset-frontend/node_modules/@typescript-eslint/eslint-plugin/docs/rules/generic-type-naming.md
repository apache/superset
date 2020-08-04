# Enforces naming of generic type variables (`generic-type-naming`)

It can be helpful to enforce a consistent naming style for generic type variables used within a type.
For example, prefixing them with `T` and ensuring a somewhat descriptive name, or enforcing Hungarian notation.

## Rule Details

This rule allows you to enforce conventions over type variables. By default, it does nothing.

## Options

The rule takes a single string option, which is a regular expression that type variables should match.

Examples of **correct** code with a configuration of `'^T[A-Z][a-zA-Z]+$'`:

```typescript
type ReadOnly<TType extends object> = {
  readonly [TKey in keyof TType]: TType[TKey];
};

interface SimpleMap<TValue> {
  [key: string]: TValue;
}
```

Examples of **incorrect** code with a configuration of `'^T[A-Z][a-zA-Z]+$'`:

```typescript
type ReadOnly<T extends object> = { readonly [Key in keyof T]: T[Key] };

interface SimpleMap<T> {
  [key: string]: T;
}
```

## When Not To Use It

If you do not want to enforce a naming convention for type variables.

## Further Reading

- [TypeScript Generics](https://www.typescriptlang.org/docs/handbook/generics.html)

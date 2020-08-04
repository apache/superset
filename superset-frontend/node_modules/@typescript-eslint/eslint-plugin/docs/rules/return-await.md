# Enforces consistent returning of awaited values (`return-await`)

Returning an awaited promise can make sense for better stack trace information as well as for consistent error handling (returned promises will not be caught in an async function try/catch).

## Rule Details

The `@typescript-eslint/return-await` rule specifies that awaiting a returned non-promise is never allowed. By default, the rule requires awaiting a returned promise in a `try-catch-finally` block and disallows returning an awaited promise in any other context. Optionally, the rule can require awaiting returned promises in all contexts, or disallow them in all contexts.

## Options

`in-try-catch` (default): `await`-ing a returned promise is required in `try-catch-finally` blocks and disallowed elsewhere.

`always`: `await`-ing a returned promise is required everywhere.

`never`: `await`-ing a returned promise is disallowed everywhere.

```typescript
// valid in-try-catch
async function validInTryCatch1() {
  try {
    return await Promise.resolve('try');
  } catch (e) {}
}

async function validInTryCatch2() {
  return Promise.resolve('try');
}

async function validInTryCatch3() {
  return 'value';
}

// valid always
async function validAlways1() {
  try {
    return await Promise.resolve('try');
  } catch (e) {}
}

async function validAlways2() {
  return await Promise.resolve('try');
}

async function validAlways3() {
  return 'value';
}

// valid never
async function validNever1() {
  try {
    return Promise.resolve('try');
  } catch (e) {}
}

async function validNever2() {
  return Promise.resolve('try');
}

async function validNever3() {
  return 'value';
}
```

```typescript
// invalid in-try-catch
async function invalidInTryCatch1() {
  try {
    return Promise.resolve('try');
  } catch (e) {}
}

async function invalidInTryCatch2() {
  return await Promise.resolve('try');
}

async function invalidInTryCatch3() {
  return await 'value';
}

// invalid always
async function invalidAlways1() {
  try {
    return Promise.resolve('try');
  } catch (e) {}
}

async function invalidAlways2() {
  return Promise.resolve('try');
}

async function invalidAlways3() {
  return await 'value';
}

// invalid never
async function invalidNever1() {
  try {
    return await Promise.resolve('try');
  } catch (e) {}
}

async function invalidNever2() {
  return await Promise.resolve('try');
}

async function invalidNever3() {
  return await 'value';
}
```

The rule also applies to `finally` blocks. So the following would be invalid with default options:

```typescript
async function invalid() {
  try {
    return await Promise.resolve('try');
  } catch (e) {
    return Promise.resolve('catch');
  } finally {
    // cleanup
  }
}
```

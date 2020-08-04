# nyc-config-typescript

Handy default configuration for instrumenting your TypeScript-backed
project with test coverage using [nyc](https://github.com/istanbuljs/nyc).

First install the dependencies:

```
npm i -D nyc source-map-support ts-node @istanbuljs/nyc-config-typescript
```

**Your `tsconfig.json` must be configured to produce source maps, either inline or as sibling files.**

## .nycrc

And write a `.nycrc` that looks like this:

```js
{
    "extends": "@istanbuljs/nyc-config-typescript",
    // OPTIONAL if you want coverage reported on every file, including those that aren't tested:
    "all": true
}
```

This package specifies the `cache`, `exclude`, and `extension` options for you - only override those if you absolutely must.

## Running Tests

If you're using `mocha`:

### test/mocha.opts

```
--require ts-node/register #replace with ts-node/register/transpile-only if you have custom types
--require source-map-support/register
--recursive
<glob for your test files>
```

Now setup the test scripts in your package.json like so (with the equivalent for your test runner):

```json
{
    "test": "tsc && nyc mocha"
}
```

## License

ISC

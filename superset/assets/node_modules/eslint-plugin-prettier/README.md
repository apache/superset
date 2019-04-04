# eslint-plugin-prettier [![Build Status](https://travis-ci.org/prettier/eslint-plugin-prettier.svg?branch=master)](https://travis-ci.org/prettier/eslint-plugin-prettier)

Runs [Prettier](https://github.com/prettier/prettier) as an [ESLint](http://eslint.org) rule and reports differences as individual ESLint issues.

## Sample

```js
error: Insert `,` (prettier/prettier) at pkg/commons-atom/ActiveEditorRegistry.js:22:25:
  20 | import {
  21 |   observeActiveEditorsDebounced,
> 22 |   editorChangesDebounced
     |                         ^
  23 | } from './debounced';;
  24 |
  25 | import {observableFromSubscribeFunction} from '../commons-node/event';


error: Delete `;` (prettier/prettier) at pkg/commons-atom/ActiveEditorRegistry.js:23:21:
  21 |   observeActiveEditorsDebounced,
  22 |   editorChangesDebounced
> 23 | } from './debounced';;
     |                     ^
  24 |
  25 | import {observableFromSubscribeFunction} from '../commons-node/event';
  26 | import {cacheWhileSubscribed} from '../commons-node/observable';


2 errors found.
```

> `./node_modules/.bin/eslint --format codeframe pkg/commons-atom/ActiveEditorRegistry.js` (code from [nuclide](https://github.com/facebook/nuclide)).

## Installation

```sh
npm install --save-dev eslint-plugin-prettier
npm install --save-dev --save-exact prettier
```

**_`eslint-plugin-prettier` does not install Prettier or ESLint for you._** _You must install these yourself._

Then, in your `.eslintrc.json`:

```json
{
  "plugins": [
    "prettier"
  ],
  "rules": {
    "prettier/prettier": "error"
  }
}
```

## Recommended Configuration

This plugin works best if you disable all other ESLint rules relating to code formatting, and only enable rules that detect patterns in the AST. (If another active ESLint rule disagrees with `prettier` about how code should be formatted, it will be impossible to avoid lint errors.) You can use [eslint-config-prettier](https://github.com/prettier/eslint-config-prettier) to disable all formatting-related ESLint rules.

If your desired formatting does not match the `prettier` output, you should use a different tool such as [prettier-eslint](https://github.com/prettier/prettier-eslint) instead.

To integrate this plugin with `eslint-config-prettier`, you can use the `"recommended"` configuration:

1. In addition to the above installation instructions, install `eslint-config-prettier`:

  ```sh
  npm install --save-dev eslint-config-prettier
  ```

2. Then you need to add `plugin:prettier/recommended` as the last extension in your `.eslintrc.json`:

  ```json
  {
    "extends": [
      "plugin:prettier/recommended"
    ]
  }
  ```

This does three things:

* Enables `eslint-plugin-prettier`.
* Sets the `prettier/prettier` rule to `"error"`.
* Extends the `eslint-config-prettier` configuration.

You can then set Prettier's own options inside a `.prettierrc` file.

3. In order to support special ESLint plugins (e.g. [eslint-plugin-react](https://github.com/yannickcr/eslint-plugin-react)), add extra exclusions for the plugins you use like so:

```json
{
  "extends": [
    "plugin:prettier/recommended",
    "prettier/flowtype",
    "prettier/react",
    "prettier/standard"
  ]
}
```

For the list of every available exclusion rule set, please see the [readme of eslint-config-prettier](https://github.com/prettier/eslint-config-prettier/blob/master/README.md).

## Options

> Note: While it is possible to pass options to Prettier via your ESLint configuration file, it is not recommended because editor extensions such as `prettier-atom` and `prettier-vscode` **will** read [`.prettierrc`](https://prettier.io/docs/en/configuration.html), but **won't** read settings from ESLint, which can lead to an inconsistent experience.

* The first option:
  - Objects are passed directly to Prettier as [options](https://prettier.io/docs/en/options.html). Example:
    
    ```json
    "prettier/prettier": ["error", {"singleQuote": true, "parser": "flow"}]
    ```

  - Or the string `"fb"` may be used to set "Facebook style" defaults:

    ```json
    "prettier/prettier": ["error", "fb"]
    ```

    Equivalent to:

    ```json
    "prettier/prettier": ["error", {
      "singleQuote": true,
      "trailingComma": "all",
      "bracketSpacing": false,
      "jsxBracketSameLine": true,
      "parser": "flow"
    }]
    ```
  NB: This option will merge and override any config set with `.prettierrc` files (for Prettier < 1.7.0, [config files are ignored](https://github.com/prettier/eslint-plugin-prettier/issues/46))

* The second option:

  - A string with a pragma that triggers this rule. By default, this rule applies to all files. However, if you set a pragma (this option), only files with that pragma in the heading docblock will be checked. All pragmas must start with `@`. Example:

    ```json
    "prettier/prettier": ["error", null, "@prettier"]
    ```

    Only files with `@prettier` in the heading docblock will be checked:

    ```js
    /** @prettier */

    console.log(1 + 2 + 3);
    ```

    Or:

    ```js
    /**
     * @prettier
     */

    console.log(4 + 5 + 6);
    ```

    _This option is useful if you're migrating a large codebase and already use pragmas like `@flow`._
  
  - An object with the following options
  
    - `pragma`: Also sets the aforementioned `pragma`: a string with a pragma that triggers this rule. By default, this rule applies to all files. However, if you set a pragma (this option), only files with that pragma in the heading docblock will be checked. All pragmas must start with `@`.
    
      ```json
      "prettier/prettier": ["error", null, {
        "pragma": "@prettier"
      }]
      ```
      
    - `usePrettierrc`: Enables loading of the Prettier configuration file, (default: `true`). May be useful if you are using multiple tools that conflict with each other, or do not wish to mix your ESLint settings with your Prettier configuration.
    
      ```json
      "prettier/prettier": ["error", null, {
        "usePrettierrc": false
      }]
      ```

* The rule is autofixable -- if you run `eslint` with the `--fix` flag, your code will be formatted according to `prettier` style.

---

## Contributing

See [CONTRIBUTING.md](https://github.com/prettier/eslint-plugin-prettier/blob/master/CONTRIBUTING.md)

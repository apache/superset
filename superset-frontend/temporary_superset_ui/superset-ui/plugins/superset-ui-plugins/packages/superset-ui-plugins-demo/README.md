## @superset-ui/demo

[![Version](https://img.shields.io/npm/v/@superset-ui/demo.svg?style=flat)](https://img.shields.io/npm/v/@superset-ui/demo.svg?style=flat)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-demo&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-demo)

Storybook of `@superset-ui` packages. See it live at
[apache-superset.github.io/superset-ui](https://apache-superset.github.io/superset-ui)

### Development

#### Run storybook

To view the storybook locally, you should:

1. Clone the [superset-ui](https://github.com/apache-superset/superset-ui) monorepo.
2. Run `yarn install && yarn run bootstrap` in the `superset-ui` root directory.  This will install all dependencies for this package and sym-link any `@superset-ui` packages to your local system.
3. Clone [superset-ui-plugins](https://github.com/apache-superset/superset-ui-plugins) repo.
4. Run `yarn install && yarn build` in the `superset-ui-plugins` root directory.
5. Change to the demo directory `cd packages/superset-ui-plugins-demo`.
6. Run `yarn run storybook`.  This will open up a dev server at http://localhost:9001.

#### Adding new stories

###### Existing package

If stories already exist for the package you are adding, simply extend the `examples` already
exported for that package in the `storybook/stories/<package>/index.js` file.

###### New package

If you are creating stories for a package that doesn't yet have any stories, follow these steps:

1. Add any new package dependencies (including any `@superset-ui/*` packages) via
   `yarn add <package>`.

2. Create a new folder that mirrors the package name

   > e.g., `mkdir storybook/stories/superset-ui-color/`

3. Add an `index.js` file to that folder with a default export with the following shape:

> you can use the `|` separator within the `storyPath` string to denote _nested_ stories e.g.,
> `storyPath: '@superset-ui/package|Nested i|Nested ii'`

```javascript
 default export {
   examples: [
     {
       storyPath: <string>,
       storyName: <string>,
       renderStory: <func> () => node,
     },
     ...
   ]
 };
```

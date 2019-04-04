Changelog
------------

##### 3.1.3
* Added `cursor: pointer` style by defalut to select options.

##### 3.1.2
* (Nothing.)

##### 3.1.1
* Added missing `valueKey` to custom option renderer params.

##### 3.1.0
* Default option renderer supports a `className` property on options.

##### 3.0.1
* Revert v2.4.2, https://github.com/bvaughn/react-virtualized-select/issues/57#issuecomment-297742641

##### 3.0.0
* Same as v2.4.2 but with an updated external dependency versions (eg react-virtualized 8.x to 9.x, new prop-types lib, react alpha 16, etc).

##### 2.4.2
* Backwards compat bugfix for `require('...').default` usecase (see issue #57).

##### 2.4.1
* 🎉 UMD build fixed to properly set `window.VirtualizedSelect` ([@armed](https://github.com/armed) - [#56](https://github.com/bvaughn/react-virtualized-select/pull/56))

##### 2.4.0
* 🎉 Support option `title` attribute ([@targumon](https://github.com/targumon) - [#46](https://github.com/bvaughn/react-virtualized-select/pull/46))

##### 2.3.0
* 🎉 `focus` method added to `VirtualizedSelect` ([@Syynth](https://github.com/Syynth) - [#41](https://github.com/bvaughn/react-virtualized-select/pull/41))

##### 2.2.0
* 🎉 Default option renderer highlights selected option in bold ([@the-spyke](https://github.com/the-spyke) - [#40](https://github.com/bvaughn/react-virtualized-select/pull/40))

##### 2.1.1
Added a workaround for a bug in `Creatable` (react-select 1.0.0-rc2).
Clicking on the placeholder item now successfully creates new options.
See issue #33.

##### 2.1.0
Added `listProps` prop to enable pass-through of additional, custom properties to the underlying react-virtualized `List`.

##### 2.0.2
Dramatically reduced library size by limiting the parts of react-virtualized that are imported.

##### 2.0.1
Utilizes `babel-plugin-transform-runtime` to remove `babelHelpers` from the built dist.
This enables support without requiring the `babel-external-helpers` plugin in application code.

##### 2.0.0
Updates to `react-virtualized` 8.x release.
Read more about version 8 changes [here](https://github.com/bvaughn/react-virtualized/issues/386).

Contains no new user-facing functionality but requires a major update due to the updated `optionRenderer` interface.
Renderers will now receive 2 additional named properties: `key` and `style`.
Both should be passed through to the top-level element of their rendered response.
For example:

```jsx
// react-virtualized-select 1.x
function optionRendererBefore ({ option, ...rest }) {
  return (
    <div>
      {option.name}
    </div>
  )
}

// react-virtualized-select 2.x
function optionRendererAfter ({ key, option, style, ...rest }) {
  return (
    <div
      key={key}
      style={style}
    >
      {option.name}
    </div>
  )
}
```

##### 1.4.0
Added `selectComponent` option to enable users to choose a sepecific select HOC (eg `Select.Creatable`).

##### 1.3.0
Added support for `disabled` attribute in options array.

##### 1.2.0
Added support for async options (`Select.Async`) via new `async` boolean property.

##### 1.1.1
Fixed a regression for non-function `optionHeight` values.

##### 1.1.0
Supports dynamic option heights via `optionHeight` as a function.
Function should implement the following signature: `({ option: Object }): number`

##### 1.0.0
First major release; interface now stable.

##### 0.0.4
Dependency bump for React 15.0 now that it has been released.

##### 0.0.3
Finalized props signature of `VirtualizedSelect`; changed `rowRenderer` to `optionRenderer` to better align with `react-select` terminology.

##### 0.0.2
Moved `react-select` and `react-virtualized` from `peerDependencies` to `dependencies` block.
Updated CommonJS/ES module build to export `VirtualizedSelect` as a default.

##### 0.0.1
Initial release.

##### 0.0.0
Reserved NPM package name.

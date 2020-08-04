Changelog
------------

##### 9.19.1

* Updated [react-lifecycles-compat](https://github.com/reactjs/react-lifecycles-compat) to 3.0.4. ([pigcan](https://github.com/pigcan)) - [#1114](https://github.com/bvaughn/react-virtualized/pull/1114)

##### 9.19.0

* Replaced `componentWillMount`, `componentWillReceiveProps`, and `componentWillUpdate` with async-safe lifecycles in advance of React 16.x deprecation warnings. Added [react-lifecycles-compat](https://github.com/reactjs/react-lifecycles-compat) as a dependency, to ensure backwards compatibility.
* Public flow interface for `CellMeasurer`. ([diogofcunha](https://github.com/diogofcunha)) - [#1058](https://github.com/bvaughn/react-virtualized/pull/1058)
* Improved build by setting `sideEffects` to `false`. ([0xR](https://github.com/0xR)) - [#1064](https://github.com/bvaughn/react-virtualized/pull/1064)
* 🐛 Fix flow type checks. ([RyanLiu0235](https://github.com/RyanLiu0235)) - [#1066](https://github.com/bvaughn/react-virtualized/pull/1066)
* Rollup for UMD build. ([TrySound](https://github.com/TrySound)) - [#994](https://github.com/bvaughn/react-virtualized/pull/994)
* Row direction support for `Masonry` ([bardiarastin](https://github.com/bardiarastin)) - [#1071](https://github.com/bvaughn/react-virtualized/pull/1071)
* Add lint-staged and precommit hooks ([TrySound](https://github.com/TrySound)) - [#1082](https://github.com/bvaughn/react-virtualized/pull/1082)
* Add `scrollToRow` and `scrollToColumn` support for ssr. ([microcood](https://github.com/microcood)) - [#1072](https://github.com/bvaughn/react-virtualized/pull/1072)
* Add `getTotalRowsHeight` and `getTotalColumnsWidth` to `Grid`. ([nihgwu](https://github.com/nihgwu)) - [#1022](https://github.com/bvaughn/react-virtualized/pull/1022)
* Allow top-right and bottom-left scrollbars in `MultiGrid` be hidden. ([RaviDasari](https://github.com/RaviDasari)) - [#1040](https://github.com/bvaughn/react-virtualized/pull/1040)
* Documentation changes
  * Added `forceUpdateGrid` documentation for `MultiGrid`. ([kartikluke](https://github.com/kartikluke)) - [#1079](https://github.com/bvaughn/react-virtualized/pull/1079)  
  * 🐛 Fixed typo in `Grid` docs. ([r-kot](https://github.com/r-kot)) - [#1092](https://github.com/bvaughn/react-virtualized/pull/1092)
  * 🐛 Fixed typo in `Collection` docs. ([skipjack](https://github.com/skipjack)) - [#1050](https://github.com/bvaughn/react-virtualized/pull/1050)
  * Added dynamically measured images example for `Masonry`. ([kirill-konshin](https://github.com/kirill-konshin)) - [#1081](https://github.com/bvaughn/react-virtualized/pull/1081)  


##### 9.18.5
* 🐛 Revert changes > 9.18.0

<!--
##### 9.18.1
* ✨ Prevent generating cjs `prop-types` requires in esm build ([TrySound](https://github.com/TrySound) - [#950](https://github.com/bvaughn/react-virtualized/pull/950))
-->

##### 9.18.0
* ✨ Add `onScrollbarPresenceChange` prop to `MultiGrid`.

##### 9.17.3
* 🐛 Fix `Grid` server-side rendering which was broken after natural scrolling tweak in Chrome. ([TrySound](https://github.com/TrySound) - [#970](https://github.com/bvaughn/react-virtualized/pull/970))

##### 9.17.2
* ✨ Eliminate unnecessary renders for `CellMeasurer` and `Grid`. ([bvaughn](https://github.com/bvaughn) - [#969](https://github.com/bvaughn/react-virtualized/pull/969))

##### 9.17.1
* 🐛 `CellMeasurer` works properly in iframes and popup windows. ([dfdeagle47](https://github.com/dfdeagle47) - [#968](https://github.com/bvaughn/react-virtualized/pull/968))

##### 9.17.0

* More natural scrolling speeds for large lists in Chrome. ([TrySound](https://github.com/TrySound) - [#936](https://github.com/bvaughn/react-virtualized/pull/936))
* Support for multi-column sort added to `Table` component. Read more about this [here](https://github.com/bvaughn/react-virtualized/blob/master/docs/multiColumnSortTable.md). Special thanks to [CzBuCHi](https://github.com/CzBuCHi) for the initial proposal and iteration in PRs [#946](https://github.com/bvaughn/react-virtualized/pull/946) and [#957](https://github.com/bvaughn/react-virtualized/pull/957). ([bvaughn](https://github.com/bvaughn) - [#966](https://github.com/bvaughn/react-virtualized/pull/966))
* ✨ Improved `Table` performance for cases with large numbers of columns. ([gannunziata](https://github.com/gannunziata) - [#942](https://github.com/bvaughn/react-virtualized/pull/942))
* 🐛 Fixed potential initial render bug when using `CellMeasurer` with a `List`. ([OriR](https://github.com/OriR) - [#959](https://github.com/bvaughn/react-virtualized/pull/959))
* 🐛 `Masonry` component now renders at least one column to avoid an invalid, Infinity height layout issue. ([djeeg](https://github.com/djeeg) - [#961](https://github.com/bvaughn/react-virtualized/pull/961))
* 🎉 Optional `className` and `style` props added to `AutoSizer` component.

##### 9.16.1

* 🐛 Run server-side rendering tests under pure node environment and fix SSR in `WindowScroller` ([TrySound](https://github.com/TrySound) - [#953](https://github.com/bvaughn/react-virtualized/pull/953))
* 🎉 Warn on passing wrong value to registerChild in `WindowScroller` ([TrySound](https://github.com/TrySound) - [#949](https://github.com/bvaughn/react-virtualized/pull/949))
* 🐛 Fixed overrided merge `WindowScroller` scrollElement prop type ([TrySound](https://github.com/TrySound) - [#948](https://github.com/bvaughn/react-virtualized/pull/948))
* 🎉 `AutoSizer` (via the `detectElementResize` helper) now supports properly rendering into iframes and child windows ([ahutchings](https://github.com/ahutchings) - [#900](https://github.com/bvaughn/react-virtualized/pull/900))

##### 9.16.0

* 🐛 Fixed window check for SSR in `detectElementResize` ([eqyiel](https://github.com/eqyiel) - [#945](https://github.com/bvaughn/react-virtualized/pull/945))
* 🎉 Allowed custom `WindowScroller` child with `registerChild` in children function ([TrySound](https://github.com/TrySound) - [#940](https://github.com/bvaughn/react-virtualized/pull/940) and [#947](https://github.com/bvaughn/react-virtualized/pull/947))
* 🐛 Fixed `WindowScroller` scrollElement prop type ([TrySound](https://github.com/TrySound) - [#939](https://github.com/bvaughn/react-virtualized/pull/939))

##### 9.15.0

* 🎉 Detected `WindowScroller` container (not only window) resize similar to `AutoSizer` ([TrySound](https://github.com/TrySound) - [#918](https://github.com/bvaughn/react-virtualized/pull/918))
* 🐛 Prevented position breaking on `WindowScroller` container resize ([TrySound](https://github.com/TrySound) - [#920](https://github.com/bvaughn/react-virtualized/pull/920))
* 🎉 Published `AutoSizer` Flow types ([TrySound](https://github.com/TrySound) - [#934](https://github.com/bvaughn/react-virtualized/pull/934))
* 🎉 Published `WindowScroller` Flow types ([TrySound](https://github.com/TrySound) - [#915](https://github.com/bvaughn/react-virtualized/pull/915))

##### 9.14.1
* 🐛 Fixed server-side rendering bug in `WindowScroller` with undefined `window` variable.

##### 9.14.0
* 🎉 Added `serverHeight` and `serverWidth` props to `WindowScroller` for better server-side rendering support.

##### 9.13.0
* 🎉 Added `headerStyle` support for `Table` columns ([@mucsi96](https://github.com/mucsi96) - [#877](https://github.com/bvaughn/react-virtualized/pull/877))
* 🐛 Fixed `Masonry` bug that caused cells to be unnecessarily destroyed and then recreated when new cells were measured - d561d9c

##### 9.12.0
* 🎉 Added `defaultWidth` and `defaultHeight` props to `AutoSizer` to better support server-side rendering.

##### 9.11.1
* 🐛 `Masonry` component now properly pre-renders as specified by `overscanByPixels`

##### 9.11.0
* 🐛 `List` and `Grid` scroll snapping / resetting bugfix #825 by @TrySound
* 🐛 `MultiGrid` crash due to `scrollTo*` prop being `NaN` #829 by @mcordova47
* 🐛 `MultiGrid` invalid `tabIndex` prop type #818 by @kalley
* 🎉 Column default sort direction #833 by @mbseid

##### 9.10.1
* 🐛 Server-side rendering `window` reference bugfix
* 🐛 `Grid.defaultProps` bugfix

##### 9.10.0
* ✨ `Grid` uses `requestAnimationFrame` instead of `setTimeout` for improved scroll-ended debounce timing ([@guilhermefloriani](https://github.com/guilhermefloriani) - [#742](https://github.com/bvaughn/react-virtualized/pull/742))
* 🎉 `onRowRightClick` prop added to `Table` ([@damian-codilime](https://github.com/damian-codilime) - [#741](https://github.com/bvaughn/react-virtualized/pull/741))
* 🎉 `Table` component now allow children that extend `Column` ([@CptLemming](https://github.com/CptLemming) - [#748](https://github.com/bvaughn/react-virtualized/pull/748))
* 🐛 Firefox edge-case bugfix ([@ReinAkane](https://github.com/ReinAkane) - [#798](https://github.com/bvaughn/react-virtualized/pull/798))
* 🎉 `containerProps` prop added to `Grid` ([@implausible](https://github.com/implausible) - [#778](https://github.com/bvaughn/react-virtualized/pull/778))
* ✨ `Grid` accessibility improved via better aria attributes ([@smockle](https://github.com/smockle) - [#744](https://github.com/bvaughn/react-virtualized/pull/744))
* ✨ `CellMeasurererCache.clearAll` also sets row and column counts ([@tcosentino](https://github.com/tcosentino) - [#796](https://github.com/bvaughn/react-virtualized/pull/796))

##### 9.9.0
* 🎉 `InfiniteLoader` API method `resetLoadMoreRowsCache` accepts optional parameter to auto-reload most recent range of rows. ([@BamaBoy](https://github.com/BamaBoy) - [#704](https://github.com/bvaughn/react-virtualized/pull/704))
* 🎉 `MultiGrid` now supports scrolling when hovering over fixed rows or columns by way of new `enableFixedColumnScroll` and `enableFixedRowScroll` props. ([@danalloway](https://github.com/danalloway) - [#708](https://github.com/bvaughn/react-virtualized/pull/708))
* 🎉 `WindowScroller` supports new configurable `scrollingResetTimeInterval` prop (similar to `Grid`). ([@djeeg](https://github.com/djeeg) - [#728](https://github.com/bvaughn/react-virtualized/pull/728))
* 🐛 Edge-case bugfix for style caching of `Grids` locked with `ScrollSync`. ([@nathanpower](https://github.com/nathanpower) - [#727](https://github.com/bvaughn/react-virtualized/pull/727))
* ✨ New `onScrollbarPresenceChange` prop added to `Grid`.

##### 9.8.0
* 🎉 `WindowScroller` supports `scrollToIndex` prop. ([@leoasis](https://github.com/leoasis) - [#643](https://github.com/bvaughn/react-virtualized/pull/643))
* 🎉 Allow `ArrowKeyStepper` to be used as a controlled component. ([@mking-clari](https://github.com/mking-clari) - [#688](https://github.com/bvaughn/react-virtualized/pull/688))
* 🎉New `handleScroll` method on `Grid` to better support custom scrollbars. ([@5angel](https://github.com/5angel) - [#693](https://github.com/bvaughn/react-virtualized/pull/693))
* 🐛 Added edge-case gaurd to `WindowScroller ` to prevent calling `setState` when unmounted. ([@liorbrauer](https://github.com/liorbrauer) - [#689](https://github.com/bvaughn/react-virtualized/pull/689))
* 🐛 Fixed edge-case in `Grid` where setting an initial scroll-to offset with a `height` or `width` of 0 caused the scroll-to prop to be ignored when size later changed. ([#691](https://github.com/bvaughn/react-virtualized/pull/691))

##### 9.7.6
* ✨ Better aria roles set for `Table` column cells and headers. ([@jchen527](https://github.com/jchen527) - [#681](https://github.com/bvaughn/react-virtualized/pull/681))
* 🐛 `CellMeasurer` restores `width` and `height` `style` values after measuring to avoid edge-case layout bugs. ([@marcelmokos](https://github.com/marcelmokos) - [#675](https://github.com/bvaughn/react-virtualized/pull/675))

##### 9.7.5
* ✨ Improved performance for `CellMeasurerCache` by removing some unnecessary computations for fixed-width/fixed-height use cases. ([@RaviDasari](https://github.com/RaviDasari) - [#676](https://github.com/bvaughn/react-virtualized/pull/676))
* 🐛 `MultiGrid` ensures correct row/column indices are passed to `CellMeasurerCache` for top-right and bottom `Grid`s. ([#670](https://github.com/bvaughn/react-virtualized/pull/670))

##### 9.7.4
* 🎉 Add `nonce` attribute to `AutoSizer` for better [Content Security Policy compliance](https://www.w3.org/TR/2016/REC-CSP2-20161215/#script-src-the-nonce-attribute). ([@akihikodaki](https://github.com/akihikodaki) - [#663](https://github.com/bvaughn/react-virtualized/pull/663))
* ✨ `Column` renderers now accept a `columnIndex` parameter as well. This allows multiple `Table` columns to more easily use `CellMeasurer` to compute the min row height. ([@BamaBoy](https://github.com/BamaBoy) - [#662](https://github.com/bvaughn/react-virtualized/pull/662))

##### 9.7.3
* Clear cell and style cache when controlled-scroll mode `Grid` stops scrolling. ([@leoasis](https://github.com/leoasis) - [#649](https://github.com/bvaughn/react-virtualized/pull/649))

##### 9.7.2
* ✨ Removed lingering `React.PropTypes` reference in `InfiniteLoader`.

##### 9.7.1
* ✨ Added `prop-types` dependency to avoid deprecation warnings for React 15.5+.

##### 9.7.0
* Added public animation-friendly API methods to `Grid`/`List`/`Table` for an alternative to props-based animating. ([@imadha](https://github.com/imadha) - [#641](https://github.com/bvaughn/react-virtualized/pull/641))

##### 9.6.1
* 🐛 Fixed module syntax error in vendered file.

##### 9.6.0
* 🎉 `WindowScroller` and `Grid` now support horizontal window-scrolling via new `autoWidth` property. ([@maxnowack](https://github.com/maxnowack) - [#644](https://github.com/bvaughn/react-virtualized/pull/644))
* 🐛 Fixed a Content Security Policy (CSP) issue in an upstream dependency that impacted users of the `Masonry` component. For more information see issue [#640](https://github.com/bvaughn/react-virtualized/issues/640).
* ✨ `List` and `Table` always overscan 1 row in the direction _not_ being scrolled to better support keyboard nativigation (via TAB and SHIFT+TAB). For more information see [issue #625](https://github.com/bvaughn/react-virtualized/issues/625).
* ✨ `Grid` no longer alters scroll direction for one axis (eg vertical) if a scroll event occurs for another axis (eg horizontal).

##### 9.5.0
* 🎉 `Grid` supports state-override of `isScrolling` value via new `isScrolling` prop. This enables cache-while-scrolling of cells when used with `WindowScroller`. ([@olavk](https://github.com/olavk) - [#639](https://github.com/bvaughn/react-virtualized/pull/639))

##### 9.4.2
* 🐛 Small accessibility fix to `MultiGrid` so that focus outline shows through by default for main (bottom/right) `Grid`. Top and left `Grid`s are also not tab-focusable by default now since they are scroll-observers anyway.
* ✨ Added `columnWidth` parameter to `ColumnSizer` and deprecated `getColumnWidth` callback. The callback was not necessary since `columnWidth` doesn't change without a re-render and fixed number values perform better in `Grid` due to some internal optimizations anyway.

##### 9.4.1
* 🐛 Edge-case `InfiniteLoader` bug fix; prevent jumping to the first row when scrolling fast. ([@reVrost](https://github.com/reVrost) - [#632](https://github.com/bvaughn/react-virtualized/pull/632))
* 🐛 Reverted unexpected regression from [#616](https://github.com/bvaughn/react-virtualized/pull/616) until a safer fix can be found.

##### 9.4.0
* 🎉 New `Masonry` component optimized for Pinterest-style layouts. Check out the [docs](https://github.com/bvaughn/react-virtualized/blob/master/docs/Masonry.md) and [demo page](https://bvaughn.github.io/react-virtualized/#/components/Masonry) to learn more. ([#618](https://github.com/bvaughn/react-virtualized/pull/618))
* 🎉 `MultiGrid` supports `scrollLeft` and `scrollTop` props for controlled scrolling. ([@julianwong94](https://github.com/julianwong94) - [#624](https://github.com/bvaughn/react-virtualized/pull/624))
* 🎉 New `direction` parameter passed to `overscanIndicesGetter` with values "horizontal" or "vertical". ([@offsky](https://github.com/offsky) - [#629](https://github.com/bvaughn/react-virtualized/pull/629))
* ✨ Replaced inline `require` statement with header `import` in `Grid` for better integration with the Rollup module bundler. ([@odogono](https://github.com/odogono) - [#617](https://github.com/bvaughn/react-virtualized/pull/617))
* 🐛 Improved guard for edge-case scrolling issue with rubberband scrolling in iOS. ([@dtoddtarsi](https://github.com/offsky) - [#616](https://github.com/bvaughn/react-virtualized/pull/616))
* ✨ Replaced `getBoundingClientRect()` with slightly faster `offsetWidth` and `offsetHeight` inside of `AutoSizer`.
* ✨ `AutoSizer` no longer re-renders nor calls `onResize` callback unless `width` and/or `height` have changed (depending on which properties are being watched).

##### 9.3.0
* 🎉 Added `resetLoadMoreRowsCache` method to `InfiniteLoader` to reset any cached data about loaded rows. This method should be called if any/all loaded data needs to be refetched (eg a filtered list where the search criteria changes). ([#612](https://github.com/bvaughn/react-virtualized/issues/612))

##### 9.2.3
* 🐛 `CellMeasurer` should work better out of the box with `MultiGrid`.
* 🐛 `CellMeasurerCache` should return correct values from `rowHeight` and `columnWidth` functions when `keyMapper` is used. ([#613](https://github.com/bvaughn/react-virtualized/pull/613))

##### 9.2.2
* 🐛 Fixed small scrollbar offset bug in `MultiGrid`. ([#609](https://github.com/bvaughn/react-virtualized/issues/609))

##### 9.2.1
* 🐛 Fixed potential scrollbar offset bug in `MultiGrid` by giving top and left `Grid`s a little extra space to scroll into. ([#535](https://github.com/bvaughn/react-virtualized/pull/535))

##### 9.2.0
* 🎉 New `Table` prop, `headerRowRenderer`. ([@kaoDev](https://github.com/kaoDev) - [#600](https://github.com/bvaughn/react-virtualized/pull/600))
* 🎉 All `Table` event handlers now receive a named `event` params ([@paulbrom](https://github.com/paulbrom) - [#605](https://github.com/bvaughn/react-virtualized/pull/605))
* 🎉 Aria roles for `Table` improved to specify `role="row"` for table rows and `role="rowgroup"` for inner `Grid`. ([@jchen527](https://github.com/jchen527) - [#607](https://github.com/bvaughn/react-virtualized/pull/607))
* 🐛 Calling `scrollToRow` for `List` or `Table` no longer potentially messes up horizontal scroll position. ([#603](https://github.com/bvaughn/react-virtualized/issues/603))

##### 9.1.0
* 🎉 Public method `setScrollIndexes` added to `ArrowKeyStepper` to enable easier overrides of current/default focused cell. - ([@alexandro81](https://github.com/alexandro81) - [#592](https://github.com/bvaughn/react-virtualized/pull/592))
* ✨ Replaced `value instanceof Function` checks with `typeof value === 'function'` for improved robustness with iframes/frames/popups. (Learn more [here](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof#instanceof_and_multiple_context_(e.g._frames_or_windows)).) ([@rickychien](https://github.com/rickychien) - [#596](https://github.com/bvaughn/react-virtualized/pull/596))
* 🐛 `Grid` props `scrollToColumn` and `scrollToRow` as well as `Collection` prop `scrollToCell` now default to `-1` to avoid false positives from `null>=0` check. - ([#595](https://github.com/bvaughn/react-virtualized/issues/595))

##### 9.0.5
* 🎉 Explicitly set `width`/`height` style to "auto" before re-measuring `CellMeasurer` content so that new measurements can be taken. ([#593](https://github.com/bvaughn/react-virtualized/issues/593))
* 🐛 CellMeasurerCache now correctly recomputes cached row height and column width values when cells are cleared. ([#594](https://github.com/bvaughn/react-virtualized/issues/594))

##### 9.0.4
* 🐛 Moved flow-bin from 'dependencies' to 'devDependencies'. This was accidentally placed as a dep before.

##### 9.0.3
* 🐛 `Grid` takes scrollbar size into account when aligning cells for `scrollToColumn` or `scrollToRow` usage. ([#543](https://github.com/bvaughn/react-virtualized/issues/543))

##### 9.0.2
* 🎉 Added additional DEV-only warnings for improperly configured `CellMeasurerCache` based on user-feedback for the new API.
* 🐛 Fixed edge-case where restoring `columnCount` from 0 wouldnt properly restore previous `scrollToRow` offset (and vice versa for `rowCount` and `scrollToColumn`)
* Updated `Grid` and `Collection` to move some state-setting logic related to offsets from `componentWillUpdate` to `componentWillReceiveProps`. This change should have no externally visible impact. ([#585](https://github.com/bvaughn/react-virtualized/issues/585))

##### 9.0.1
* 🐛 Edge-case bug with scroll-to-index and cell size function property ([#565](https://github.com/bvaughn/react-virtualized/issues/565))
* 🐛 Edge-case bug with `WindowScroller` and mocked `window` object

# 9.0.0
Version 9 changes and upgrade steps are described in detail on the [version 9 pull request](https://github.com/bvaughn/react-virtualized/pull/577).

##### 8.11.4
* 🐛 Better guard against minification/uglification in `ColumnSizer` when verifying child is either a `Grid` or a `MultiGrid`. (#558)

##### 8.11.3
* Adding missing `scrollToRow` method to `List` and `Table` (as pass-thrus for `Grid.scrollToCell`).
* 🐛 Bugfixes with `MultiGrid` resize handling and caching. ([@codingbull](https://github.com/codingbull) - [#552](https://github.com/bvaughn/react-virtualized/pull/552))
* 🐛 List checks it row-style object has been frozen before modifying width; (fix for [upcoming React 16 change](https://github.com/facebook/react/commit/977357765b44af8ff0cfea327866861073095c12#commitcomment-20648713)).
* 🐛 `MultiGrid` better handles case where `rowCount === fixedRowCount`.

##### 8.11.2
* 🐛 Added `MultiGrid` method `measureAllCells`; deprecated misnamed `measureAllRows` method.

##### 8.11.1
* 🐛 Fixed regression in `WindowScroller` when browser is resized. ([@andrewbranch](https://github.com/andrewbranch) - [#548](https://github.com/bvaughn/react-virtualized/pull/548))

##### 8.11.0
* 🐛 Minor Preact compat fix to element resize detector; see [developit/preact-compat/issues/228](https://github.com/developit/preact-compat/issues/228)
* 🎉 New `scrollToCell` public method added to `Grid`.

##### 8.10.0
* 🎉 `WindowScroller` supports custom target element via a new `scrollElement` prop; defaults to `window` for backwards compatibility. ([@andrewbranch](https://github.com/andrewbranch) - [#481](https://github.com/bvaughn/react-virtualized/pull/481))
* 🐛 `MultiGrid` supports `onScroll` property. ([@Pana](https://github.com/Pana) - [#536](https://github.com/bvaughn/react-virtualized/pull/536))
* 🎉 New id-based `CellMeasurer` cell size cache, `idCellMeasurerCellSizeCache`. ([@bvaughn](https://github.com/bvaughn) - [#538](https://github.com/bvaughn/react-virtualized/pull/538))

##### 8.9.0

* New `MultiGrid` reduces the boilerplate required to configure a `Grid` with fixed columns and/or rows.
* `defaultTableRowRenderer` passes new `rowData` param to event handlers (in addition to `index`).
* 🐛 Styles are no longer cached while scrolling for compressed lists ([@nickclaw](https://github.com/nickclaw) - [#527](https://github.com/bvaughn/react-virtualized/pull/527))
* 🐛 Cell cache is reset once `InfiniteLoader` load completes ([@nickclaw](https://github.com/nickclaw) - [#528](https://github.com/bvaughn/react-virtualized/pull/528))
* Add loose-envify support for Browserify users ([@chrisvasz](https://github.com/chrisvasz) - [#519](https://github.com/bvaughn/react-virtualized/pull/519), [#523](https://github.com/bvaughn/react-virtualized/pull/523))
* `dom-helpers` dependency relaxed to support 2.x and 3.x versions ([@danez](https://github.com/danez) - [#522](https://github.com/bvaughn/react-virtualized/pull/522))
* 🐛 `Collection` no longer drops its `overflow` style in certain conditions; see facebook/react/issues/8689 for more info.

##### 8.8.1
Fixed a bug with `Grid` style-cache that caused stale cell-sizes to be used when `Grid` resized.

##### 8.8.0
`Grid` now temporarily caches inline style objects to avoid causing shallow compare to fail unnecessarily (see [PR 506](https://github.com/bvaughn/react-virtualized/pull/506)).

`AutoSizer` internal `detectElementResize` library now no longer creates duplicate `<style>` tags when unmounted and remounted (see [PR 507](https://github.com/bvaughn/react-virtualized/pull/507)).

##### 8.7.1
Reverted part of the change introduced in version 8.6.0 that changed the behavior regarding controlled/uncontrolled `scrollTop` and `scrollLeft` props and `Grid` in a way that was not backwards compatible. (See issue #490 for more.)

##### 8.7.0
Added `updatePosition` to `WindowScroller` to handle case when header items change or resize. `WindowScroller` also better handles window resize events.

##### 8.6.1
Updated `CellSizeCache` interface for the better perfomance by removing `has` methods, reducing a double hashtable lookup to a single lookup. Special thanks to @arusakov for this contribution!

##### 8.6.0
`CellMeasurer` passes `index` param (duplicate of `rowIndex`) in order to more easily integrate with `List` by default.

`Grid` now better handles a mix of controlled and uncontrolled scroll offsets. Previously changes to one offset would wipe out the other causing cells to disappear (see PR #482). This is an edge-case bug and only impacted an uncommon usecase for `Grid`. As such this change is expected to only impact only a small percetange of users.

##### 8.5.3
Changed overscan rows/cols behavior as described [here](https://github.com/bvaughn/react-virtualized/pull/478).
This change targets performance improvements only and should have no other noticeable impact.

##### 8.5.2
Added guard against potential `null` return value from `getComputedStyle` for hidden elements (see PR #465).

##### 8.5.1
`Table` header height is no longer subtracted from overall (rows) height if header is disabled.
Thanks to @Jakehp for this contribution!

##### 8.5.0
Added `disabled` property to `ArrowKeyStepper`; when `true` this component ignores keyboard events.

##### 8.4.1
`Collection` and `Grid` now set a default `direction: ltr` style property.
Neither component gracefully handles RTL layout at the moment and so it is disabled by default.
Cells within either component can be layed out RTL without any problem though.
To do so, just add an additional `direction: rtl` style property via the cell renderer.

##### 8.4.0
`ArrowKeyStepper` incrementing behavior can now be further customized via new `mode` prop.
Default behavior will remain the same (eg `mode='edges'`).
Use `mode='cells'` to prefer smaller increments.

##### 8.3.1
Fixed `scrollToAlignment` bug in `Collection` that caused cells not to render under certain conditions.
Special thanks to @coluccini for spotting and fixing this bug!

##### 8.3.0
`cellRenderer` and `rowRenderer` callbacks now accept an additional property, `isVisible`.
This property can be used to differentiate between visible and overscanned cells.
Thanks to @mbrevda for this feature!

##### 8.2.0
Added optional `id` prop to `Collection`, `Grid`, `List`, and `Table`.
Thanks to @mnquintana for the contribution!

##### 8.1.1
Wrapped component `propTypes` with `process.env.NODE_ENV !== 'production'` so they can be stripped from production builds.
Thanks to @mbrevda for the suggestion and contribution.

##### 8.1.0
Added `containerStyle` property to `Grid`.
This property allows custom styling to be applied to the inner cell-containing div.
This can be used to enable padding within the grid.
For more context see: github.com/metabase/metabase/pull/3547

Refactored the `detect-element-resize` util to export a factory function.
This allows `AutoSizer` to import it initially but defer execution until mounted.
(Executing immediately causes problems for server-side rendering context.
Using a deferred `require` causes problems for es6 bundlers, eg Rollup.)

Fixed an edge-case that occurred for slower browsers when mounting and then quickly unmounting an `AutoSizer`.
In some cases, an animation event was left attached.
This event is now specifically checked for and removed.
Special thanks to @yb (PR #436) for this bugfix contribution.

##### 8.0.13
Replaces references to `getComputedStyle` with `window.getComputedStyle` to better support Enzyme.
Thanks to @DevinClark for the contribution!

##### 8.0.12
Added "module" entry to `package.json` in order to support ES modules with the latest Webpack.
This should enable tree-shaking support ouf of the box for Webpack.
Rollup will continue to use the "jsnext:main" entry to my knowledge.

For more info see https://github.com/dherman/defense-of-dot-js/blob/master/proposal.md
Related issues: webpack/webpack#1979, bvaughn/react-virtualized/issues/427

##### 8.0.11
Fixed an invalid export for `IS_SCROLLING_TIMEOUT` inside the `WindowScroller` module.

##### 8.0.10
Changed the embedded `detect-element-resize` library `includes` call to use `indexOf` instead for better IE compatibility.

##### 8.0.9
`scrollToColumn` and `scrollToRow` offsets will always be 0 when `Grid` size is <= 0.
Technically this is an invalid size but a 0 offset is a more meaningful return value.
Previously the min/max offset check could result in a positive offset in this case (which is invalid).

##### 8.0.8
Fixes bug in resize detector that broke scrollbar functionality in Safari.

##### 8.0.7
Fixed a small `Table` alignment issue due to conflicting `padding-right` and `width: 100%` value.
Also fixed an edge-case horiztonal scrollbar that was appearing for some tables.

##### 8.0.6
Updated the embedded `detect-element-resize` library to reduce the number of reflows it triggered.
This library was forcing reflow (to measure itself) each time a scroll event occurred within its children.
This was unnecessary since it really only cared about resizes to its expand-trigger and collapse-trigger.
I have updated it to ignore scroll events triggered by other DOM elements.

As a result of this change, `AutoSizer` no longer needs to trap bubbling "scroll" events.
This opens the door to potentially using passive scroll event handlers in the future.
It also fixes a long-standing bug that prevented scrollbars from working correctly within auto-sized-content.

##### 8.0.5
`Grid` notifies `onScroll` callback if `scrollLeft` or `scrollTop` have changed in response to prop changes (including `scrollToColumn` or `scrollToRow`).

##### 8.0.4
Fixed a small regression in the `Table` component that caused a horizontal scrollbar to appear.

##### 8.0.3
Removed unnecessary `react-router` dependency.
(This was accidentally added as to `dependencies` when it should have been in `devDependencies`).

##### 8.0.2
Improved fix for regression with scaled `Grid`s that caused position offsets to be incorrect while scrolling.

##### 8.0.1
Initial attempt at fixing regression with scaled `Grid`s that caused position offsets to be incorrect while scrolling.

# 8.0.0
Version 8 changes are described in detail on the [Version 8 Roadmap](https://github.com/bvaughn/react-virtualized/issues/386).
Upgrade instructions and [jscodeshift](https://github.com/facebook/jscodeshift) mods can be found [here](docs/upgrades/Version8.md).

##### 7.24.3
ES module build (_jsnext:main_ target) updated to depend on Babel's `transform-runtime` rather than referencing global `babelHelpers`.
This should fix support within projects like `react-boilerplate`.

##### 7.24.2
`Grid` and `Collection` now set `pointer-events: ''` (instead of _auto_) after scrolling has stopped to avoid overriding parents who may have specified `pointer-events: 'none'`.

##### 7.24.1
Refactored `AutoSizer` slightly to add support for `react-lite`.

Note that if you intend to use the UMD build of `react-lite` the following lines are required before `react-virtualized` is loaded:
```js
React.addons = {
  shallowCompare (context, nextProps, nextState) {
    return React.PureComponent.prototype.shouldComponentUpdate(nextProps, nextState)
  }
};
ReactDOM = React;
```

##### 7.24.0
Added `autoHeight` prop to `Collection` so that it can more easily be used with `WindowScroller`.

##### 7.23.0
`Grid` scrolling timeout for pointer events can be customized now via `scrollingResetTimeInterval` property.
This defaults to 150ms (as before).

Also addressed a couple of small bugs as well:
* Multiple `WindowScroller` instances can be used on a single page now without interfering with each other's `pointer-events` settings.
* Calling `recomputeGridSize` on `Grid` (or any of its wrapping HOCs) will clear any pending cell cache to avoid edge-case issue where a scrolling `Grid` has invalid cached cells due to a change in the underlying collection data.

##### 7.22.3
While a scroll is in progress, `Grid` focuses overscan on the direction being scrolled- doubling up the number of overscanned cells.
This reduces the amount of empty space that temporarily appears when a user is quickly scrolling.
It does not increase the overall number of cells being rendered (and so does not negatively impact performance).

##### 7.22.2
In the event that size or cell count decreases for a `Grid`, remaining cells are no longer remeasured in order to verify the current scroll offset.
Instead the most recent measurements are used.
This change should positively impact performance but should have no other affect.

##### 7.22.1
`InfiniteLoader` now better handles `FlexTable` and `VirtualScroll` children by calling `forceUpdateGrid` when defined.
This prevents rows from being stuck in a visual "loading" state until a user scrolls.

##### 7.22.0
Updated the exported `defaultCellMeasurerCellSizeCache` to support configured uniform column widths and/or row heights.
This allows greater customization and flexibility than the version released in 7.21.0.
For backwards compat `uniformSizeCellMeasurerCellSizeCache` is still exported but also points to `defaultCellMeasurerCellSizeCache`.

##### 7.21.1
Lowered the `ScalingCellSizeAndPositionManager` maximum scroll threshold from 10M to 1.5M pixels to accommodate Edge's lower-than-expected `scrollTop` maximum.

##### 7.21.0
New `cellSizeCache` added for `CellMeasurer` (`uniformSizeCellMeasurerCellSizeCache`) for cells that have a _dyanmic but uniform_ width or height.
This cache will measure only a single cell and then return its width and height for all other cells.
This allows for greater performance optimization for use cases like virtualized drop-down lists, etc.

##### 7.20.0
`Collection` now temporarily caches cells while scrolling is in progress.

##### 7.19.4
Initialize `WindowScroller` height to `window.innerHeight` if component is initially rendered in the browser.
This fixes temporary zero-height that would cause previous scroll position to be lost when a user navigates back in their history.

##### 7.19.3
Improved memoization in `InfiniteLoader` to reduce repeated calls to `loadMoreRows`.

##### 7.19.2
Edge-case bug fix for `WindowScroller` when user returning to a page (via browser back button) that has already been scrolled. Previously, `WindowScroller` failed to correctly calculate its position from the top under these conditions. Now it calculates the proper position.

##### 7.19.1
`WindowScroller` auto-restores body pointer-events when unmounted to fix edge-case bug when component was unmounted during (or _right after_) scrolling.

##### 7.19.0
`CellMeasurer` now properly uses `shallowCompare`.
It also supports a custom caching strategy for measured cell sizes (see `cellSizeCache` prop).

`Collection` supports 2 new properties: `horizontalOverscanSize` and `verticalOverscanSize`.
These properties enable the `Collection` to "overscan" its content similar to how `Grid` does.
This can reduce flicker around the edges when a user scrolls quickly.

##### 7.18.1
Fixed edge-case scroll-to-cell bug in `Grid` when row or column count increases from 0 after a scroll-offset was previous assigned.
For more info see issue #218.

##### 7.18.0
Added named exports for `defaultFlexTableCellDataGetter`, `defaultFlexTableCellRenderer`, and `defaultFlexTableHeaderRenderer` due to user request.

##### 7.17.1
Fixed a `Collection` bug that could cause the `noContentRenderer` to be shown when a collection happened to contain no visible children (due to a sparse layout).

##### 7.17.0
`CellMeasurer` exposes 2 new public methods: `resetMeasurementForColumn` and `resetMeasurementForRow`.
These methods allow a finer grain of control over the cell measurement cache.
Learn more [here](docs/CellMeasurer.md#children-function).

##### 7.16.0
Added new property `autoContainerWidth` to `Grid`.
It can be used to set the width of the inner scrollable container to 'auto'.
This is useful for single-column Grids to ensure that the column doesn't extend below a vertical scrollbar.
By default this is disabled but `VirtualScroll` and `FlexTable` both enable it on their inner `Grid`s.

##### 7.15.1
Renamed `Grid` refs within `FlexTable` and `VirtualScroll` from `_grid` to `Grid`.

This is done to better support interoperability between `FlexTable` and `react-sortable-hoc` which requires a handle on the inner `Grid`.
Technically the change is not required but it is more inline with JavaScript naming conventions (since I plan to preserve this proprety from an Api perspective).

##### 7.15.0
Added support for greater `FlexTable` customization via a new `rowRenderer` property.
Also exported default implementation as `defaultFlexTableRowRenderer`.
Learn more [here](docs/FlexTable.md#rowrenderer).

##### 7.14.0
`WindowScroller` component passes new named argument, `isScrolling`, to its child render function.

##### 7.13.0
Added `onRowDoubleClick` support to `FlexTable`.

##### 7.12.3
`CellMeasurer` implementation changed to use `ReactDOM.unstable_renderSubtreeIntoContainer` instead of `ReactDOMServer.renderToString` in order to support `context`.
`Grid` has been changed slightly as well to calculate its visible children just before `render` (instead of in it).
This change is not expected to have any public-facing consequences beyond supporting the `context` property for `CellMeasure`d cells.
Thanks to @jquense for this contribution!

##### 7.12.2
User-specified `Grid` and `Collection` styles can now override default style options (eg overflow, height/width).

##### 7.12.1
Fixed unexpected usage of `recomputeRowHeights` / `recomputeGridSize` where method is called with an index higher than the last measured row/cell index.
Cell measurer now properly updates the value only if the requested index is lower than the most-recently-measured cell.

##### 7.12.0
`FlexTable` `rowStyle` property can now be a on Object _or_ a function similar to the `rowClassName` property.

##### 7.11.8
Fixed edge-case bug previously possible when combining the `scrollToAlignment` property with `scrollToRow` or `scrollToColumn` at the end of a collection.
Under certain circumstances this caused the grid to scroll too far; that has now been resolved.
Center-alignment logic has also been improved to better align scrolled cells.

##### 7.11.7
Removed `xmlns` property from `<svg>` tag in `SortEditor` to avoid React 15.2 property warning.

##### 7.11.6
Fixed `CellMeasurer` throws "Only a ReactOwner can have refs" error.

##### 7.11.5
Small change to inline styles for `Grid` to work around obscure bug where an initial scroll offset prop is specified before external CSS stylesheets have loaded.

##### 7.11.4
Added more pass-thru props from `VirtualScroll` to `Grid` to ensure that when `VirtualScroll` re-renders (due to changed props) so does its inner `Grid`.
Both components are still "pure" (from a shallow comparison perspective).

##### 7.11.3
Updated `Grid` and `VirtualScroll` so that the width of rows in a `VirtualScroll` does not stretch beneath a scrollbar (if one is visible).

##### 7.11.2
Added more pass-thru props from `FlexTable` to `Grid` to ensure that when `FlexTable` re-renders (due to changed props) so does its inner `Grid`.
Both components are still "pure" (from a shallow comparison perspective).
This just avoids the unintuitive use-case where some table properties (eg headers) may change while others (eg rows) do not.

##### 7.11.1
Updated UMD build to remove `react-addons-shallow-compare` from the build.
UMD users should use `react-with-addons.min.js` (should have already been using it in fact) instead of `react.min.js`.
Thanks to @ducky427 for reporting this oversight and updating the Webpack config!

##### 7.11.0
The `recomputeRowHeights` method of `FlexTable` and `VirtualScroll` accepts an optional index (defaults to 0) after which to recompute sizes.
The `recomputeGridSize` method of `Grid` accepts named `columnIndex` and `rowIndex` parameters tha function similarly.

This allows for a finer grained optimization when invalidating a collection.
If, for example, a specific row in a table has resized- it is now possible to recompute the positions of only the rows occurring after this row.
Because of the way react-virtualized just-in-time measures rows, this will also avoid re-measuring any but the visible rows at the time of the change.

If several items in the collection have changed and you are unsure of which, it is safest to recompute all columns/rows.
This remains the default behavior unless override indices are specified as parameters.

##### 7.10.0
New `gridClassName` and `gridStyle` pass-through properties added to `FlexTable`.

##### 7.9.1
Fixed edge-case bug in `FlexTable` that caused the inner `Grid` not to update when there was a vertical scrollbar.
This in turn caused headers to be misaligned.

##### 7.9.0
Added `forceUpdateGrid` method to `FlexTable` and `VirtualScroll` to enable the inner `Grid` to be udpated without resorting to recomputing cached row heights.

##### 7.8.3
`Grid` no longer checks `scrollTop` when `autoHeight=true` in order to avoid unnecessary reflows/repaints.
This change only impacts `WindowScroller` use cases.

##### 7.8.2
Fixed edge-case problem with `FlexTable` where changes to the number of children (`FlexColumn`s) didn't update the inner `Grid`.

##### 7.8.1
Reverted default `tabIndex = null` value for `Grid` (introduced in 7.8.0) due to a negative accessibility impact.
A focused `Grid` paints significantly more while scrolling which impacts FPS.
Unfortunately it is a necessity to support keyboard scrolling properly and so it's the default once more.
This can be explicitly disabled by setting `tabIndex = null` if you want.

##### 7.8.0
Scrolling performance improvements for `FlexTable` and to a lesser extent `Grid`.

The primary change to `Grid` is that `tabIndex` will be set to `null` by default instead of `0`.
This improves repainting performance when a `Grid` is being scrolled.

This release removes the `FlexTable__truncatedColumnText` wrapper column and collapses its styles into `FlexTable__rowColumn`.
If you were depending on the former class you will want to update your dependencies.
I was on the fence about this in terms of compatibility, but I feel this is more of an internal implementation detail than it is public-facing API.

This release also changes the primary `FlexTable` cell from a flex container to a block.
This means that if you were right-aligning text within a column you will need to change from `align-items: flex-end` to `text-align: right`.

##### 7.7.1
Export the `defaultCellRangeRenderer` used by `Grid` in order to enable easier composition.

##### 7.7.0
Added configurable `tabIndex` property to `Grid`, `FlexTable`, and `VirtualScroll`.
Default value remains 0 but can now be overridden.

##### 7.6.0
New property added to `Grid`, `FlexTable`, and `VirtualScroll` to enable custom CSS class name and style to be added to the outer cell decorator.
This can be used to greater customize styles as well as to better implement custom (non-flexbox) styles for IE9.
Thanks to nicholasrq@ for this contribution!

##### 7.5.0
New `WindowScroller` HOC added to enable a `FlexTable` or `VirtualScroll` component to be scrolled based on the window's scroll positions.
This can be used to create layouts similar to Facebook or Twitter news feeds.
Big thanks to minheq@ for this contribution!

##### 7.4.0
Added mouse-over and mouse-out row-level events to `FlexTable`. Thanks to @queeto for the PR!

##### 7.3.3
Fixed unintention regression in IE10 support introduced with `ScalingCellSizeAndPositionManager` extending `CellSizeAndPositionManager`.
Inheritance has been replaced with composition for this case in order to simplify IE10 compatibility.
Notice that Babel `babel-polyfill` is still required in order to support other ES5 features.

##### 7.3.2
Edge-case bug fix for `CellMeasurer` in the event that its `getRowHeight` or `getColumnWidth` method gets called before the initial render completes.

##### 7.3.1
Increased the safe-scale size from 1,000,000 to 10,000,000 to make for better UX.

##### 7.3.0
`Grid` (and its HOCs `FlexTable` and `VirtualScroll`) now support larger heights and widths than browsers support natively.
For example, the current version of Chrome will not allow users to scroll pass ~33.5M pixel offset.
To work around this limitation, `Grid` increases the density of cells, shifting them as a ratio of what the full scrollable size would be to a browser-safe size.
This should be more or less transparent to users, although in extreme cases it can lead to _really sensitive_ scroll responsiveness.

##### 7.2.0
Added new method- `measureAllCells`- to `Grid`, `FlexTable`, and `VirtualScroll` to force-measure all cells.
This supports special use-cases where deferred measuring is not desired.

Added `estimatedRowSize` property to `FlexTable` and `VirtualScroll` to be passed through to the inner `Grid`.

Also added guard to ensure the `onScroll` callback for `Collection`, `Grid`, `FlexTable`, and `VirtualScroll` is never called with a negative number.

##### 7.1.3
The inner javascript-detect-element-resize library used by `AutoSizer` now passes the proper `useCapture` value when removing listeners as well. This should prevent lingering event listeners in certain cases. Thanks to @cyberxndr for this fix.

##### 7.1.2
Added "_center_" option for `scrollToAlignment` property of `Collection`, `Grid`, `FlexTable`, and `VirtualScroll`.
Thanks to @edulan for the contribution!

Also added a check to avoid rendering content frmo `noContentRenderer` if `width` or `height` are 0.

##### 7.1.1
Resolved edge-case bug that caused the bottom/right cells in a `Grid` or `Collection` to be partially overlapped by a scrollbar.
Thanks to @anjianshi for reporting this and collaborating on the fix!

##### 7.1.0
Added `scrollToAlignment` property to `Collection`, `Grid`, `FlexTable`, and `VirtualScroll` to offer finer-grained control of how scrolled-to cells are aligned.
Default behavior ("_auto_") remains unchanged- the least amount of scrolling will occur to ensure that the specified cell is visible.

##### 7.0.5
Fixed edge-case bug where `InfiniteLoader` did not respect `minBatchSize` setting when a user was scrolling up.

##### 7.0.4
Added `scrollLeft` and `scrollTop` parameters to `cellRangeRenderer` callback for `Grid`.

##### 7.0.3
Added `box-sizing: border-box` rules to `.FlexTable__headerRow` and `.FlexTable__Grid` classes to fix edge-case scrollbar bug experienced by some users.

##### 7.0.2
Added `recomputeCellSizesAndPositions` method to `Collection` (to pass through to inner `CollectionView`).

##### 7.0.1
Replaced single occurence of `Number.isNaN` with `isNaN` to avoid IE compatibility issues.

# 7.0.0
Version 7 changes are described in detail on the [Version 7 Roadmap wiki page](https://github.com/bvaughn/react-virtualized/wiki/Version-7-Roadmap).
Upgrade instructions and [jscodeshift](https://github.com/facebook/jscodeshift) mods can also be found there.

To run a code mod, check out react-virtualized (or download the codemod) and then...
```
jscodeshift -t /path/to/react-virtualized/codemods/6-to-7/rename-properties.js source
```

##### 6.3.2
Fixed edge-case bug in `Collection` where initial `scrollLeft` and `scrollTop` would not correctly adjust inner offsets.
Thanks @edulan for the contribution!

##### 6.3.1
Added better checks against invalid style properties in `AutoSizer` to protected against the case when it is removed from the DOM immediately after being added.

##### 6.3.0
Added new `minimumBatchSize` property to `InfiniteLoader` to simplify HTTP request batching.
Fixed edge-case NPE with `AutoSizer` when it is unmounted immediately after being mounted.

##### 6.2.2
Fixed off-by-one for `InfiniteLoader` that caused it to request one too many rows when scrolled to the end of the list.

##### 6.2.1
`FlexTable` supports `true`, `false`, `undefined`, and `null` children now to more easily enable support for dynamic columns (see issue #174).
Improved edge-case handling for changes to cell counts when scroll-to-index properties have been set.

### 6.2.0
Added new `Collection` component for rendering non-checkboard data.
This component's cells can be positioned in any arrangement, even overlapping.
Note that because it has fewer constraints, `Collection` cannot compute positioning and layout data as fast as `Grid`.

##### 6.1.2
Moved `react-addons-shallow-compare` from `dependencies` to `peerDependencies`.

##### 6.1.1
Updated React dependency ranges now that 15.0 has been released.

### 6.1.0
`Grid` supports a new `renderCellRanges` property for customizing the rendering of a window of cells.
This function should implement the following signature:
```js
function renderCellRanges ({
  columnMetadata:Array<Object>,
  columnStartIndex: number,
  columnStopIndex: number,
  renderCell: Function,
  rowMetadata:Array<Object>,
  rowStartIndex: number,
  rowStopIndex: number
}): Array<PropTypes.node>
```

##### 6.0.8
Fixed dependency ranges for `react-addons-shallow-compare` and `react-dom`.

##### 6.0.7
Added key handling to sortable `FlexTable` headers so that ENTER and SPACE keys can be used to toggle sort direction.

##### 6.0.6
Added conditional checks to when `aria-label`, `role`, and `tabIndex` get attached to `FlexTable` headers and rows.
These a11y properties are only added when on-click or sort handlers are present.

##### 6.0.5
Added `aria-label` and `role` attributes to `FlexTable`, `Grid`, and `VirtualScroll` components to fix a11y issues reported by [reactjs/react-a11y](https://github.com/reactjs/react-a11y).
Thanks to @globexdesigns for the contributions!

##### 6.0.4
Separated horiontal and vertical `Grid` metadata calculation to avoid unnecessarily recomputing row metadata for `FlexTable`s and `VirtualScroll`s when a browser's window is resized, for example.
Also replaced `columnWidth` and `rowHeight` getter uses in `Grid.render` in favor of cached cell metadata instead.

##### 6.0.3
Small update to `FlexTable` to move the `rowGetter` call outside of the column loop to reduce the number of times that method gets called.

##### 6.0.2
Added [transform-react-inline-elements](http://babeljs.io/docs/plugins/transform-react-inline-elements/) to UMD build for minor runtime performance improvements.
This change does not effect CommonJS or ES6 module builds because I did not want to remove prop-type checks.
You should apply this transformation step as part of your own production build pipeline.

##### 6.0.1
Removed lingering references to `react-pure-render` with with [`shallowCompare`](https://facebook.github.io/react/docs/shallow-compare.html).
This was meant to be part of the initial 6.0 release but was left out accidentally.

# 6.0.0

Version 6 includes the following changes.
(For more background information refer to the [Version 6 Roadmap wiki page](https://github.com/bvaughn/react-virtualized/wiki/Version-6-Roadmap).)
At a high-level the purpose of this release is to improve customization and flexibility with regard to arrow-key event handling.

### Backwards-incompatible changes
* Refactored `Grid` to remove arrow-key scroll-snapping. Instead this feature is implemented in a HOC, `ArrowKeyStepper`. The upgrade path from React 5.x to 6.x if you want to maintain arrow-key navigation behavior is as follows:

```jsx
// Before...
<Grid {...gridProps}/>

// After...
<ArrowKeyStepper
  columnsCount={columnsCount}
  rowsCount={rowsCount}
>
  {({ onSectionRendered, scrollToColumn, scrollToRow }) => (
    <Grid
      columnsCount={columnsCount}
      onSectionRendered={onSectionRendered}
      rowsCount={rowsCount}
      scrollToColumn={scrollToColumn}
      scrollToRow={scrollToRow}
      {...otherGridProps}
    />
  )}
</ArrowKeyStepper>
```
* The following public methods have also be removed from components:
  * `FlexTable`: `scrollToRow` (use `scrollToIndex` prop instead), `setScrollTop` (use `scrollTop` prop instead)
  * `Grid`: `scrollToCell` (use `scrollToColumn` and `scrollToRow` props instead), `setScrollPosition` (use `scrollLeft` and `scrollTop` props instead)
  * `VirtualScroll`: `scrollToRow` (use `scrollToIndex` prop instead), `setScrollTop` (use `scrollTop` prop instead)

### Backwards-compatible changes
* Replaced (the now unsupported) `react-pure-render` with [`shallowCompare`](https://facebook.github.io/react/docs/shallow-compare.html).

##### 5.5.6
Max scroll position logic in `Grid` now takes scrollbar size into consideration.
Also includes a small `render` optimization for null cells.
This release made possible by @jquense!

##### 5.5.5
Updated `package.json` to support React `^0.14.0` as well as `^15.0.0-rc.1`.
Thanks to @opichals for the PR.

##### 5.5.4
Changed key-down event handler in `VirtualScroll`, `FlexTable`, and `Grid` to no longer call `event.preventDefault()` for arrow-key events.
This was causing poor user interactions for `<input>` elements within `VirtualScroll` and `FlexTable` components.
Note that this issue still occurs for `<input>` elements in a `Grid` component.

This release also removes the `outline: 0` default style for `Grid`.
After consideration I think that's a harmful default behavior.

##### 5.5.3
Added `will-change` property to `Grid` to work around a Chrome bug(?) that caused the entire grid to be repainted whenever a new row or column was added. This was negatively impacting scrolling performance for Chrome under certain conditions. This change is not expected to impact Firefox, Safari, or IE.

Also trapped scroll events inside of `AutoSizer` so that `sdecima/javascript-detect-element-resize` did not treat them as potential resizes and unnecessarily force a sync DOM layout.

##### 5.5.2
Removed two unnecessary method calls in `Grid` and replaced them with cached properties. Should offer a minor performance boost.
Added better bounds-checking to util function `getVisibleCellIndices()`

##### 5.5.1
Removed unnecessary `setImmediate` in `Grid` initialization code.
This prevents a possible edge-case runtime error when a `Grid` is mounted and then removed before `setImmediate` is invoked.

### 5.5.0
`ScrollSync` passes additional parameters to child function in order to enable more complex scroll-driven UI changes.

### 5.4.0
Added optional `headerRenderer` property to `FlexColumn` to enable custom `FlexTable` header cells.

##### 5.3.2
Decoupled x/y axes in `Grid` when determining whether or not to enable overflow.
This results in more robustly handling issues like the one reported in PR #133.
It also comes with the small cost of partially obscuring a small part of cells (the area used by a scrollbar).

##### 5.3.1
Fixed edge-case where always-on scrollbars were not hidden once shown (see issue #116).

### 5.3.0
Separated CommonJS and UMD builds and pointed package.json's `main` target at the CommonJS build.
Also moved the ES6 modules build from `/es` to `/dist/es` to reduce the amount of clutter in the packaged dir.

##### 5.2.4
Changed `Grid` child `key` attributes again to reduce the number of elements created as a result of scrolling.
This dramatically improves perforamance without introducing any known regressions.
Thanks to @cesarandreu for consulting on this release.

##### 5.2.3
Reverted `transform: translate` positioning to old `top` / `left` positioning to address performance concerns reported via PR #124 and issue #94.

##### 5.2.2
Updated ES6 module build to be Rollup-friendly by way of `es2015-rollup` Babel preset.
Also cleaned up NPM package to suppress unnecessary files (via new `.npmignore`).

##### 5.2.1
Fixes long-standing slow wheel scrolling issue that affected certain browsers such as Firefox (see issue #2). Big thanks to James Long (@jlongster), Markus Stange ‏(@mstange), and Dan Abramov (@gaearon) ‏for their help with this fix.

### 5.2.0
Added optional `onResize` callback property to `AutoSizer`. This method is invoked any time the `AutoSizer` detects a resize. It is passed `width` and `height` named parameters.

Added optional `minWidth` and `maxWidth` properties to `FlexColumn` to enable greater flexibility with regard to table-column layout.

##### 5.1.1
Marked `FlexColumn` `width` property as required since ommitting this property can lead to uneven column layouts.

### 5.1.0
Added `ColumnSizer` high-order component for auto-calculating column widths for `Grid` cells.

#### 5.0.1

Added `webkit-transform` style to `Grid` cells for iOS 8 support.

# 5.0.0

Version 5 includes the following changes.
(For more background information refer to the [Version 5 Roadmap wiki page](https://github.com/bvaughn/react-virtualized/wiki/Version-5-Roadmap).)
At a high-level the purpose of this release is to make HOCs more easily composible in order to support a wider variety of them in the future.
A secondary goal was to cut redundant code from `VirtualScroll` and rely more heavily on the base `Grid` component.

###### Backwards-incompatible changes
* Refactored `FlexTable` and `VirtualScroll` to be HOCs that use `Grid` internally. This change makes `width` a required attribute for all virtualized components. A simple upgrade strategy is to use the `AutoSizer` HOC (learn more [here](docs/AutoSizer.md)).
* Changed globally exported library name (for use with vanilla `<script>` tags) to `window.ReactVirtualized` instead of `window["react-virtualized"]` (see [issue #86](https://github.com/bvaughn/react-virtualized/issues/86)).
* Removed `horizontalPadding` and `verticalPadding` properties from `FlexTable`. These properties were redundant. Such padding should be the responsibility of the parent container and taken into consideration by the injected `width` and `height`.
* Refactored `InfiniteLoader` and `AutoSizer` to require function children so as to be more easily composable with each other and new HOCs like `ScrollSync` (learn more [here](docs/usingAutoSizer.md#using-autosizer-with-infiniteloader)).
* `AutoSizer` no longer supports a `className` property or uses the global 'AutoSizer' class.

###### Backwards-compatible changes
* Added ES6 module and `jsnext:main` target to enable tree-shaking support.
* Updated `onScroll` property to specific total scrollable area so that offsets can be converted into percentages if desired (learn more [here](docs/README.md)).
* Replaced `top` / `left` cell positioning with `transform: translate()` for small performance gains. (This may become configurable in the future if any negative impact on performance is noticed.)
* Created `ScrollSync` HOC for synchronizing scrolling between two or more virtualized components (learn more [here](docs/ScrollSync.md)).

### 4.10.0
`FlexTable` and `VirtualScroll` get a new property, `overscanRowsCount`. `Grid` gets `overscanRowsCount` and `overscanColumnsCount`.
These properties can be used to reduce visual flicker around the sides of virtualized components when quickly scrolling.
`overscanRowsCount` defaults to 10 and `overscanColumnsCount` defaults to 0; adjust as necessary based on the size of your lists and cells.

`FlexTable` sets a default value of 0 for `headerHeight` to more gracefully support `disableHeader` use case.

### 4.9.0
`AutoSizer` component now takes padding into consideration before setting the `width` and `height` of its children.

##### 4.8.1
Updated `InfiniteLoader` to better reflect required properties. (`isRowLoaded`, `rowsCount`, and `threshold` were not marked as required before.)

### 4.8.0
Updated `InfiniteLoader` to support being composable within an `AutoSizer` HOC. If either a `width` or `height` attribute are specified on `InfiniteLoader` they will be bundled through to the loader's child component.

##### 4.7.1
Fixed `AutoSizer` bug that caused it to prevent parent flex containers from shrinking in some contexts.

### 4.7.0
Added `scrollToIndex` property to `FlexTable` to be passed through to inner `Grid`.

##### 4.6.6
Better gaurd against `NaN` values for `clientWidth` and `offsetWidth` for test environments using `jsdom`.

##### 4.6.5
Added `react-dom` to the Webpack :externals node to avoid including it in the build.
This fixes the bad `4.6.3` and `4.6.4` builds. Sorry!

##### 4.6.4
Moved `react-dom` from `dependencies` to `peerDependencies` to fix bad `4.6.3` build.

##### 4.6.3
Fixed edge-case sizing bug with `FlexTable` headers and always-on scrollbars (see issue #80 for more info).

##### 4.6.2
Replaced single occurence of `Number.isNaN` with `isNaN` to avoid IE compatibility issues. Maybe in the future I will add a polyfill dependency but I did not intend to introduce this without a major version bump so I'm removing it.

##### 4.6.1
Removes `event.stopPropagation` since it was unnecessary to prevent keyboard event bubbling, only to prevent the default browser behavior.

### 4.6.0
Relocated a couple of static style properties from inline style object to exported CSS file for easier customization.
Added `Grid__cell` and `VirtualScroll__row` classes.

### 4.5.0
Added `onScroll` callback to `Grid`, `FlexTable`, and `VirtualScroll`.
Added `scrollToCell` method to `Grid` and `scrollToRow` to `FlexTable`, and `VirtualScroll`.

##### 4.4.3
Added `-ms-flex` and `-webkit-flex` browser prefixes to `FlexTable` cells.

##### 4.4.2
Fixed invalid function reference in `Grid` triggered by specifying an initial `scrollToRow` property.

##### 4.4.1
Fixed distribution to include new `Grid` component as an export.

### 4.4.0
Added new `Grid` component for virtualizing rows _and_ columns .
Updated `AutoSizer` component to support managing _only_ `width` or `height` (in addition to both).

##### 4.3.1
Fixed small CSS property misnaming issue.

### 4.3.0
`FlexTable` now supports dynamic row-heights (in the same way as `VirtualScroll`).

##### 4.2.1
Set `VirtualScroll` default style to `width: 100%` to be more inline with default `FlexTable` behavior.

### 4.2.0
Replaced `React.cloneElement` with wrapper element in order to:
* Better support for pure function components; (they were not compatible with inline style positioning).
* Relax the requirement of `rowRenderer` having to specify a `key`.
* Support `React.PropTypes.node` children (including plain strings, numbers, etc.) instead of just elements.

### 4.1.0
Added `-webkit-overflow-scrolling: touch` for smoother inertial scrolling on mobile devices.

##### 4.0.2
Additional `columnData` parameter passed to `onHeaderClick` callback.

##### 4.0.1
Removed an unused dependency on 'inline-style-prefixer' from the `package.json`.

# 4.0.0
CSS styles have been split into their own, separately loaded stylesheet. This simplifies universal/isomorphic use cases without breaking vendor prefixing. This change means that you'll need to import the following additional file. This only needs to be done once (usually during bootstrapping).
```js
import 'react-virtualized/styles.css';
```

In this release the `width` property of the `FlexTable` component was removed. Tables will now grow to fill 100% of the width of their parent container.

The `AutoSizer`'s `ChildComponent` attribute has been removed in favor of using a regular react child. For example:
```jsx
<AutoSizer
  ChildComponent={VirtualScroll}
  {...props}
/>
```
Should instead be this:
```jsx
<AutoSizer>
  <VirtualScroll {...props}/>
</AutoSizer>
```

##### 3.1.1
New `onHeaderClick` property added to `FlexTable`. Thanks to @olslash for the contribution!

### 3.1.0
Added high-order `InfiniteLoader` component to manage just-in-time fetching of data as a user scrolls up or down in a list.
For more information about this component refer to the [API docs](https://github.com/bvaughn/react-virtualized/blob/master/docs/InfiniteLoader.md).

##### 3.0.1
Fixed small NPE when up/down arrow key was used while an empty VirtualScroll was in-focus.

# 3.0.0
CSS styles have been split into two groups: functional styles (eg. `position`, `overflow`) and presentational styles (eg. `text-transform`, `color`) and both have been converted to inline styles rather than being loaded as CSS. This was done primarily to simplify usage for universal/isomorphic rendering.

For more information on customizing styles refer to the [documentation](https://github.com/bvaughn/react-virtualized/#customizing-styles)...

### 2.8.0
Changed `Autosizer` component to support a single child instead of the `ChildComponent` property.
(For backwards compatibility purposes the `ChildComponent` property will continue to be supported.)

##### 2.7.5
Defer loading of element resize code until `componentDidMount` to avoid undefined `document` and `body` references.
This was breaking server-side rendering.

##### 2.7.4
Uglify dist build to remove dead code.

##### 2.7.2 & 2.7.3
Improved checks for undefined `document` and `window` in hopes of better supporting server-side rendering.

##### 2.7.1
Replaced invalid `rowHeight instanceof Number` check with `typeof rowHeight === 'number'` in `VirtualScroll`.

### 2.7.0
Moved `onRowsRendered` to `componentDidUpdate` (instead of `render`) to keep `render` free of side-effects.
Added tests to ensure that the callback is only invoked once per start/stop index pair (and not again unless the indices change).

##### 2.6.2
Added check for undefined `document` before accessing `attachEvent` to avoid causing problems with server-side rendering.

##### 2.6.1
Cell `title` now only set if rendered cell contents are a string. This fixes issue #35.

### 2.6.0
`VirtualScroll` and `FlexTable` now support dynamic row heights by accepting a function as the `rowHeight` property.

### 2.5.0
Added `AutoSizer` component for wrapping `FlexTable` or `VirtualScroll` and growing to fill the parent container. This should hopefully simplify usage of these components.

### 2.4.0
`FlexTable` and `VirtualScroll` offer new callback property `onRowsRendered` to be invoked with a params object `{ startIndex, stopIndex }` after rows have been rendered.

### 2.3.0
`FlexTable`'s `rowClassName` property can now be either a string or a function in order to support dynamic row classes (eg. alternating colors).

### 2.2.0
Added `onRowClick` property to `FlexTable`.

##### 2.1.1
Fixed a few minor FlexTable font styles to use relative sizes instead of custom ones

### 2.1.0
Added optional `noRowsRenderer` property to `VirtualScroll` and `FlexTable`.
This property can be used to render loading indicators or placeholder content for empty lists.

# 2.0.0
Set `shouldPureComponentUpdate` on component prototypes instead of instances.
Dropped half-ass support for React 0.13. This module has always depended on React 0.14 but it was checking in previous versions and trying to be backwards compatible with 0.13. Since that check is no longer in place, this is a major version bump (even though there is no real new functionality being added).

##### 1.0.4
Fixed package.json dependencies by moving `classnames`, `raf`, and `react-pure-render` out of `peerDependencies` and into `dependencies`.

##### 1.0.3
Same as version 1.0.2; published just to update NPM keyword and description.

##### 1.0.2
Removed default row-border styling from FlexTable and added new :rowClassName property.

##### 1.0.1
Updated to use ReactDOM.findDOMNode instead of getDOMNode (but added backwards-compatible check for < React v0.14).

# 1.0.0
Package JSON updated so that "main" entry points to `dist/react-virtualized.js` to provide easier integration for users that don't want Babel/Webpack to have to process their `node_modules` folder.

##### 0.0.4
Added keypress scrolling support.

##### 0.0.3
Added "main" entry to package.json.

##### 0.0.2
Added CSS auto-prefixing to support Safari and other, older browsers.

##### 0.0.1
Initial release.

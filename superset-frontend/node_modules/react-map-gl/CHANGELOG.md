# CHANGELOG

# Version 4.1

## 4.1.16 (Oct 8, 2019)
- Use JSX sources/layers in examples (PR 2/2) (#897)
- Add React Source and Layer components (PR 1/2) (#896)
- Fix draw polygon example styling (#899)

## 4.1.15 (Sept 23, 2019)
- Add babel react preset and migrate react components to jsx (#875)

## 4.1.14 (Sept 23, 2019)
- Viewport flyTo Interpolation: add support for auto duration and other options. (#866)

## 4.1.13 (Aug 20, 2019)

## 4.1.12 (Aug 12, 2019)

- React 16.9.0 deprecated lifecycles (#861)
- remove deprecated react lifecycle methods (#863)

## 4.1.11 (Aug 7, 2019)
- Add pinchcancel handler (#859)
- fix delay after clicking close button (#857)

## 4.1.10 (July 15, 2019)
- Remove event manager properly on unmount (#847)

## 4.1.9 (July 15, 2019)
- Bump mjolnir (#839)
- Fix compressed popup when reaching right bound of map (#823)

## 4.1.8 (July 8, 2019)
- Fix interaction state when using mouse wheel (#840)

## 4.1.7 (June 6, 2019)
- Fix popup styling (#818)

## 4.1.6 (June 4, 2019)
- Fix style diff warning when reusing map (#816)

## 4.1.5 (June 4, 2019)
- bump mjolnir version (#812)
- mapbox-gl 0.54

## 4.1.4 (May 31, 2019)
- Pass callbacks via MapContext (#799)

## 4.1.3 (May 29, 2019)
- Fix geolocate control missing key warning (#789)
- Custom mapbox server (#769)

## 4.1.2 (Apr 12, 2019)

- Fix geolocate control marker styling (#764)
- Fix synchronous redraw bug (#772)

## 4.1.1 (Mar 14, 2019)

- Fix mapbox export warning (#757)

## 4.1.0 (Mar 14, 2019)

- add fullscreen support (#696)
- add geolocate control (#724)

# Version 4.0.0

## 4.0.15 (Mar 12, 2019)

- Fix: popup close button click event propagates to map (#751)

## 4.0.14 (Mar 4, 2019)

- Fix static context bug (#749)

## 4.0.13 (Feb 25, 2019)

- Bump mapbox-gl to 0.53 (#739)

## 4.0.12 (Feb 22, 2019)

- add onNativeClick callback (#733)
- fix synchronous redraw (#736)

## 4.0.11 (Feb 20, 2019)

- Consolidate InteractiveContext and StaticContext into one (#718)
- Deregister mapbox events listeners when destroy map (#723)
- Force map rerender synchronously after props update (#720)

## 4.0.10 (Jan 28, 2019)

- Remove excessive fields from NavigationControl's callback argument (#702)
- Default onError handler to console.error (#706)
- Don't query interactive layer ids before map has loaded (#708)
- Fix onLoad event calling when reuseMaps is set to true (#704)

## 4.0.9 (Jan 20, 2019)

- Reverse polarity of compass bearing rotation (#694)

## 4.0.8 (Jan 18, 2019)

- Fix dragging marker with offset (#693)

## 4.0.7 (Jan 11, 2018)

- Remove passive listener console warning in Chrome (#689)
- Disable console logging of package version (#688)

## 4.0.6 (Dec 27, 2018)

- Update mapbox-gl to 0.52.0 (#684)

## 4.0.5 (Dec 6, 2018)

- Fix map controller class extensibility (#674)

## 4.0.4 (Dec 4, 2018)

- Bump mapbox dependency to 0.51 (#670)
- Fix crash when `viewState` does not contain pitch or bearing (#671)

## 4.0.3 (Dec 4, 2018)

- Cache the interactive context to prevent context thrashing (#664)
- Remove math.gl from dependencies (#666)

## 4.0.2 (Nov 16, 2018)

- Fix popup bug when closeOnClick is off (#660)

## 4.0.1 (Nov 14, 2018)

- Bump maxZoom support to 24 (#659)

## 4.0.0 (Nov 5, 2018)

# Version 4.0.0 Prereleases

## 4.0.0-beta.7 (Nov 5, 2018)

- New interruption mode: UPDATE (#631)
- API audit round 2 (#652)
- Set up flow (#651)

## 4.0.0-beta.6 (Nov 2, 2018)

- Don't override visibility style when visible is true (#650)

## 4.0.0-beta.5 (Nov 2, 2018)

- Fix usage of map ref in interactive-map (#645)
- Various bug fixes (#648)

## 4.0.0-beta.4 (Oct 31, 2018)

- Add support for Create React App access token environment variable (#633)
- Upgrade function ref to createRef (#637)
- API audit (#638)
- Do not call onResize during render (#643)

## 4.0.0-beta.3 (Oct 24, 2018)

- Fix render error when using `viewState` instead of flat props (#632)

## 4.0.0-beta.2 (Oct 23, 2018)

- Add `sortByDepth` option to Popup component (#623)
- Remove bower dependency (#615)
- Handle zoom center during linear transition (#625)
- Add interaction callbacks (#626)
- Add map to context (#627)
- Remove click delay in map controls when `captureDoubleClick` is on (#628)

## 4.0.0-beta.1 (Oct 13, 2018)

- Upgrade to new React context API (#613)
- Support relative map size (#614)
- Bump mapbox-gl dep to 0.50.0 (#618)
- Bug fixes for auto-resize mode (#619)
- Remove usage of deprecated `interactive` properties in map styles (#621)

## 4.0.0-alpha.3 (Oct 5, 2018)

- Fix browser targets (#610)

## 4.0.0-alpha.2

- Add more interaction states (#573)
- Remove commonjs from globals (#592)
- Remove minify to make the code debuggable (#593)
- Upgrade build system (#596)
- Fix: Stylesheet check (#601)
- New: Support external GL context (#603)
- Provide static browser/node targets (#599)

## 4.0.0-alpha.1

- Remove immutablejs from dependency
- Use Mapbox's style diffing
- Add drag and drop support for Marker (#576)

# Version 3.3.0

## 3.3.9 (Nov 14, 2018)

- Bump maxZoom support to 24 (#659)

## 3.3.8 (Oct 26, 2018)

- Add support for Create React App access token environment variable (#633)

## 3.3.7 (Oct 18, 2018)

- Fix double-click zoom transition (#625)

## 3.3.6 (Oct 15, 2018)

- `mapbox-gl` v0.50 (#618)
- Remove `bower` dependency (#615)

## 3.3.5 (Sep 26, 2018)

- Fix auto stylesheet detection (#601)

## 3.3.4 (Aug 4, 2018)

- Add `fitBounds` util to docs (#563)
- add disableTokenWarning prop (#564)
- fix capture* props for overlay components (#565)

## 3.3.3 (Aug 3, 2018)

- Fix queryRenderedFeatures (#560)
- Dcoument compability with create-react-app and Typescript (#540)

## 3.3.2 (July 23, 2018)

- Bump MapboxGl Version (#554)

## 3.3.1 (July 19, 2018)

- Bump Math.gl Version (#549)
- Move Visibility Check to StaticMap (#548)
- Pass the `maxTileCacheSize` option to the MapboxGL constructor (#546)

## 3.3.0 (July 4, 2018)

- NEW: `viewState` and `onViewStateChange` prop
- NEW: Automatically load missing Mapbox stylesheet
- FIX: `reuseMap` prop now respects mapStyles
- Log react-map-gl version number
- Upgraded build system to support webpack 4 tree-shaking

# Version 3.2.0

## 3.2.10

- FIX: `captureClick` not working on Popup components

## 3.2.9

- NEW: `onContextMenu` prop
- NEW: `touchAction` prop
- FIX: support usage in Electron environments
- NEW: bump `mapbox-gl` version to 0.45

## 3.2.8

- FIX: support for to-be-deprecated prop `onChangeViewport` in viewport transition
- FIX: reused map now applies new mapStyle

## 3.2.7

- FIX: Cannot scroll over popups with `captureScroll` turned on


## 3.2.6

- FIX: `onViewportChange` triggered with nothing changed
- FIX: mapbox error when attempting to remove sources
- FIX: flicker when updating clustered GeoJSON source


## 3.2.5

- Add null check to BaseControl ref callback (#479)
- Manually bind methods (#463)


## 3.2.4 (Feb 21, 2018)

- mapbox-gl 0.44.0
- Fix `reuseMap` option
- Add showZoom and showCompass options (#448)


## 3.2.0 (January 10, 2018)

- mapbox-gl 0.42.2
- Viewport transition: feature equivalent to Mapbox's flyTo and easeTo; smooth transition when using keyboard navigation or the NavigationControl. Add new props `transitionDuration`, `transitionInterpolator`, `transitionEasing`, `transitionInterruption`, `onTransitionStart`, `onTransitionInterrupt`, `onTransitionEnd`
- Navigation using keyboard and the navigation control matches Mapbox behavior, including smooth transition when zooming and panning.
- Touch rotate support: new props of InteractiveMap `touchZoom` and `touchRotate`
- Expose Mapbox's `transformRequest` API
- Map Reuse (experimental): A new property `reuseMaps` is provided for applications that create and destroy maps, to help work around a mapbox-gl resource leak issue that can lead to a browser crash in certain situations.


# Version 3.1

## 3.1.1 (October 20, 2017)

- FIX: custom events in MapControls

## 3.1.0 (October 19, 2017)

- Add right mouse button click & drag to rotate
- Allow controls and overlays to block map interactions
- Extend control elements with custom classNames
- Bump Mapbox to 0.40.1
- StaticMap: Based on new Mapbox wrapper that supports reuse of mapbox maps
- StaticMap: Renders HTML mapbox token warning if no token supplied
- StaticMap: Remaining style diffing utils broken out


# Version 3.0

## Version 3.0.5 (October 03, 2017)

- FIX: missing `babel-runtime` module at runtime
- FIX: interaction when map is scaled by CSS transform

## Version 3.0.4 (August 08, 2017)

Add babel transform-runtime to es5 build for IE11 support.

## Version 3.0.3 (August 01, 2017)

- `v3.0.2` skipped because of faulty publish
- FIX: unbound `this` in ref callback for canvas-overlay (#337)

## Version 3.0.1 (July 27, 2017)

- FIX: pinch zoom
- FIX: wheel scrolling is blocked when onViewportChange is null

## Version 3.0.0 (July 27, 2017)

This is a major release of the library. For more information, please see [What's new](https://github.com/uber/react-map-gl/blob/3.0-release/docs/whats-new.md) in latest documentation.

## Version 2.0.2 (Feb 09, 2017)

### Minor Fixes

- Changed `postinstall` script again to use postinstall.js to run
  flow-remove-types. This attempts to resolve cross-platform issues. (#192)

## Version 2.0.1 (Jan 24, 2017)

### Minor Fixes

- Fixed calculation of map pitch during interaction
- Changed `postinstall` script

## Version 2.0.0 (Jan 17, 2017)

### Reasons for the major version bump

- We updated to `mapbox-gl` 0.31.0 which introduced flow types as well as having
  a hard dependency on Node >= v4. We now assume that you are on Node >= v4
  and npm >= v3.
- We want >= v2.0.0 of `react-map-gl` to continue tracking `mapbox-gl` updates
  as closely as possible. This means minor / patch updates will be published
  more frequently.
- This also marks the start of more aggressive development on `react-map-gl`
  and we will start rolling out bigger updates in the coming months.

### New Features & Updates

- Bump `mapbox-gl` to v0.31.0
- Add `maxZoom` prop and defaults to `20`
- Add `onLoad` event handler
- Add `onClick` prop handler (#140)

### Fixes

- Ensure fitBounds doesn't return NaN zoom value (#159)
- Use 'changedTouches' for 'touchend' / 'touchcancel' events (#164)
- Typo fix in draggable-points overlay (#178)
- Remove mapbox-gl's `Point` dependency from map-interactions. (#161)

### Miscellaneous

- Added more info about usage with Webpack in README

# Version 1.X Series Releases

## Version 1.7.2
* Use any one of the function keys {command, shift, ctrl, alt} to enable the
  perspective mode.

## Version 1.7.1
* Bump Mapbox version to 0.26

## Version 1.7.0

* Provide a way to control per-layer interactivity - onClickFeatures and
  onHoverFeatures have the option to only query selected layers. Enabled by
  setting the `interactive` property to `true` in layer styles. (#131)

* Fix bug where onClickFeatures is fired after panning/rotating (#133)

## Version 1.6.1

* Hotfix: GeoJSON style support issue with mapbox-gl 0.24.0

## Version 1.6.0

* Reduced flicker when updating GeoJSON sources in styles - (Thanks @tsemerad)
  Covers certain cases, for more info see #124)
* `MapGL.supported()` - New function which calls mapbox-gl's `supported()`.
  Enables applications to detect unsupported browsers and avoid rendering
  the react-map-gl, for graceful recovery or error handling.
* Bumps mapbox-gl dependency to 0.24.0.
* Cursor now changes to pointer over interactive features
* Fix grab cursor in recent Chrome browsers

## Version 1.5.0

* Add touch support (Thanks @cammanderson)

## Version 1.4.2

* Remove alphaify dependency due to peerDependency issues

## Version 1.4.1

* Bumped `alphaify` dependency to avoid pulling in d3 v3 as sub-dependency
* Added test case for `fitBounds`

## Version 1.4.0

* Bump d3 to v4, replaces monolithic d3 dependency with specific d3 submodules.

## Version 1.3.0

* Added `clickRadius` prop to allow for customization of hitbox around clicked point

## Version 1.2.0

* Add `fitBounds`

## Version 1.1.1

* Update mapbox-gl from v0.21.0 (from v0.20.0)

## Version 1.0.0

### New Feature: Perspective Mode

* Now supports `bearing` and `pitch` properties, per mapbox-gl-js api
  documentation. These props default to 0 which means that maps will still
  be rendered in flat/ortographic mode when they are not provided.
* Setting the `perspectiveEnabled` prop to true enables a perspective control
  mode (Command-Drag) allowing the user to change perspective.

**Limitations:** The existing overlays (HTMLOverlay, CanvasOverlay,
  SVGOverlay etc) do not currently support perspective mode.
  For a set of overlays that do support perspective mode, see
  [deck.gl](https://github.com/uber/deck.gl)

Note: The map state reported by onViewportChanged may now contain additional
state fields (tracking not only pitch and bearing, but also transient
information about how the projection is being changed by the user).
To simplify and future proof applications,
it is recommended to simply save the entire mapState in your app store
whenever it changes and then pass it back to the component rather than
trying to keep track of individual fields (More info in README.md).

Note 2: A utility for calculating projections and projection matrices based
on props that include pitch and bearing will be provided separately.
In the mean-time, `ViewportMercatorProject` still works
for non-perspective maps.

### Internal change: Transpiled ES6 code base

* The code base has been updated to ES6+ and is now transpiled back to ES5
  before being published on npm.

### Breaking Change: Layer Imports

* The map overlay components (HTMLOverlay, CanvasOverlay, SVGOverlay etc)
  previously had to be imported via their relative source paths (e.g.
  `import SVGOverlay from 'react-map-gl/src/overlays/svg-overlays';`).
  These files still exist, but have now be rewritten in ES6+ which will
  not work for most applications.
  Instead the various Layers components are now exported as additional
  named exports from the module, and can be accessed using
  "desctructuring" imports:
```
import MapGL, {SVGOverlay} from 'react-map-gl';
```
or
```
var MapGL = require(`react-map-gl`);
var SVGOverlay = MapGL.SVGOverlay;
```

### Breaking Change: fitBounds has been removed

The previously exported `fitbounds` function will be made available
as part of the separate package of utilities that handles coordinate
projections in perspective mode.



# Beta Releases

## v3.1 Beta Releases

### Version 3.1.0-alpha.1
- React 16 preliminary integration.


## v3.0 Beta Releases

### Version 3.0.0-beta.3
- Fix: viewport misalignment with Mapbox at low zoom levels

### Version 3.0.0-beta.2
- Fix: scroll zoom with touch does not block page scrolling
- Fix: feature lookup error when child components are rendered with error

### Version 3.0.0-beta.1

- WEBSITE: Polish docs
- WEBSITE: Add links to other libraries
- WEBSITE: babel config fix

### Version 3.0.0-alpha.15
- update event manager (#283)
- Fix: Event Manager update fixes an issue where `scrollZoom` disabled will also
consume the scroll event preventing the page from scrolling.
- Fix: breakage on node (#292)
- BREAKING: `fitBounds` is now accessed through the `PerspectiveMercatorViewport` class
- BREAKING: `react-map-gl` now requires **at least** Node `>=v6.4` in development
- New: `SVGOverlay` `CanvasOverlay` and `HTMLOverlay` supports perspective mode; no longer requires viewport props

### Version 3.0.0-alpha.14
- BREAKING: Remove `fitBounds` util (#278)
- Updated to `mapbox-gl-js` version `0.38.0` (#285)
- Update overlays code and documentation (#282)
- Fix: Compass arrow in navigation control (#277)

### Version 3.0.0-alpha.13
- New: Add new examples (#270)
- Fix: Add `onLoad` callback to static map props and componentDidMount (#269)
- Fix: Change `pan` event listener to move specific `panmove` (#272)

### Version 3.0.0-alpha.12
- Bump mapbox-gl to 0.37.0
- New: `fitBounds` util function
- Fix: Map flickering when drag over popups
- BREAKING: `onChangeViewport` is now `onViewportChange`

### Version 3.0.0-alpha.11
- New event management system based on hammer.js
- FIX: Touch interaction
- Remove `MapControls` React component
- Remove `ControllerClass` prop from `InteractiveMap`
- Add `mapControls` prop to `InteractiveMap`
- Add `visibility` prop to `StaticMap` for showing/hiding the map
- Rename `_getMap` method to `getMap`
- Add `queryRenderedFeatures` method that exposes the MapboxGL API with the same name
- Remove all interactivity related props from `StaticMap`
- Remove intermediate state props from `InteractiveMap`: `startPanLngLat`, `startZoomLngLat`, `startBearing`, `startPitch`, `startZoom`.
- `InteractiveMap` is now stateful (`isDragging` and `isHover`)
- Rename `onClickFeatures` and `onHoverFeatures` to `onClick` and `onHover`. Remove `ignoreEmptyFeatures` prop. The callbacks are invoked with an event object with `features` and `lngLat` fields.
- New `getCursor` prop of `InteractiveMap`: returns cursor style from the current map state
- Rename `displayConstraints` to `visibilityConstraints`
- Remove `perspectiveEnabled` prop. Add `scrollZoom`, `dragPan`, `dragRotate`, `doubleClickZoom`, `touchZoomRotate` props.

### Version 3.0.0-alpha.10 - Add `ControllerClass` prop to `InteractiveMap`

### Version 3.0.0-alpha.9
- NEW: Marker component
- NEW: Popup component
- FIX: `attributeControl` prop
- NEW: NavigationControl component

### Version 3.0.0-alpha.8 - Fix server side rendering of InteractiveMap

### Version 3.0.0-alpha.7 - Bug fixes

* FIX: Prop comparison bug in static map
* FIX: Children get unmounted/re-mounted when the map is shown/hidden

### Version 3.0.0-alpha.6 - Bug fixes

* FIX: Viewport jump at start of rotation with pitch
* FIX: Viewport jump at start of pan with pitch
* FIX: Zoom around mouse position

### Version 3.0.0-alpha.5 - Add `pressKeyToRotate` prop on `MapControls`
### Version 3.0.0-alpha.4 - More transpile/export fixes
### Version 3.0.0-alpha.3 - Transpile/export fixes
### Version 3.0.0-alpha.3 - Remove JSX from overlays
### Version 3.0.0-alpha.2 - Hide map when pitch > 60.

## Version 3.0.0-alpha.1 - Major New Rlease

* NEW: Supports "tree-shaking" in Webpack2 and Rollup - adds new package.json
  `module` field that points to files with preserved ES6 import/exports.
* NEW: Significant reduction in number of npm dependencies.

* NEW: Setting the new `pressKeyToRotate` prop to `false` will make rotation
  rather than pan the default operation, requiring a function key to be pressed
  for pan.
* BREAKING: The `ChoroplethOverlay` React component is no longer part of the
  exported library. It has been moved to examples folder, applications that
  still need it can copy it from there instead of importing it directly.
  Removing `ChoroplethOverlay` eliminated a number of big D3 dependencies from
  react-map-gl, which seemed like the right tradeoff since most users are using
  mapbox styles or deck.gl layers for Choropleths.

### Event Handling Refactor

* Event handling (Pan/Zoom/Tilt) has been significantly refactored, and is
  now handled by a separate component (`MapControls`).
* A new `StaticMap` component is the actual `mapbox-gl` wrapper. It only
  handles click and hover events.
* The separation of event handling from the map component opens up some
  interesting use cases, including creating apps that can modify viewports
  beyond mapbox' rendering limits and using the `MapControls` with
  non-mapbox maps.

### Compatibility with v1

* A new `InteractiveMap` is provided, that uses the `MapControls` component
  to add pan/zoom/title to `StaticMap`. `InteractiveMap` closely resembles
  the original `MapGL` component from version 1 and is the default export
  of `react-map-gl` in v2. `react-map-gl` should thus be API compatible with
  v1 in most cases, although there might be subtle differences in how events
  are handled.

# Pre-releases

## 5.3.1 - Oct 25
- [Fix] Cannot resolve 'gl' warning in webpack 4 (#760)
- TranformFeedback: fix bug surfaced due to Chrome change (#599)
- Update whats-new, documentaiton urls

## 5.3.0 - June 1
## 5.3.0-rc.1 - May 24
- Website: URL fixes (#524)

## 5.3.0-alpha.6 - May 24
- Fix Transform class update element count (#522)
- Minor doc fix for the new picking shader module (#515)
- Fix failing canCompileGLGSExtension browser test (#458)

## 5.3.0-alpha.5 - May 21
- Export fp64 util functions (#520)

## 5.3.0-alpha.4 - May 21
- Port fp64 utils from deck.gl (#518)
- Allow non-buffer supplied to Transform's sourceBuffers (#519)

## 5.3.0-alpha.3 - May 16
- Add Attribute class (#514)

## 5.3.0-alpha.2 - May 14
- Fix some docs typos (#512)
- Collect WebGL context code into one directory (#511)
- add verticalAxis opt to TruncatedConGeometry (#491)
- Initial draft of offscreen rendering RFC (#510)
- Add off screen rendering example (PR 2/2) (#454)
- update what's new release date

## 5.3.0-alpha.1 - April 23
- Add discard too picking.js fragment shader (#509)

## 5.2.0-beta.2 - April 16
- Upgrade math.gl and probe.gl to official (non-alpha) versions
- VertexArray: move private methods to end of class (#498)
- Fix browser test of Framebuffer.blit (#497)
- fix markdown file for webgl-lessons
- fix examples and controls
- fix webpack file for example 14 and 15
- fix a typo in README (#489)
- Delete duplicate file (#486)

## 5.2.0-alpha.12 - April 2
- Fixes to electron support, debug mode and AnimationLoop (#483)
- PickingModule: picking_filterColor method (#464)
- Add AnimationLoopProxy class (#453)
- Clean up debug mode (#481)

## 5.2.0-alpha.11 - April 1
- babel 7

## 5.2.0-alpha.10 - Mar 29
- Integrate test-browser with "git commit" (#468)
- Fix Uniform Buffer binding (#473)

## 5.2.0-alpha.9 - Mar 27
- Allow null uniforms (#472)
- Add metrics collection (#466)

## 5.2.0-alpha.8 - Mar 26
- Do not delete Program objects while being cached. (#467)
- WebGL2 : Add asynchronous mode for readPixels using PBOs. (#450)

## 5.2.0-alpha.7 - Mar 22
- Don't throw on missing headless-gl.

## 5.2.0-alpha.6 - Mar 22
- Temporarily disable babel minify until issues are resolved

## 5.2.0-alpha.5 - Mar 22
- Fix babel-minify breakage in uniform verification

## 5.2.0-alpha.4 - Mar 21
- Publish minified luma.gl

## 5.2.0-alpha.3 - Mar 21
- esnext distribution
- math.gl 1.1.0

## 5.2.0-alpha.3 - Mar 3
- Update TF demo to use new Transform class (#433)
- Transform: Add updateBuffers method (#418)
- Fixed crash caused by wrong utils folder path (#431)

## 5.2.0-alpha.2 - Feb 27
- Fix exports (#428)
- Create pull_request_template.md
- Update issue_template.md
- Create issue_template.md
- Add the right blog link in roadmap.md (#427)
- Fix a crash: model.geometry is optional (#424)
- Fix array uniform setting (#422)

## 5.2.0-alpha.1 - Feb 26
- Fix a crash when Model object created without geometry. (#419)
- New method AnimationLoop.setProps to avoid breaking apps (#414)
- update math version

## 5.1.0 - Feb 14

## 5.0.0 - Dec 21
- Update links to point to 5.0-release branch
- Do not mark `needsRedraw` unless something changed (#376)
- Add deprecation check to shader modules (#377)
- Fix `model.render` inconsistencies (#375)
- Fix generic attribute support (#374)

## 5.0.0-beta.1 - Dec 18
- Remove deprecated API (#373)

## 4.1.0-beta.2 - Dec 12
- Enable Intel Tan shader WA for default GPU (#368)
- Improve perf of uniform setters (#370)
- Remove deprecated api usage (#367)

## 4.1.0-beta.1 - Nov 30
- Add buildkite (#356)
- Cleanup: remove un-used picking code (#366)
- Picking: Remove PICKING_NULL_COLOR, use 'null' (#365)
- Remove packages/math and add math.gl (#363)
- Use probe.gl for bench (#362)
- Program: Enhancements to attribute/uniform locations map setup. (#361)
- Fix AnimationLoop stop method (#360)

## 4.1.0-alpha.9 - Nov 20
- 4.1 API Audit (picking module, useDevicePixels) (#355)
- ShaderCache: Add support for Program objets. (#352)
- Add version during transpilation (#354)
- Make fp64 tests work under `tape` (#351)
- Remove context in logging. Fix formatting in shader errors (#348)

## 4.1.0-alpha.8 - Oct 29
- Fix the fp64 platform define (#344)
- Disable picking uniform warnings for now. (#342)

## 4.1.0-alpha.7 - Oct 12
- Fix duplicate console warnings (#341)

## 4.1.0-alpha.6 - Oct 11
 - Add moduleSettings parameter to Model.draw (#337)
 - Fix performance regression in picking flow (#339)
 - Copy enhanced Picking module from deck.gl (#338)
 - Fix browser test for TransformFeedback (#336)

## 4.1.0-alpha.5 - Oct 3
 - Fix example framebuffer usage and conditionally add shader extension (#330)
 - Fix `TransformFeedback.isSupported` bug (#333)
 - Fix priority of missing uniforms log (#334)

## 4.1.0-alpha.4 - Oct 2
 - Framebuffer binding fixes (#323)
 - Shadowmap example, Delete unused files (#325)
 - Prevent animation  loop from creating unused framebuffer (#326)

## 4.1.0-alpha.3 - Sep 27
 - Fix Framebuffer.clear (#321)
 - Add context management support for framebuffer binding. (#319)
 - Fix buffer.getData default parameters and target setting. (#317)
 - Hook up website links for example "lesson 12" and "lesson 13" (#312)
 - Add "lesson 13" example about fragment lighting and multiple programs (#311)
 - Miscellaneous fixes: GLSL error reporting, BlendMinMax test, 'cross origin' image load
 - Add "lesson 12" example about point lighting (#310)
 - Add "math.gl" dependency for website (#309)
 - fix fp64 test (#298)
 - Lesson 11 example for creating textured and lighted sphere (#305)
 - Keep version directive at the beginning of the shader during assembly. (#306)
 - fix compiling warnings caused by deprecated APIs
 - Make example work with Safari without using "var"
 - Lesson 10 for loading a game world
 - Wire up ShaderCache in Model class to avoid re-compilaiton of same shaders. (#301)

## 4.1.0-alpha.2 - Aug 28
 Debug improvements
 - wrap uniform/attribute tables in group (more compact log level 2)
 - remove rendering model end log (unnecessary line)
 - sort uniforms in table - first local uniforms, then module uniforms
 - title of model (layer) in table - more prominent, don't waste row
 - unify middle columns in attribute table (location and type/size/vert column)
 - reduce #lines of log from queryTimer (model.js) - enabled for all when seer is active

## 4.1.0-alpha.1 - Aug 10
- Add SphericalCoordinates and export Euler (#295)

## 4.0.1

- Wire up ShaderCache in Model class to avoid re-compilaiton of same shader (#301)

## 4.0.0-beta.6
- Call assembleShaders always (#270)
- Remove invalid assert on GL.POINTS (#268)
- Fix the WebGL context creation issue on Safari (#267)

## 4.0.0-beta.5
- Fix Shader Module dependency ordering (#266)
- API Audit - change 'settings' to 'parameters' (#264)
- Remove duplicate docs for faature management (#265)

## 4.0.0-beta.4
- Parameters: draw(`settings`) renamed to `parameters`
- Shader Modules: Move fp32 and fp64 from deck.gl
- WEBSITE: Remove/Retitle examples

## 4.0.0-beta.3
- Export feature detection functions (#260)
- Improve shadertools docs (#258)

## 4.0.0-beta.2
- FIX: Shader error parsing, shadertools export fix
- Changes to Picking module & fix Picking example  (#256)
- math library fixes (#253)
- Matrix docs (#254)
- Fix picking color encoding. (#252)
- Fix picking module & add FB unit tests. (#251)

## 4.0.0-beta.1
- Canvas and Drawing Buffer API fixes
- Reduce size of gl-matrix dependencies
- Support v3 texture parameters
- Shader Module System cleanup and use in some examples
- Webpack configuration consolidation

- WEBSITE: Shippable docs
- WEBSITE: SIZE and MULTIPLE CANVAS fixes
- WEBSITE: Restore Shadowmap and Particles Examples
- WEBSITE: Shader Module System - use in some examples
- WEBSITE: Webpack configuration consolidation
- WEBSITE: Framework links

## 4.0.0-alpha.14

- v4 Capability Management API finalization
- New Shader Module refactor
- Query objects enabled + unit tests
- NPOT workaround for texture-2d object
INTERNAL
- Add webgl-util readme
- Canvas resize/context creation moved to webgl-utils
- getParameter polyfill consolidated in webgl-utils
- Move non-working examples to wip folder
- Rename demo folder to website

## 4.0.0-alpha.13

- Un-deprecate `scenegraph` module (except `Scene`), merge with `core` module.
- `shadertools` module no longer experimental
- webgl2 uniform support

## 4.0.0-alpha.12

- FIX: Seer integration

## 4.0.0-alpha.11

- State and Parameter support
- Many fixes to examples

## 4.0.0-alpha.10

- FIX: Framebuffer resize & add unit test (#200)
- Add the pixel parameter back in texture class for compatibility with v3 (#198)
- FIX: 'npm run build' for demos (#195)
- FIX: Lesson 08 (#196)
- FIX: Lesson 07 (#194)

## 4.0.0-alpha.9

- FIX: Some leftover export fix and storage mode fix (#192)

## 4.0.0-alpha.8

- FIX: Remove duplicate export that fails tests in other repos (#191)

## 4.0.0-alpha.7

- FIX: Fix the texture storage mode settings (#189)
- FIX: examples/lessons (#188)
- Transform feedback fixes (#187)
- FIX: Example updates and fixes for textures (#186)
- Size improvements to transpiled code (dist)
- Tree-shaking improvements - carefully avoid dependencies that defeat tree shaking (#185)

## 4.0.0-alpha.6
- Fix framebuffer creation error AGAIN (#183)
- NEW: `UniformBufferLayout` class

## 4.0.0-alpha.4
- Remove null params given to Float32Array constructor (#176)
- Fix framebuffer creation error (#177)

## 4.0.0-alpha.3
- bump seer
- remove duplicate info from readme

## 4.0.0-alpha.2

- Reorgnize files (#168)
- Transform feedback improvement (#165)
- WebGL2 updates (#160)
- Buffer refactor (#156)
- Fix examples (#161, #149, #172, #173)
- Adding new docs for WebGL2 (#159)
- Demo site creation (#158)
- Docs cleanup and updates (#157, #169, #170)
- seer integration
- Add coverage support (#155)

## 4.0.0-alpha.1

- Refactor WebGL classes using new `Resource` base class
- `Resource.getParameters` for ease of debugging
- Fix FramebufferObject export
- GL state and limit management (#146)
- Fix shader file name (#151)
- Refactor many classes in the webgl folder (#136, #154)
- Check compilation and linking status only with debug WebGL context (#144)
- Add benchmarking scaffolding and a benchmark test for Program constructor (#142)
- Docs update (#137)


# Official releases


## v3

Theme: Pure ES6 Codebase/Build tooling improvements

### 3.0.2
- Check compilation and linking status only when debug WebGL context is used to improve performance (#144)

### 3.0.1
- Add CORS setting to allow loading image from a different domain

## 3.0.0

Codebase/Build tooling improvements
- Replace wildcard exports with named exports in index.js
- ES6 Conformant code base: stage-2 extensions removed
- Webpack based build
- Multiple examples now work standalone
- Experimental tree-shaking support: dist and dist-es6 directories
- Dependency removal, including removal of `autobind-decorator` dependency
- Changed precommit hook from `husky` to `pre-commit`
- `shader-modules`, `shader-tools`, `shaders` shader module system added to `/experimental`
- `probe` moved to `/experimental`
- `webgl` folder now contains both webgl1 and webgl2 classes

Feature Improvements
- Performance query using EXT_disjoint_timer_query #121

Breaking Changes:
- BREAKING CHANGE: Move node IO (loadImage etc) out of main src tree
  and into `packages`. This allows luma.gl to drop a number of big dependencies.
  The node IO code may be published as a separate module later.

### 2.10.4
- FIX: Fix for glGetDebugInfo regression on Intel processors.

### 2.10.3
- FIX: Fix for glGetDebugInfo regression under Node in 2.10.2.
- FIX: Add "experimental.js" to exported "files" in package.json.

### 2.10.2
- FEATURE: Introduce experimental ShaderCache
- FIX: for glGetDebugInfo under Firefox (WEBGL_debug_renderer_info issue)
- CHANGE: Removes glslify as a dependency, apps that depend on glslify
  must add it to their own package.json.

### 2.10.1
- FIX: glslify path.

### 2.10.0
- Introduce new gl-matrix based math library.
- Move old math lib to deprecated folder.
- Move FBO to deprecated folder.
- Examples converted to ES6. AnimationLoop class updates.
- Add back persistence example
- WebGL type and constant cleanup
- Fix glTypeToArray and use clamped arrays by default

### 2.9.1 GLSL shader compiler error handling
  - FIX: GLSL shader compiler error parsing

### 2.9.0  TimerQuery, WebGL Extension doc, fix crash on Travis CI
  - Support EXT_disjoint_timer_query
  - Document luma.gl use of WebGL extensions.
  - Fix: context creation crash when WEBGL_debug_info extension was undefined
  - Add

### 2.8.0  Debug log improvements, import fix
  - Debug logs now print unused attributes more compactly, number formatting
    improved.
  - FIX: io import issue in 2.7.0

### 2.7.0 - Add ability to import luma without io
  - import "luma.gl/luma" will import luma without io functions
  - import "luma.gl/io" will import luma io functions only
  - omitting io functions significantly reduces dependencies

### 2.6.0 - "64 bit" camera projection matrix
 - Add 64 bit matrix to Luma.gl Camera
 - Updated linter rules

### 2.5.4 - FIX: Luma global initialization
- Makes the luma object available in console for debugging.
- Makes optional headless support more reliable.

### 2.5.3 - FIX: Linux rendering issues
- Add missing call to getAttribLocation.
- Some polish on luma's built-in attribute/uniform logging

### 2.5.2 - FIX: document.navigator override
- More gentle override, carefully restoring the variable.

### 2.5.1 - FIX: make deprecated AttributeManager.add updateMap work again
- Attribute manager changes

### 2.5.0 - Node.js/AttributeManager/Renderer/Program.render()/Examples

- Ensure luma.gl does not fail under node until createGLContext is called.

- Program.render() now takes a map of uniforms,
  reducing need to "set" uniforms before render.

- AttributeManager improvements
    - add logging/instrumentation hooks, to help apps profile attribute updates.
    - Pass AttributeManager.update() parameters through to the individual
      attribute updater funcs, enabling app to generate shared attributes
      independently of layers for additional performance gains.
    - Add JSDoc to all public methods and basic test cases.

- New experimental Renderer class - `requestAnimationFrame` replacement.

- Improvement/fixes to examples

### 2.4.2 - FIX: redraw flag management
- Fix redrawFlag names

### 2.4.1 - FIX: headless mode
- Add headless.js to exported files

### 2.4.0 - Improve change detection
- Redraw flag management improvements

### 2.3.0 - Decoupled headless-gl dependency
- It is now necessary to import luma.gl through `luma.gl/headless` to get
headless integration.
  When using the basic `luma.gl` import, the app no longer needs to
have `gl` as a dependency.
 This should simplify build and setup for applications that don't use
headless-gl.

### 2.2.0
  - Fixed a doc mistake

### 2.1.0 - Copy of 2.0.0 release
  - Published mainly to ensure 2.0.4-0 does not get included by
  semver wildcards.

### 2.0.4-0 - Misnamed beta release
  - Don't use. This was a misnamed beta release.

### 2.0.0 - Major API refactoring

### 1.0.1 - Initial release.


# Prereleases

Note: Unfortunately 3.0.0-beta6 was published without beta tag and takes
precedence when using wildcard installs.

### 3.0.0-beta.9
- FIX: Additional fix for regression in geometry constructor

### 3.0.0-beta.8
- FIX: Regression in geometry constructor (support deprecated mode)
- FIX: Initialization of global and startup logging
- FIX: Ensure framebuffer resize logging is not visible by default

### 3.0.0-beta.7
- Bump version to avoid confusion with older incorrectly numbered beta versions
- Replace wildcard exports with named exports in index.js
- Remove all Work In Progress Examples - Focus on working code
- Multiple examples now work standalone

### 3.0.0-beta.3
- ES6 Conformant code base: stage-2 extensions removed
- Experimental tree-shaking support: dist and dist-es6 directories
- Webpack based build

### 3.0.0-beta1 - 3.0.0-beta6 obsolete, folded into master

### 3.0.0-alpha.4
- Performance query using EXT_disjoint_timer_query #121

### 3.0.0-alpha.3
- Changed from `husky` to `pre-commit`
- Removed `autobind-decorator` dependency

### 3.0.0-alpha2
- `shader-modules`, `shader-tools`, `shaders` shader module system added to `/experimental`
- `probe` moved to `/experimental`
- `webgl` folder now contains both webgl1 and webgl2 classes

### 3.0.0-alpha1
- BREAKING CHANGE: Move node IO (loadImage etc) out of main src tree
  and into `packages`. This allows luma.gl to drop a number of big dependencies.
  The node IO code may be published as a separate module later.

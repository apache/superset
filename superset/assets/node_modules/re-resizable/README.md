<p align="center"><img src ="https://github.com/bokuweb/re-resizable/blob/master/logo.png?raw=true" /></p>

<p align="center">📏 A resizable component for React.</p>

<p align="center"><a href="https://circleci.com/gh/bokuweb/re-resizable/tree/master">
<img src="https://circleci.com/gh/bokuweb/re-resizable/tree/master.svg?style=svg" alt="Build Status" /></a>
<a href="https://www.npmjs.com/package/re-resizable">
<img src="https://img.shields.io/npm/v/re-resizable.svg" alt="Build Status" /></a>
<a href="https://www.npmjs.com/package/re-resizable">
<img src="https://img.shields.io/npm/dm/re-resizable.svg" /></a>
<a href="https://renovatebot.com/">
<img src="https://img.shields.io/badge/renovate-enabled-brightgreen.svg" /></a>
<a href="https://github.com/prettier/prettier">
<img src="https://img.shields.io/badge/styled_with-prettier-ff69b4.svg" /></a>
<a href="https://bokuweb.github.io/re-resizable/">
<img src="https://github.com/storybooks/press/blob/master/badges/storybook.svg" /></a>
</p>

## Table of Contents

* [Screenshot](#Screenshot)
* [Live Demo](#live-demo)
  * [Storybook](#storybook)
  * [CodeSandbox](#codesandbox)
* [Install](#install)
* [Usage](#usage)
* [Props](#props)
* [Instance API](#instance-api)
  * [updateSize(size: { width: number | string, height: number | string }): void](#updateSize-void)
* [Test](#test)
* [Related](#related)
* [Changelog](#changelog)
* [License](#license)

## Screenshot

![screenshot](https://github.com/bokuweb/re-resizable/blob/master/docs/screenshot.gif?raw=true)

## Live Demo

### Storybook

[Storybook](http://bokuweb.github.io/re-resizable/)

### CodeSandbox

[![Edit xp9p7272m4](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/xp9p7272m4)    
[CodeSandbox](https://codesandbox.io/s/xp9p7272m4)    
[CodeSandbox(TypeScript)](https://codesandbox.io/s/1vwo2p4l64)

## Install

``` sh
$ npm install --save re-resizable
```

## Usage

### Example with `defaultSize`

``` javascript
<Resizable
  defaultSize={{
    width:320,
    height:200,
  }}
>
  Sample with default size
</Resizable>
```

### Example with `size`

If you use `size` props, please manage state by yourself.

``` javascript
<Resizable
  size={{ width: this.state.width, height: this.state.height }}
  onResizeStop={(e, direction, ref, d) => {
    this.setState({
      width: this.state.width + d.width,
      height: this.state.height + d.height,
    });
  }}
>
  Sample with size
</Resizable>
```

## Props

#### `defaultSize?: { width: (number | string), height: (number | string) };`

Specifies the `width` and `height` that the dragged item should start at.
For example, you can set `300`, `'300px'`, `50%`.
If both `defaultSize` and `size` omitted, set `'auto'`.

`defaultSize` will be ignored when `size` set.

#### `size?: { width: (number | string), height: (number | string) };`

The `size` property is used to set the size of the component.
For example, you can set `300`, `'300px'`, `50%`.

Use `size` if you need to control size state by yourself.

#### `className?: string;`

The `className` property is used to set the custom `className` of a resizable component.

#### `style?: { [key: string]: string };`

The `style` property is used to set the custom `style` of a resizable component.

#### `minWidth?: number | string;`

The `minWidth` property is used to set the minimum width of a resizable component. Defaults to 10px.

#### `minHeight?: number | string;`

The `minHeight` property is used to set the minimum height of a resizable component. Defaults to 10px.

#### `maxWidth?: number | string;`

The `maxWidth` property is used to set the maximum width of a resizable component.

#### `maxHeight?: number | string`;

The `maxHeight` property is used to set the maximum height of a resizable component.

#### `grid?: [number, number];`

The `grid` property is used to specify the increments that resizing should snap to. Defaults to `[1, 1]`.

#### `snap?: { x?: Array<number>, y?: Array<number> };`

The `snap` property is used to specify absolute pixel values that resizing should snap to. `x` and `y` are both optional, allowing you to only include the axis you want to define. Defaults to `null`.

#### `resizeRatio?: number | string;`

The `resizeRatio` property is used to set the number of pixels the resizable component scales by compared to the number of pixels the mouse/touch moves. Defaults to `1` (for a 1:1 ratio). The number set is the left side of the ratio, `2` will give a 2:1 ratio.

#### `lockAspectRatio?: boolean | number;`

The `lockAspectRatio` property is used to lock aspect ratio.
Set to `true` to lock the aspect ratio based on the initial size.
Set to a numeric value to lock a specific aspect ratio (such as `16/9`).
If set to numeric, make sure to set initial height/width to values with correct aspect ratio.
If omitted, set `false`.

#### `lockAspectRatioExtraWidth?: number;`

The `lockAspectRatioExtraWidth` property enables a resizable component to maintain an aspect ratio plus extra width.
For instance, a video could be displayed 16:9 with a 50px side bar.
If omitted, set `0`.

#### `lockAspectRatioExtraHeight?: number;`

The `lockAspectRatioExtraHeight` property enables a resizable component to maintain an aspect ratio plus extra height.
For instance, a video could be displayed 16:9 with a 50px header bar.
If omitted, set `0`.

#### `bounds?: ('window' | 'parent' | HTMLElement);`

Specifies resize boundaries.

#### `handleStyles?: HandleStyles;`

The `handleStyles` property is used to override the style of one or more resize handles.
Only the axis you specify will have its handle style replaced.
If you specify a value for `right` it will completely replace the styles for the `right` resize handle,
but other handle will still use the default styles.

#### `handleClasses?: HandleClassName;`

The `handleClasses` property is used to set the className of one or more resize handles.

#### `handleComponent?: HandleComponent;`

The `handleComponent` property is used to pass a React Component to be rendered as one or more resize handle. For example, this could be used to use an arrow icon as a handle..

#### `handleWrapperStyle?: { [key: string]: string };`

The `handleWrapperStyle` property is used to override the style of resize handles wrapper.

#### `handleWrapperClass?: string;`

The `handleWrapperClass` property is used to override the className of resize handles wrapper.

#### `enable?: ?Enable;`

The `enable` property is used to set the resizable permission of a resizable component.

The permission of `top`, `right`, `bottom`, `left`, `topRight`, `bottomRight`, `bottomLeft`, `topLeft` direction resizing.
If omitted, all resizer are enabled.
If you want to permit only right direction resizing, set `{ top:false, right:true, bottom:false, left:false, topRight:false, bottomRight:false, bottomLeft:false, topLeft:false }`.

#### `onResizeStart?: ResizeStartCallBack;`

`ResizeStartCallBack` type is below.

```javascript
type ResizeStartCallback = (
  e: SyntheticMouseEvent<HTMLDivElement> | SyntheticTouchEvent<HTMLDivElement>,
  dir: ResizableDirection,
  refToElement: HTMLDivElement,
) => void;
```

Calls when resizable component resize start.

#### `onResize?: ResizeCallback;`

#### `scale?: number`;

The `scale` property is used in the scenario where the resizable element is a descendent of an element using css scaling (e.g. - `transform: scale(0.5)`).

### Basic

`ResizeCallback` type is below.

```javascript
type ResizeCallback = (
  event: MouseEvent | TouchEvent,
  direction: ResizableDirection,
  refToElement: HTMLDivElement,
  delta: NumberSize,
) => void;
```

Calls when resizable component resizing.

#### `onResizeStop?: ResizeCallback;`

`ResizeCallback` type is below.

```javascript
type ResizeCallback = (
  event: MouseEvent | TouchEvent,
  direction: ResizableDirection,
  refToElement: HTMLDivElement,
  delta: NumberSize,
) => void;
```

Calls when resizable component resize stop.

## Instance API

#### * `updateSize(size: { width: number | string, height: number | string }): void`

Update component size.

`grid`, `snap`, `max/minWidth`, `max/minHeight` props is ignored, when this method called.

- for example

```javascript
class YourComponent extends Component {

  ...

  update() {
    this.resizable.updateSize({ width: 200, height: 300 });
  }

  render() {
    return (
      <Resizable ref={c => { this.resizable = c; }}>
        example
      </Resizable>
    );
  }

  ...
}
```


## Contribute

If you have a feature request, please add it as an issue or make a pull request.

If you have a bug to report, please reproduce the bug in [CodeSandbox](https://codesandbox.io/s/ll587k677z) to help us easily isolate it.



## Test

``` sh
npm test
```

## Related

- [react-rnd](https://github.com/bokuweb/react-rnd)
- [react-sortable-pane](https://github.com/bokuweb/react-sortable-pane)

## Changelog

#### v4.11.0

- Add resizeRatio props.

#### v4.10.0

- Add scale props #388

#### v4.9.3

- Fix auto having "px" appended #382

#### v4.9.2

- Adjust initial left position of element to 0 for safari fix. #374

#### v4.9.1

- Fix flow type #364

#### v4.8.1

- added snap to `index.d.ts`.

#### v4.8.0

- added feature: absolute snap dimensions #337

#### v4.7.1

- fix: fix behavior when set auto

#### v4.7.0

- fix: fix behavior which is set percentage size and absolute position

#### v4.6.1

- fix: Fixed `index.d.ts`, `HTMLElement` to `HTMLDivElement` and other.
- fix: Fixed `index.d.ts` to allow number for aspectLatio.
- fix: downgrade `rollup` version, because v0.61.0 break `re-resizable` build.

#### v4.6.0 (unpublished)

- fix: Fixed `index.d.ts`, `HTMLElement` to `HTMLDivElement` and other.

#### v4.5.2 (unpublished)

- fix: Fixed `index.d.ts` to allow number for aspectLatio.

#### v4.4.11

- fix: Fixed `index.d.ts` to allow `HTMLDivElement` properties. #292

#### v4.4.10

- fix: Fixed `Array.from` error in IE11

#### v4.4.8

- fix: Fixed behavior when nested #220

#### v4.4.7

- fix: #218 size not updated when zero props pass

#### v4.4.6

- fix: use `relative` position when get base size

#### v4.4.5

- chore: upgrade flow-bin

#### v4.4.4

- fix: base finder
- fix: add mouse leave

#### v4.4.3

- fix: fix type issues in index.d.ts.

#### v4.4.2

- fix: fixed bug where base could not be found

#### v4.4.1

- fix: add guard to avoid error without parent

#### v4.4.0

- fix: bug behavior with flex layout
- chore: refactor
- chore: update deps
- chore: update d.ts
- chore: add some stories

#### v4.3.2

- Fixed a bug, when resizing sometimes causes text-selection in some browser #182

#### v4.3.1

- Fixed a bug, `auto` overwritten by px value #179

#### v4.3.0

- Allow 0 as minWidth and minHeight #178

#### v4.2.0

- Add a option for passing custom handle components #170

#### v4.1.2

- Fixed a bug, Text select while resizing in IE11 #166

#### v4.1.1

- Fixed a bug, Element width id="__resizable0" breaks my layout #162

#### v4.1.0

- Additional height and width with lockAspectRatio #163

#### v4.0.3

- Use ES5-compatible prototype methods #160

#### v4.0.2

- Fix using right click on resize #152
- Add workaround when base Node not found.

#### v4.0.1

- Update index.d.ts, Fixes #153

#### v4.0.0

- Remove `width` and `height`.
- Add `defaultSize` and `size`,

#### v3.0.0

- Fix flowtype annotation.
- Remove `extendsProps`.

You can add extendsProps as follows.

```
<Resizable data-foo="foo" />
```

#### v3.0.0-beta.3

- fix typo. `ResizeStartCallBack` -> `ResizeStartCallback`.

#### v3.0.0-beta.2

- export `ResizeDirection` type.
- rename `Callback` to `ResizeCallback`.

#### v3.0.0-beta.1

- Fix flow filename.
- Change logo

#### v3.0.0-beta.0

- Change package name, `react-resizable-box` -> `re-resizable`.
- Add `handleWrapperStyle` and `handleWrapperClass` props.
- Change behavior that is set percentage size to width or height as props.
- Support percentage max/min size.
- Use rollup.
- Fix props name.
  - `handersClasses` -> `handleClasses`
  - `handersStyles` -> `handleStyles`

#### v2.1.0

- Remove `shouldUpdateComponent` (#135).
- Remove `lodash.isEqual`.

#### v2.0.6

- Update README.

#### v2.0.5

- Fix remove event listener

#### v2.0.4

- Fix receiveProps. (related #85)

#### v2.0.3

- Update dev dependencies.
- Modify index.js.flow.

#### v2.0.2

- Remove offset state.
- Use `border-box`.
- Fix boundary size.

#### v2.0.1

- Add offset state for rnd component.

#### v2.0.0

- Update index.js.flow

#### v2.0.0-rc.2

- Use `flowtype`.
- Change callback args.
- Change some props name.
  - isResizable => enable.
  - customClass => className.
  - customStyle => style.
  - handleStyle => handlerStyles.
  - handleClass => handlerClasses.
- Add bounds feature.
- Fix min/max size checker when aspect ratio locked.

#### v1.8.4

- Fix cursor

#### v1.8.3

- Fix npm readme

#### v1.8.2

- Add index.d.ts.
- Fix resize glitch when aspct ratio locked.

#### v1.8.1

- Fixing issue on resizing with touch events

#### v1.8.0

- Add `extendsProps` prop to other props (e.g. `data-*`, `aria-*`, and other ).

#### v1.7.0

- Support siver side rendering #43

#### v1.6.0

- Add `updateSize` method.

#### v1.5.1

- Add `lockAspectRatio` property.

#### v1.4.3

- Avoid unnecessary rendering on resizer

#### v1.4.2

- Fix onTouchStart bind timing to avoid re-rendering

#### v1.4.1

- Support preserving auto size #40 (thanks @noradaiko)

#### v1.4.0

- Add `grid` props to snap grid. (thanks @paulyoung)

#### v1.3.0

- Add `userSelect: none` when resize get srated.
- Add shouldComponentUpdate.
- Add handle custom className.

#### v1.2.0

- Add module export plugin for `require`.

#### v1.1.3

- Update document.

#### v1.1.2

- Add size argument to resizeStart callback.
- Fix bug

#### v1.1.1

- Fix delta value bug

#### v1.1.0

- Add delta argument to onResize and onResizeStop callback.

#### v1.0.0

- Rename and add resizer.

#### v0.4.2

- Support react v15
- ESLint run when push

#### v0.4.1

- Add mousedown event object to `onResizeStart` callback argument.

#### v0.4.0

- Support `'px'` and `'%'` for width and height props.


## License

The MIT License (MIT)

Copyright (c) 2018 bokuweb

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

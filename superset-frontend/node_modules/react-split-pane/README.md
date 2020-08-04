# React Split Pane

[![NPM version](https://img.shields.io/npm/v/react-split-pane.svg?style=flat)](https://www.npmjs.com/package/react-split-pane)
![NPM license](https://img.shields.io/npm/l/react-split-pane.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/react-split-pane.svg?style=flat)](https://npmcharts.com/compare/react-split-pane?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/react-split-pane.svg?style=flat)](https://npmcharts.com/compare/react-split-pane?minimal=true)
[![Build Status](https://img.shields.io/travis/tomkp/react-split-pane/master.svg?style=flat)](https://travis-ci.org/tomkp/react-split-pane)
[![Coverage Status](https://img.shields.io/coveralls/tomkp/react-split-pane/master.svg?style=flat)](https://coveralls.io/r/tomkp/react-split-pane)

Split-Pane React component, can be nested or split vertically or horizontally!

## Installing

```sh
npm install react-split-pane

# or if you use yarn

yarn add react-split-pane
```

## Example Usage

```jsx
<SplitPane split="vertical" minSize={50} defaultSize={100}>
  <div />
  <div />
</SplitPane>
```

```jsx
<SplitPane split="vertical" minSize={50}>
  <div />
  <SplitPane split="horizontal">
    <div />
    <div />
  </SplitPane>
</SplitPane>
```

## Props

### primary

By dragging 'draggable' surface you can change size of the first pane.
The first pane keeps then its size while the second pane is resized by browser window.
By default it is the left pane for 'vertical' SplitPane and the top pane for 'horizontal' SplitPane.
If you want to keep size of the second pane and let the first pane to shrink or grow by browser window dimensions,
set SplitPane prop `primary` to `second`. In case of 'horizontal' SplitPane the height of bottom pane remains the same.

Resizing can be disabled by passing the `allowResize` prop as `false` (`allowResize={false}`). Resizing is enabled by default.

You can also set the size of the pane using the `size` prop. Note that a size set through props ignores the `defaultSize` and `minSize` properties.

In this example right pane keeps its width 200px while user is resizing browser window.

```jsx
<SplitPane split="vertical" defaultSize={200} primary="second">
  <div />
  <div />
</SplitPane>
```

### maxSize

You can limit the maximal size of the 'fixed' pane using the maxSize parameter with a positive value (measured in pixels but state just a number).
If you wrap the SplitPane into a container component (yes you can, just remember the container has to have the relative or absolute positioning),
then you'll need to limit the movement of the splitter (resizer) at the end of the SplitPane (otherwise it can be dragged outside the SplitPane
and you don't catch it never more). For this purpose use the maxSize parameter with value 0. When dragged the splitter/resizer will stop at the border
of the SplitPane component and think this you'll be able to pick it again and drag it back then.
And more: if you set the maxSize to negative value (e.g. -200), then the splitter stops 200px before the border (in other words it sets the minimal
size of the 'resizable' pane in this case). This can be useful also in the full-screen case of use.

### step

You can use the step prop to only allow resizing in fixed increments.

### onDragStarted

This callback is invoked when a drag starts.

### onDragFinished

This callback is invoked when a drag ends.

### onChange

This callback is invoked with the current drag during a drag event. It is recommended that it is wrapped in a debounce function.

### Inline Styles

You can also pass inline styles to the components via props. These are:

- `style` - Styling to be applied to the main container.
- `paneStyle` - Styling to be applied to both panes
- `pane1Style` - Styling to be applied to the first pane, with precedence over `paneStyle`
- `pane2Style` - Styling to be applied to the second pane, with precedence over `paneStyle`
- `resizerStyle` - Styling to be applied to the resizer bar

## Persisting Positions

Each SplitPane accepts an onChange function prop. Used in conjunction with
defaultSize and a persistence layer, you can ensure that your splitter choices
survive a refresh of your app.

For example, if you are comfortable with the trade-offs of localStorage, you
could do something like the following:

```jsx
<SplitPane
  split="vertical"
  minSize={50}
  defaultSize={parseInt(localStorage.getItem('splitPos'), 10)}
  onChange={size => localStorage.setItem('splitPos', size)}
>
  <div />
  <div />
</SplitPane>
```

Disclaimer: localStorage has a variety of performance trade-offs. Browsers such
as Firefox have now optimized localStorage use so that they will asynchronously
initiate a read of all saved localStorage data for an origin once they know the
page will load. If the data has not fully loaded by the time code accesses
localStorage, the code will cause the page's main thread to block until the
database load completes. When the main thread is blocked, no other JS code will
run or layout will occur. In multiprocess browsers and for users with fast
disk storage, this will be less of a problem. You _are_ likely to get yelled at
if you use localStorage.

A potentially better idea is to use something like
https://github.com/mozilla/localForage although hooking it up will be slightly
more involved. You are likely to be admired by all for judiciously avoiding
use of localStorage.

## Example styling

This gives a single pixel wide divider, but with a 'grabbable' surface of 11 pixels.

Thanks to `background-clip: padding-box;` for making transparent borders possible.

```css
.Resizer {
  background: #000;
  opacity: 0.2;
  z-index: 1;
  -moz-box-sizing: border-box;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  -moz-background-clip: padding;
  -webkit-background-clip: padding;
  background-clip: padding-box;
}

.Resizer:hover {
  -webkit-transition: all 2s ease;
  transition: all 2s ease;
}

.Resizer.horizontal {
  height: 11px;
  margin: -5px 0;
  border-top: 5px solid rgba(255, 255, 255, 0);
  border-bottom: 5px solid rgba(255, 255, 255, 0);
  cursor: row-resize;
  width: 100%;
}

.Resizer.horizontal:hover {
  border-top: 5px solid rgba(0, 0, 0, 0.5);
  border-bottom: 5px solid rgba(0, 0, 0, 0.5);
}

.Resizer.vertical {
  width: 11px;
  margin: 0 -5px;
  border-left: 5px solid rgba(255, 255, 255, 0);
  border-right: 5px solid rgba(255, 255, 255, 0);
  cursor: col-resize;
}

.Resizer.vertical:hover {
  border-left: 5px solid rgba(0, 0, 0, 0.5);
  border-right: 5px solid rgba(0, 0, 0, 0.5);
}
.Resizer.disabled {
  cursor: not-allowed;
}
.Resizer.disabled:hover {
  border-color: transparent;
}
```

## New Version

**I'm working on an updated version of this library, and looking for help:**

Demo

http://react-split-pane-v2.surge.sh/

Install

```sh
npm install react-split-pane@next

# or if you use yarn

yarn add react-split-pane@next
```

Usage

```jsx
import SplitPane, { Pane } from 'react-split-pane';

<SplitPane split="vertical">
  <Pane initialSize="200px">You can use a Pane component</Pane>
  <div>or you can use a plain old div</div>
  <Pane initialSize="25%" minSize="10%" maxSize="500px">
    Using a Pane allows you to specify any constraints directly
  </Pane>
</SplitPane>;
```

Pull request

https://github.com/tomkp/react-split-pane/pull/240

More discussion

https://github.com/tomkp/react-split-pane/issues/233

## Contributing

I'm always happy to receive Pull Requests for contributions of any kind.

Please include tests and/or update the examples if possible.

Thanks, Tom

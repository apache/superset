# <img src="https://user-images.githubusercontent.com/1416436/54170652-dfd59d80-444d-11e9-9c51-658638c0454b.png" width="400" alt="React Sortable HOC" />

> A set of higher-order components to turn any list into an animated, accessible and touch-friendly sortable list

[![npm version](https://img.shields.io/npm/v/react-sortable-hoc.svg)](https://www.npmjs.com/package/react-sortable-hoc)
[![npm downloads](https://img.shields.io/npm/dm/react-sortable-hoc.svg)](https://www.npmjs.com/package/react-sortable-hoc)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg?maxAge=2592000)](https://github.com/clauderic/react-sortable-hoc/blob/master/LICENSE)
[![Gitter](https://badges.gitter.im/clauderic/react-sortable-hoc.svg)](https://gitter.im/clauderic/react-sortable-hoc)
![gzip size](http://img.badgesize.io/https://npmcdn.com/react-sortable-hoc/dist/react-sortable-hoc.umd.min.js?compression=gzip)

### Examples available here: <a href="#">http://clauderic.github.io/react-sortable-hoc/</a>

## Features

- **Higher Order Components** – Integrates with your existing components
- **Drag handle, auto-scrolling, locked axis, events, and more!**
- **Suuuper smooth animations** – Chasing the 60FPS dream 🌈
- **Works with virtualization libraries: [react-virtualized](https://github.com/bvaughn/react-virtualized/), [react-tiny-virtual-list](https://github.com/clauderic/react-tiny-virtual-list), [react-infinite](https://github.com/seatgeek/react-infinite), etc.**
- **Horizontal lists, vertical lists, or a grid** ↔ ↕ ⤡
- **Touch support** 👌
- **Accessible: supports keyboard sorting**

## Installation

Using [npm](https://www.npmjs.com/package/react-sortable-hoc):

    $ npm install react-sortable-hoc --save

Then, using a module bundler that supports either CommonJS or ES2015 modules, such as [webpack](https://github.com/webpack/webpack):

```js
// Using an ES6 transpiler like Babel
import {SortableContainer, SortableElement} from 'react-sortable-hoc';

// Not using an ES6 transpiler
var Sortable = require('react-sortable-hoc');
var SortableContainer = Sortable.SortableContainer;
var SortableElement = Sortable.SortableElement;
```

Alternatively, an UMD build is also available:

```html
<script src="react-sortable-hoc/dist/react-sortable-hoc.umd.js"></script>
```

## Usage

### Basic Example

```js
import React, {Component} from 'react';
import {render} from 'react-dom';
import {SortableContainer, SortableElement} from 'react-sortable-hoc';
import arrayMove from 'array-move';

const SortableItem = SortableElement(({value}) => <li>{value}</li>);

const SortableList = SortableContainer(({items}) => {
  return (
    <ul>
      {items.map((value, index) => (
        <SortableItem key={`item-${value}`} index={index} value={value} />
      ))}
    </ul>
  );
});

class SortableComponent extends Component {
  state = {
    items: ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6'],
  };
  onSortEnd = ({oldIndex, newIndex}) => {
    this.setState(({items}) => ({
      items: arrayMove(items, oldIndex, newIndex),
    }));
  };
  render() {
    return <SortableList items={this.state.items} onSortEnd={this.onSortEnd} />;
  }
}

render(<SortableComponent />, document.getElementById('root'));
```

That's it! React Sortable does not come with any styles by default, since it's meant to enhance your existing components.

More code examples are available [here](https://github.com/clauderic/react-sortable-hoc/blob/master/examples/).

## Why should I use this?

There are already a number of great Drag & Drop libraries out there (for instance, [react-dnd](https://github.com/gaearon/react-dnd/) is fantastic). If those libraries fit your needs, you should definitely give them a try first. However, most of those libraries rely on the HTML5 Drag & Drop API, which has some severe limitations. For instance, things rapidly become tricky if you need to support touch devices, if you need to lock dragging to an axis, or want to animate the nodes as they're being sorted. React Sortable HOC aims to provide a simple set of higher-order components to fill those gaps. If you're looking for a dead-simple, mobile-friendly way to add sortable functionality to your lists, then you're in the right place.

### Prop Types

#### SortableContainer HOC

| Property                          | Type                                                      | Default                                                                                                        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| :-------------------------------- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| axis                              | String                                                    | `y`                                                                                                            | Items can be sorted horizontally, vertically or in a grid. Possible values: `x`, `y` or `xy`                                                                                                                                                                                                                                                                                                                                                                           |
| lockAxis                          | String                                                    |                                                                                                                | If you'd like, you can lock movement to an axis while sorting. This is not something that is possible with HTML5 Drag & Drop. Possible values: `x` or `y`.                                                                                                                                                                                                                                                                                                             |
| helperClass                       | String                                                    |                                                                                                                | You can provide a class you'd like to add to the sortable helper to add some styles to it                                                                                                                                                                                                                                                                                                                                                                              |
| transitionDuration                | Number                                                    | `300`                                                                                                          | The duration of the transition when elements shift positions. Set this to `0` if you'd like to disable transitions                                                                                                                                                                                                                                                                                                                                                     |
| keyboardSortingTransitionDuration | Number                                                    | `transitionDuration`                                                                                           | The duration of the transition when the helper is shifted during keyboard sorting. Set this to `0` if you'd like to disable transitions for the keyboard sorting helper. Defaults to the value set for `transitionDuration` if undefined                                                                                                                                                                                                                               |
| keyCodes                           | Array<Number>                                             | `{`<br/>&nbsp;&nbsp;`lift: [32],`<br/>&nbsp;&nbsp;`drop: [32],`<br/>&nbsp;&nbsp;`cancel: [27],`<br/>&nbsp;&nbsp;`up: [38, 37],`<br/>&nbsp;&nbsp;`down: [40, 39]`<br/>`}`                                                                                                                        | An object containing an array of keycodes for each keyboard-accessible action.                                                                                                                                                                                                                                                                   |
| pressDelay                        | Number                                                    | `0`                                                                                                            | If you'd like elements to only become sortable after being pressed for a certain time, change this property. A good sensible default value for mobile is `200`. Cannot be used in conjunction with the `distance` prop.                                                                                                                                                                                                                                                |
| pressThreshold                    | Number                                                    | `5`                                                                                                            | Number of pixels of movement to tolerate before ignoring a press event.                                                                                                                                                                                                                                                                                                                                                                                                |
| distance                          | Number                                                    | `0`                                                                                                            | If you'd like elements to only become sortable after being dragged a certain number of pixels. Cannot be used in conjunction with the `pressDelay` prop.                                                                                                                                                                                                                                                                                                               |
| shouldCancelStart                 | Function                                                  | [Function](https://github.com/clauderic/react-sortable-hoc/blob/master/src/SortableContainer/index.js#L48)     | This function is invoked before sorting begins, and can be used to programatically cancel sorting before it begins. By default, it will cancel sorting if the event target is either an `input`, `textarea`, `select` or `option`.                                                                                                                                                                                                                                     |
| updateBeforeSortStart             | Function                                                  |                                                                                                                | This function is invoked before sorting begins. It can return a promise, allowing you to run asynchronous updates (such as `setState`) before sorting begins. `function({node, index, collection, isKeySorting}, event)`                                                                                                                                                                                                                                               |
| onSortStart                       | Function                                                  |                                                                                                                | Callback that is invoked when sorting begins. `function({node, index, collection, isKeySorting}, event)`                                                                                                                                                                                                                                                                                                                                                               |
| onSortMove                        | Function                                                  |                                                                                                                | Callback that is invoked during sorting as the cursor moves. `function(event)`                                                                                                                                                                                                                                                                                                                                                                                         |
| onSortOver                        | Function                                                  |                                                                                                                | Callback that is invoked when moving over an item. `function({index, oldIndex, newIndex, collection, isKeySorting}, e)`                                                                                                                                                                                                                                                                                                                                                |
| onSortEnd                         | Function                                                  |                                                                                                                | Callback that is invoked when sorting ends. `function({oldIndex, newIndex, collection, isKeySorting}, e)`                                                                                                                                                                                                                                                                                                                                                              |
| useDragHandle                     | Boolean                                                   | `false`                                                                                                        | If you're using the `SortableHandle` HOC, set this to `true`                                                                                                                                                                                                                                                                                                                                                                                                           |
| useWindowAsScrollContainer        | Boolean                                                   | `false`                                                                                                        | If you want, you can set the `window` as the scrolling container                                                                                                                                                                                                                                                                                                                                                                                                       |
| hideSortableGhost                 | Boolean                                                   | `true`                                                                                                         | Whether to auto-hide the ghost element. By default, as a convenience, React Sortable List will automatically hide the element that is currently being sorted. Set this to false if you would like to apply your own styling.                                                                                                                                                                                                                                           |
| lockToContainerEdges              | Boolean                                                   | `false`                                                                                                        | You can lock movement of the sortable element to it's parent `SortableContainer`                                                                                                                                                                                                                                                                                                                                                                                       |
| lockOffset                        | `OffsetValue`\* &#124; [`OffsetValue`\*, `OffsetValue`\*] | `"50%"`                                                                                                        | When`lockToContainerEdges`is set to`true`, this controls the offset distance between the sortable helper and the top/bottom edges of it's parent`SortableContainer`. Percentage values are relative to the height of the item currently being sorted. If you wish to specify different behaviours for locking to the _top_ of the container vs the _bottom_, you may also pass in an`array`(For example:`["0%", "100%"]`).                                             |
| getContainer                      | Function                                                  |                                                                                                                | Optional function to return the scrollable container element. This property defaults to the `SortableContainer` element itself or (if `useWindowAsScrollContainer` is true) the window. Use this function to specify a custom container object (eg this is useful for integrating with certain 3rd party components such as `FlexTable`). This function is passed a single parameter (the `wrappedInstance` React element) and it is expected to return a DOM element. |
| getHelperDimensions               | Function                                                  | [Function](https://github.com/clauderic/react-sortable-hoc/blob/master/src/SortableContainer/index.js#L74-L77) | Optional `function({node, index, collection})` that should return the computed dimensions of the SortableHelper. See [default implementation](https://github.com/clauderic/react-sortable-hoc/blob/master/src/SortableContainer/defaultGetHelperDimensions.js) for more details                                                                                                                                                                                                     |
| helperContainer                   | HTMLElement &#124; Function                               | `document.body`                                                                                                | By default, the cloned sortable helper is appended to the document body. Use this prop to specify a different container for the sortable clone to be appended to. Accepts an `HTMLElement` or a function returning an `HTMLElement` that will be invoked before right before sorting begins                                                                                                                                                                            |
| disableAutoscroll                 | Boolean                                                   | `false`                                                                                                        | Disables autoscrolling while dragging                                                                                                                                                                                                                                                                                                                                                                                                                                  |

\* `OffsetValue` can either be a finite `Number` or a `String` made up of a number and a unit (`px` or `%`).
Examples: `10` (which is the same as `"10px"`), `"50%"`

#### SortableElement HOC

| Property   | Type             | Default | Required? | Description                                                                                                                                                                                                                               |
| :--------- | :--------------- | :------ | :-------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| index      | Number           |         |     ✓     | This is the element's sortableIndex within it's collection. This prop is required.                                                                                                                                                        |
| collection | Number or String | `0`     |           | The collection the element is part of. This is useful if you have multiple groups of sortable elements within the same `SortableContainer`. [Example](http://clauderic.github.io/react-sortable-hoc/#/basic-configuration/multiple-lists) |
| disabled   | Boolean          | `false` |           | Whether the element should be sortable or not                                                                                                                                                                                             |

## FAQ

### Running Examples

In root folder, run the following commands to launch React Storybook:

```
$ npm install
$ npm start
```

### Accessibility

React Sortable HOC supports keyboard sorting out of the box. To enable it, make sure your `SortableElement` or `SortableHandle` is focusable. This can be done by setting `tabIndex={0}` on the outermost HTML node rendered by the component you're enhancing with `SortableElement` or `SortableHandle`.

Once an item is focused/tabbed to, pressing `SPACE` picks it up, `ArrowUp` or `ArrowLeft` moves it one place backward in the list, `ArrowDown` or `ArrowRight` moves items one place forward in the list, pressing `SPACE` again drops the item in its new position. Pressing `ESC` before the item is dropped will cancel the sort operations.

### Grid support

Need to sort items in a grid? We've got you covered! Just set the `axis` prop to `xy`. Grid support is currently limited to a setup where all the cells in the grid have the same width and height, though we're working hard to get variable width support in the near future.

### Item disappearing when sorting / CSS issues

Upon sorting, `react-sortable-hoc` creates a clone of the element you are sorting (the _sortable-helper_) and appends it to the end of the `<body>` tag. The original element will still be in-place to preserve its position in the DOM until the end of the drag (with inline-styling to make it invisible). If the _sortable-helper_ gets messed up from a CSS standpoint, consider that maybe your selectors to the draggable item are dependent on a parent element which isn't present anymore (again, since the _sortable-helper_ is at the end of the `<body>`). This can also be a `z-index` issue, for example, when using `react-sortable-hoc` within a Bootstrap modal, you'll need to increase the `z-index` of the SortableHelper so it is displayed on top of the modal (see [#87](https://github.com/clauderic/react-sortable-hoc/issues/87) for more details).

### Click events being swallowed

By default, `react-sortable-hoc` is triggered immediately on `mousedown`. If you'd like to prevent this behaviour, there are a number of strategies readily available. You can use the `distance` prop to set a minimum distance (in pixels) to be dragged before sorting is enabled. You can also use the `pressDelay` prop to add a delay before sorting is enabled. Alternatively, you can also use the [SortableHandle](https://github.com/clauderic/react-sortable-hoc/blob/master/src/SortableHandle/index.js) HOC.

### Wrapper props not passed down to wrapped Component

All props for `SortableContainer` and `SortableElement` listed above are intentionally consumed by the wrapper component and are **not** passed down to the wrapped component. To make them available pass down the desired prop again with a different name. E.g.:

```js
const SortableItem = SortableElement(({value, sortIndex}) => (
  <li>
    {value} - #{sortIndex}
  </li>
));

const SortableList = SortableContainer(({items}) => {
  return (
    <ul>
      {items.map((value, index) => (
        <SortableItem
          key={`item-${index}`}
          index={index}
          sortIndex={index}
          value={value}
        />
      ))}
    </ul>
  );
});
```

## Dependencies

React Sortable HOC only depends on [invariant](https://github.com/zertosh/invariant). It has the following peerDependencies: `react`, `react-dom`

## Reporting Issues

If believe you've found an issue, please [report it](https://github.com/clauderic/react-sortable-hoc/issues) along with any relevant details to reproduce it. The easiest way to do so is to fork the `react-sortable-hoc` basic setup sandbox on [CodeSandbox](https://codesandbox.io/s/o104x95y86):

[![Edit on CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/react-sortable-hoc-starter-o104x95y86)

## Asking for help

Please do not use the issue tracker for personal support requests. Instead, use [Gitter](https://gitter.im/clauderic/react-sortable-hoc) or StackOverflow.

## Contributions

Yes please! Feature requests / pull requests are welcome.

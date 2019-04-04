# React Sortable (HOC)
> A set of higher-order components to turn any list into an animated, touch-friendly, sortable list.

[![npm version](https://img.shields.io/npm/v/react-sortable-hoc.svg)](https://www.npmjs.com/package/react-sortable-hoc)
[![npm downloads](https://img.shields.io/npm/dm/react-sortable-hoc.svg)](https://www.npmjs.com/package/react-sortable-hoc)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg?maxAge=2592000)](https://github.com/clauderic/react-sortable-hoc/blob/master/LICENSE)
[![Gitter](https://badges.gitter.im/clauderic/react-sortable-hoc.svg)](https://gitter.im/clauderic/react-sortable-hoc)
![gzip size](http://img.badgesize.io/https://npmcdn.com/react-sortable-hoc/dist/umd/react-sortable-hoc.min.js?compression=gzip)

### Examples available here: <a href="#">http://clauderic.github.io/react-sortable-hoc/</a>

Features
---------------
* **Higher Order Components** – Integrates with your existing components
* **Drag handle, auto-scrolling, locked axis, events, and more!**
* **Suuuper smooth animations** – Chasing the 60FPS dream 🌈
* **Works with virtualization libraries: [react-virtualized](https://github.com/bvaughn/react-virtualized/), [react-tiny-virtual-list](https://github.com/clauderic/react-tiny-virtual-list), [react-infinite](https://github.com/seatgeek/react-infinite), etc.**
* **Horizontal lists, vertical lists, or a grid** ↔ ↕ ⤡
* **Touch support** 👌

Installation
------------

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
<script src="react-sortable-hoc/dist/umd/react-sortable-hoc.js"></script>
```

Usage
------------
### Basic Example

```js
import React, {Component} from 'react';
import {render} from 'react-dom';
import {SortableContainer, SortableElement, arrayMove} from 'react-sortable-hoc';

const SortableItem = SortableElement(({value}) =>
  <li>{value}</li>
);

const SortableList = SortableContainer(({items}) => {
  return (
    <ul>
      {items.map((value, index) => (
        <SortableItem key={`item-${index}`} index={index} value={value} />
      ))}
    </ul>
  );
});

class SortableComponent extends Component {
  state = {
    items: ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6'],
  };
  onSortEnd = ({oldIndex, newIndex}) => {
    this.setState({
      items: arrayMove(this.state.items, oldIndex, newIndex),
    });
  };
  render() {
    return <SortableList items={this.state.items} onSortEnd={this.onSortEnd} />;
  }
}

render(<SortableComponent/>, document.getElementById('root'));
```
That's it! React Sortable does not come with any styles by default, since it's meant to enhance your existing components.

More code examples are available [here](https://github.com/clauderic/react-sortable-hoc/blob/master/examples/).

Why should I use this?
--------------------
There are already a number of great Drag & Drop libraries out there (for instance, [react-dnd](https://github.com/gaearon/react-dnd/) is fantastic). If those libraries fit your needs, you should definitely give them a try first. However, most of those libraries rely on the HTML5 Drag & Drop API, which has some severe limitations. For instance, things rapidly become tricky if you need to support touch devices, if you need to lock dragging to an axis, or want to animate the nodes as they're being sorted. React Sortable HOC aims to provide a simple set of higher-order components to fill those gaps. If you're looking for a dead-simple, mobile-friendly way to add sortable functionality to your lists, then you're in the right place.

### Prop Types

#### SortableContainer HOC
| Property                   | Type              | Default                                                                                                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
|:---------------------------|:------------------|:-----------------------------------------------------------------------------------------------------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| axis                       | String            | `y`                                                                                                        | Items can be sorted horizontally, vertically or in a grid. Possible values: `x`, `y` or `xy`                                                                                                                                                                                                                                                                                                                                                                           |
| lockAxis                   | String            |                                                                                                            | If you'd like, you can lock movement to an axis while sorting. This is not something that is possible with HTML5 Drag & Drop. Possible values: `x` or `y`.                                                                                                                                                                                                                                                                                                                                           |
| helperClass                | String            |                                                                                                            | You can provide a class you'd like to add to the sortable helper to add some styles to it                                                                                                                                                                                                                                                                                                                                                                              |
| transitionDuration         | Number            | `300`                                                                                                      | The duration of the transition when elements shift positions. Set this to `0` if you'd like to disable transitions                                                                                                                                                                                                                                                                                                                                                     |
| pressDelay                 | Number            | `0`                                                                                                        | If you'd like elements to only become sortable after being pressed for a certain time, change this property. A good sensible default value for mobile is `200`. Cannot be used in conjunction with the `distance` prop.                                                                                                                                                                                                                                                |
| pressThreshold             | Number            | `5`                                                                                                        | Number of pixels of movement to tolerate before ignoring a press event.                                                                                                                                                                                                                                                                                                                                                                                                |
| distance                   | Number            | `0`                                                                                                        | If you'd like elements to only become sortable after being dragged a certain number of pixels. Cannot be used in conjunction with the `pressDelay` prop.                                                                                                                                                                                                                                                                                                               |
| shouldCancelStart          | Function          | [Function](https://github.com/clauderic/react-sortable-hoc/blob/master/src/SortableContainer/index.js#L48) | This function is invoked before sorting begins, and can be used to programatically cancel sorting before it begins. By default, it will cancel sorting if the event target is either an `input`, `textarea`, `select` or `option`.                                                                                                                                                                                                                                     |
| onSortStart                | Function          |                                                                                                            | Callback that is invoked when sorting begins. `function({node, index, collection}, event)`                                                                                                                                                                                                                                                                                                                                                                             |
| onSortMove                 | Function          |                                                                                                            | Callback that is invoked during sorting as the cursor moves. `function(event)`                                                                                                                                                                                                                                                                                                                                                                                         |
| onSortOver                 | Function          |                                                                                                            | Callback that is invoked when moving over an item. `function({index, oldIndex, newIndex, collection}, e)`                                                                                                                                                                                                                                                                                                                                                                  |
| onSortEnd                  | Function          |                                                                                                            | Callback that is invoked when sorting ends. `function({oldIndex, newIndex, collection}, e)`                                                                                                                                                                                                                                                                                                                                                                            |
| useDragHandle              | Boolean           | `false`                                                                                                    | If you're using the `SortableHandle` HOC, set this to `true`                                                                                                                                                                                                                                                                                                                                                                                                           |
| useWindowAsScrollContainer | Boolean           | `false`                                                                                                    | If you want, you can set the `window` as the scrolling container                                                                                                                                                                                                                                                                                                                                                                                                       |
| hideSortableGhost          | Boolean           | `true`                                                                                                     | Whether to auto-hide the ghost element. By default, as a convenience, React Sortable List will automatically hide the element that is currently being sorted. Set this to false if you would like to apply your own styling.                                                                                                                                                                                                                                           |
| lockToContainerEdges       | Boolean           | `false`                                                                                                    | You can lock movement of the sortable element to it's parent `SortableContainer`                                                                                                                                                                                                                                                                                                                                                                                       |
| lockOffset                 | `OffsetValue`\* \ | [`OffsetValue`\*, `OffsetValue`\*]                                                                         | `"50%"` | When `lockToContainerEdges` is set to `true`, this controls the offset distance between the sortable helper and the top/bottom edges of it's parent `SortableContainer`. Percentage values are relative to the height of the item currently being sorted. If you wish to specify different behaviours for locking to the *top* of the container vs the *bottom*, you may also pass in an `array` (For example: `["0%", "100%"]`).                            |
| getContainer               | Function          |                                                                                                            | Optional function to return the scrollable container element. This property defaults to the `SortableContainer` element itself or (if `useWindowAsScrollContainer` is true) the window. Use this function to specify a custom container object (eg this is useful for integrating with certain 3rd party components such as `FlexTable`). This function is passed a single parameter (the `wrappedInstance` React element) and it is expected to return a DOM element. |
| getHelperDimensions        | Function          | [Function](https://github.com/clauderic/react-sortable-hoc/blob/master/src/SortableContainer/index.js#L58) | Optional `function({node, index, collection})` that should return the computed dimensions of the SortableHelper. See [default implementation](https://github.com/clauderic/react-sortable-hoc/blob/master/src/SortableContainer/index.js#L58) for more details                                                                                                                                                                                                         |

\* `OffsetValue` can either be a finite `Number` or a `String` made up of a number and a unit (`px` or `%`).
Examples: `10` (which is the same as `"10px"`), `"50%"`

#### SortableElement HOC
| Property   | Type             | Default | Required? | Description                                                                                                                                                                                                                               |
|:-----------|:-----------------|:--------|:---------:|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| index      | Number           |         |     ✓     | This is the element's sortableIndex within it's collection. This prop is required.                                                                                                                                                        |
| collection | Number or String | `0`     |           | The collection the element is part of. This is useful if you have multiple groups of sortable elements within the same `SortableContainer`. [Example](http://clauderic.github.io/react-sortable-hoc/#/basic-configuration/multiple-lists) |
| disabled   | Boolean          | `false` |           | Whether the element should be sortable or not                                                                                                                                                                                             |

FAQ
---------------
### Running Examples

In root folder:

```
	$ npm install
	$ npm run storybook
```

### Grid support
Need to sort items in a grid? We've got you covered! Just set the `axis` prop to `xy`. Grid support is currently limited to a setup where all the cells in the grid have the same width and height, though we're working hard to get variable width support in the near future.

### Item disappearing when sorting / CSS issues
Upon sorting, `react-sortable-hoc` creates a clone of the element you are sorting (the _sortable-helper_) and appends it to the end of the `<body>` tag. The original element will still be in-place to preserve its position in the DOM until the end of the drag (with inline-styling to make it invisible). If the _sortable-helper_ gets messed up from a CSS standpoint, consider that maybe your selectors to the draggable item are dependent on a parent element which isn't present anymore (again, since the _sortable-helper_ is at the end of the `<body>`). This can also be a `z-index` issue, for example, when using `react-sortable-hoc` within a Bootstrap modal, you'll need to increase the `z-index` of the SortableHelper so it is displayed on top of the modal (see [#87](https://github.com/clauderic/react-sortable-hoc/issues/87) for more details).

### Click events being swallowed
By default, `react-sortable-hoc` is triggered immediately on `mousedown`. If you'd like to prevent this behaviour, there are a number of strategies readily available. You can use the `distance` prop to set a minimum distance (in pixels) to be dragged before sorting is enabled. You can also use the `pressDelay` prop to add a delay before sorting is enabled. Alternatively, you can also use the [SortableHandle](https://github.com/clauderic/react-sortable-hoc/blob/master/src/SortableHandle/index.js) HOC.

### Wrapper props not passed down to wrapped Component
All props for `SortableContainer` and `SortableElement` listed above are intentionally consumed by the wrapper component and are **not** passed down to the wrapped component. To make them available pass down the desired prop again with a different name. E.g.:

```js
const SortableItem = SortableElement(({value, sortIndex}) =>
  <li>{value} - #{sortIndex}</li>
);

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

Dependencies
------------
React Sortable HOC only depends on [invariant](https://github.com/zertosh/invariant). It has the following peerDependencies: `react`, `react-dom`

Reporting Issues
----------------
If believe you've found an issue, please [report it](https://github.com/clauderic/react-sortable-hoc/issues) along with any relevant details to reproduce it. The easiest way to do so is to fork this [jsfiddle](https://jsfiddle.net/clauderic/6r7r2cva/).

Asking for help
----------------
Please do not use the issue tracker for personal support requests. Instead, use [Gitter](https://gitter.im/clauderic/react-sortable-hoc) or StackOverflow.

Contributions
------------
Yes please! Feature requests / pull requests are welcome.

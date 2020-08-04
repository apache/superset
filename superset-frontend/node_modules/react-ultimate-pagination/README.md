[![ultimate-pagination logo](https://raw.githubusercontent.com/ultimate-pagination/logo/master/ultimate-pagination-250x250.png)](https://github.com/ultimate-pagination/react-ultimate-pagination)

# react-ultimate-pagination

[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url]

React.js pagination component based on ultimate-pagination. It's implemented as a hight-order component that allows easy integration of **react-ultimate-pagination** with different CSS frameworks or approaches.

To use **react-ultimate-pagination** in your project, you can write your theme or use one of already existing.

## Themes

Here is a list of themed versions of **react-ultimate-pagination** component. To use them you don't need explicitly install this module to your project; it will be installed automatically as a dependency of themed component.

- [Basic Theme](https://github.com/ultimate-pagination/react-ultimate-pagination-basic) ([Demo](http://codepen.io/dmytroyarmak/full/GZwKZJ))
- [Bootstrap 3 Theme](https://github.com/ultimate-pagination/react-ultimate-pagination-bootstrap-3) ([Demo](http://codepen.io/dmytroyarmak/full/YqBQYw/))
- [Bootstrap 4 Theme](https://github.com/ultimate-pagination/react-ultimate-pagination-bootstrap-4) ([Demo](http://codepen.io/dmytroyarmak/full/VagMQq/))
- [Material UI Theme](https://github.com/ultimate-pagination/react-ultimate-pagination-material-ui) ([Demo](http://ultimate-pagination.github.io/react-ultimate-pagination-examples/))

## Installation

You need to install this module only if you want to write your project or CSS framework specific theme.

You can install this module via npm:

```
npm install react-ultimate-pagination --save
```

## Usage

This module provides `createUltimatePagination(options)` method that is a React.js high-order component. It means that you need to call this component with specific `options` to create a React.js component.

The `options` object contains following properties:

- **itemTypeToComponent**: *object* - an object that is used as a map from the item type to the React.js component that will be used to render this item
- **WrapperComponent**: *React.Component* - a React.js component that will be used as a wrapper for pagination items (*optional*, *default*: `React.DOM.div`)

The `itemTypeToComponent` object should contains React.js component for each item type:

- `PAGE` - a link to a page
- `ELLIPSIS` - an item that represents groups of pages that currently are not visible in paginator (can be used to navigate to the page in the group that is the nearest to the current page)
- `FIRST_PAGE_LINK` - a link to the first page
- `PREVIOUS_PAGE_LINK` - a link to the previous page
- `NEXT_PAGE_LINK` - a link to the next page
- `LAST_PAGE_LINK` - a link to the last page

Each of this component receives as a `props` following data:
- **value**: *number* - number of pages that user should navigate to when item is activated (for items with type `PAGE` it also can be used as a label in UI)
- **isActive**: *boolean* - show if `currentPage` if the same as `value` of an item (can be used to highlight a current page or disable first, previous, next or last page links when user is already on first/last page)
- **isDisabled**: *boolean* - show if button should be disabled
- **onClick()**: function - should be called when user interacted with a component and the current page should be changed to the page represented by item (no arguments should be used, can be used for all item types)

Here is an example of basic usage:

```javascript
var React = require('react');
var ReactUltimatePagination = require('react-ultimate-pagination');

function Page(props) {
  return (
    <button
      style={props.isActive ? {fontWeight: 'bold'} : null}
      onClick={props.onClick}
      disabled={props.disabled}
    >{props.value}</button>
  );
}

function Ellipsis(props) {
  return <button onClick={props.onClick} disabled={props.disabled}>...</button>
}

function FirstPageLink(props) {
  return <button onClick={props.onClick} disabled={props.disabled}>First</button>
}

function PreviousPageLink(props) {
  return <button onClick={props.onClick} disabled={props.disabled}>Previous</button>
}

function NextPageLink(props) {
  return <button onClick={props.onClick} disabled={props.disabled}>Next</button>
}

function LastPageLink(props) {
  return <button onClick={props.onClick} disabled={props.disabled}>Last</button>
}

function Wrapper(props) {
  return <div className="pagination">{props.children}</div>
}

var itemTypeToComponent = {
  'PAGE': Page,
  'ELLIPSIS': Ellipsis,
  'FIRST_PAGE_LINK': FirstPageLink,
  'PREVIOUS_PAGE_LINK': PreviousPageLink,
  'NEXT_PAGE_LINK': NextPageLink,
  'LAST_PAGE_LINK': LastPageLink
};

var UltimatePagination = ReactUltimatePagination.createUltimatePagination({
  itemTypeToComponent: itemTypeToComponent,
  WrapperComponent: Wrapper
});
```

Created `UltimatePagination` component has the following interface:

- **currentPage**: *number* - current page number
- **totalPages**: *number* - total number of pages
- **boundaryPagesRange**: *number, optional, default: 1* - number of always visible pages at the beginning and end
- **siblingPagesRange**: *number, optional, default: 1* - number of always visible pages before and after the current one
- **hideEllipsis**: *bool, optional, default: false* - boolean flag to hide ellipsis
- **hidePreviousAndNextPageLinks**: *bool, optional, default: false* - boolean flag to hide previous and next page links
- **hideFirstAndLastPageLinks**: *bool, optional, default: false* - boolean flag to hide first and last page links
- **onChange**: *function* - callback that will be called with new page when it should be changed by user interaction (*optional*)
- **disabled**: *bool, optional, default: false* - boolean flag to disable all buttons in pagination

[downloads-image]: https://img.shields.io/npm/dm/react-ultimate-pagination.svg
[npm-url]: https://www.npmjs.com/package/react-ultimate-pagination
[npm-image]: https://img.shields.io/npm/v/react-ultimate-pagination.svg

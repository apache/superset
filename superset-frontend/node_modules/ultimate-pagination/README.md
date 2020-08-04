[![ultimate-pagination logo](https://raw.githubusercontent.com/ultimate-pagination/logo/master/ultimate-pagination-250x250.png)](https://github.com/ultimate-pagination/ultimate-pagination)

# ultimate-pagination

[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Build Status][travis-image]](travis-url)

Universal pagination model generation algorithm that can be used to build a UI component for any JavaScript based platform/framework. The idea behind this module is to move the logic of creating pagination out of the component and place it in a separate module. It allows reusing the same code across different frameworks like Angular, Angular2, React, Ember, etc. Also, the same code can be used to generate pagination on server-side JavaScript frameworks.

## Integrations

Here is a list of modules that uses **ultimate-pagination** to implement pagination components with different frameworks:

- [react-ultimate-pagination](https://github.com/ultimate-pagination/react-ultimate-pagination)
- [angular-ultimate-pagination](https://github.com/ultimate-pagination/angular-ultimate-pagination)
- [angular2-ultimate-pagination](https://github.com/ultimate-pagination/angular2-ultimate-pagination)
- [jquery-ultimate-pagination](https://github.com/ultimate-pagination/jquery-ultimate-pagination)
- [ember-ultimate-pagination](https://github.com/ultimate-pagination/ember-ultimate-pagination)
- [aurelia-ultimate-pagination](https://github.com/ultimate-pagination/aurelia-ultimate-pagination)
- [polymer-ultimate-pagination](https://github.com/ultimate-pagination/polymer-ultimate-pagination)

## Installation

You can install this module via npm:

```
npm install ultimate-pagination --save
```

## Usage

The main method of **ultimate-pagination** module is `getPaginationModel(options)`.
It accepts an object with properties:
- `currentPage` (number) - current page number
- `totalPages` (number) - total number of pages
- `boundaryPagesRange` (number, optional, default: 1) - number of always visible pages at the beginning and end
- `siblingPagesRange` (number, optional, default: 1) - number of always visible pages before and after the current one
- `hideEllipsis` (boolean, optional, default: false) - boolean flag to hide ellipsis
- `hidePreviousAndNextPageLinks` (boolean, optional, default: false) - boolean flag to hide previous and next page links
- `hideFirstAndLastPageLinks` (boolean, optional, default: false) - boolean flag to hide first and last page links

```javascript
var ultimatePagination = require('ultimate-pagination');

var paginationModel = ultimatePagination.getPaginationModel({
  // Required
  currentPage: 5,
  totalPages: 10,

  // Optional
  boundaryPagesRange: 1,
  siblingPagesRange: 1,
  hideEllipsis: false,
  hidePreviousAndNextPageLinks: false,
  hideFirstAndLastPageLinks: false
});
```

As a result `getPaginationModel(options)` returns an array of items that can be used to render a pagination component:

```
[
  {
    type: ITEM_TYPES.FIRST_PAGE_LINK,
    key: ITEM_KEYS.FIRST_PAGE_LINK,
    value: 1,
    isActive: false
  },
  {
    type: ITEM_TYPES.PREVIOUS_PAGE_LINK,
    key: ITEM_KEYS.PREVIOUS_PAGE_LINK,
    value: 4,
    isActive: false
  },
  {
    type: ITEM_TYPES.PAGE,
    key: 1,
    value: 1,
    isActive: false
  },
  {
    type: ITEM_TYPES.ELLIPSIS,
    key: ITEM_KEYS.FIRST_ELLIPSIS,
    value: 3,
    isActive: false
  },
  {
    type: ITEM_TYPES.PAGE,
    key: 4,
    value: 4,
    isActive: false
  },
  {
    type: ITEM_TYPES.PAGE,
    key: 5,
    value: 5,
    isActive: true
  },
  {
    type: ITEM_TYPES.PAGE,
    key: 6,
    value: 6,
    isActive: false
  },
  {
    type: ITEM_TYPES.ELLIPSIS,
    key: ITEM_KEYS.SECOND_ELLISPIS,
    value: 7,
    isActive: false
  },
  {
    type: ITEM_TYPES.PAGE,
    key: 10,
    value: 10,
    isActive: false
  },
  {
    type: ITEM_TYPES.NEXT_PAGE_LINK,
    key: ITEM_KEYS.NEXT_PAGE_LINK,
    value: 6,
    isActive: false
  },
  {
    type: ITEM_TYPES.LAST_PAGE_LINK,
    key: ITEM_KEYS.LAST_PAGE_LINK,
    value: 10,
    isActive: false
  }
]
```

In this example `ITEM_TYPES` and `ITEM_KEYS` can be imported from **ultimate-pagination** module, and they contain constants used in the output of the pagination model.

All item has the same structure:
- **type**: *string* - type of item that can be one of `ITEM_TYPES`
- **key**: *number* - unique number that can be used in libraries that need a key to render a collection of components (`key` in React, `track by` in Angular)
- **value**: *number* - number of pages that user should navigate to when item is activated (for items with type `PAGE` it also can be used as a label in UI)
- **isActive**: *boolean* - show if `currentPage` if the same as `value` of an item (can be used to highlight a current page or disable first, previous, next or last page links when user is already on first/last page)

Here is a list that contains all available `ITEM_TYPES`:
- `PAGE` - a link to a page
- `ELLIPSIS` - an item that represents groups of pages that currently are not visible in paginator (can be used to navigate to the page in the group that is the nearest to the current page)
- `FIRST_PAGE_LINK` - a link to the first page
- `PREVIOUS_PAGE_LINK` - a link to the previous page
- `NEXT_PAGE_LINK` - a link to the next page
- `LAST_PAGE_LINK` - a link to the last page

[downloads-image]: https://img.shields.io/npm/dm/ultimate-pagination.svg
[npm-url]: https://www.npmjs.com/package/ultimate-pagination
[npm-image]: https://img.shields.io/npm/v/ultimate-pagination.svg
[travis-image]: https://travis-ci.org/ultimate-pagination/ultimate-pagination.svg?branch=master
[travis-url]: https://travis-ci.org/ultimate-pagination/ultimate-pagination

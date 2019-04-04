# react-search-input
[![build status](https://img.shields.io/travis/enkidevs/react-search-input/master.svg?style=flat-square)](https://travis-ci.org/enkidevs/react-search-input)
[![npm version](https://img.shields.io/npm/v/react-search-input.svg?style=flat-square)](https://www.npmjs.com/package/react-search-input)
[![Dependency Status](https://david-dm.org/enkidevs/react-search-input.svg)](https://david-dm.org/enkidevs/react-search-input)
[![devDependency Status](https://david-dm.org/enkidevs/react-search-input/dev-status.svg)](https://david-dm.org/enkidevs/react-search-input#info=devDependencies)

> Simple [React](http://facebook.github.io/react/index.html) component for a search input, providing a filter function.

### [Demo](https://enkidevs.github.io/react-search-input)

## Install

```bash
npm install react-search-input --save
```

## Example

```javascript
import React, {Component} from 'react'
import SearchInput, {createFilter} from 'react-search-input'

import emails from './mails'

const KEYS_TO_FILTERS = ['user.name', 'subject', 'dest.name']

class App extends Component {
  constructor (props) {
    super(props)
    this.state = {
      searchTerm: ''
    }
    this.searchUpdated = this.searchUpdated.bind(this)
  }

  render () {
    const filteredEmails = emails.filter(createFilter(this.state.searchTerm, KEYS_TO_FILTERS))

    return (
      <div>
        <SearchInput className="search-input" onChange={this.searchUpdated} />
        {filteredEmails.map(email => {
          return (
            <div className="mail" key={email.id}>
              <div className="from">{email.user.name}</div>
              <div className="subject">{email.subject}</div>
            </div>
          )
        })}
      </div>
    )
  }

  searchUpdated (term) {
    this.setState({searchTerm: term})
  }
}

```

## API

### Props

All props are optional. All other props will be passed to the DOM input.

##### className

Class of the Component (in addition of `search-input`).

##### onChange

Function called when the search term is changed (will be passed as an argument).

##### filterKeys

Either an `[String]` or a `String`. Will be use by the `filter` method if no argument is passed there.

##### throttle

Reduce call frequency to the `onChange` function (in ms). Default is `200`.

##### caseSensitive

Define if the search should be case sensitive. Default is `false`

##### fuzzy

Define if the search should be fuzzy. Default is `false`

##### sortResults

Define if search results should be sorted by relevance (only works with fuzzy search). Default is `false`

##### value

Define the value of the input.

### Methods

##### filter([keys])

Return a function which can be used to filter an array. `keys` can be `String`, `[String]` or `null`.

If an array `keys` is an array, the function will return true if at least one of the keys of the item matches the search term.

### Static Methods

##### filter(searchTerm, [keys], [{caseSensitive, fuzzy, sortResults}])

Return a function which can be used to filter an array. `searchTerm` can be a `regex` or a `String`. `keys` can be `String`, `[String]` or `null`.

If an array `keys` is an array, the function will return true if at least one of the keys of the item matches the search term.

## Styles

Look at [react-search-input.css](react-search-input.css) for an idea on how to style this component.

---

MIT Licensed

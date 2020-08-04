# emotion-theming

> A CSS-in-JS theming solution for React

_`emotion-theming` is a theming library inspired by [styled-components](https://github.com/styled-components/styled-components)_

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
  - [ThemeProvider](#themeprovider-reactcomponenttype)
  - [withTheme](#withthemecomponent-reactcomponenttype-reactcomponenttype)
  - [useTheme](#usetheme)
- [Credits](#credits)
- [License](#license)

## Install

```bash
# add --save if using npm@4 or lower
npm i emotion-theming

# or
yarn add emotion-theming
```

## Usage

Theming is accomplished by placing the `ThemeProvider` component, at the top of the React component tree and wrapping descendants with the `withTheme` higher-order component. This HOC gets the current theme and injects it as a "prop" into your own component.

The theme prop is automatically injected into components created with `styled`. The theme can also be accessed via passing a function to the css prop.

```jsx
// Page.js
import * as React from 'react'
/** @jsx jsx */
import { jsx } from '@emotion/core'
import styled from '@emotion/styled'

const Container = styled.div({
  background: 'whitesmoke',
  height: '100vh'
})

const Headline = styled.h1`
  color: ${props => props.theme.color};
  font-family: sans-serif;
`

export default class Page extends React.Component {
  render() {
    return (
      <Container>
        <Headline>I'm red!</Headline>
        <p css={theme => ({ color: theme.color })}>I'm also red!</p>
      </Container>
    )
  }
}

// App.js
import React from 'react'
import ReactDOM from 'react-dom'
import { ThemeProvider } from 'emotion-theming'

import Page from './Page.js'

const theme = {
  color: 'red'
}

class App extends React.Component {
  render() {
    return (
      <ThemeProvider theme={theme}>
        <Page />
      </ThemeProvider>
    )
  }
}
```

## API

### ThemeProvider: React.ComponentType

A React component that passes the theme object down the component tree via [context](https://reactjs.org/docs/context.html). Additional `ThemeProvider` components can be added deeper in the tree to override the original theme. The theme object will be merged into its ancestor as if by [`Object.assign`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign). If a function is passed instead of an object it will be called with the ancestor theme and the result will be the new theme.

_Accepts:_

- **`children`: React.Node**
- **`theme`: Object|Object => Object** - An object or function that provides an object.

```jsx
import React from 'react'
import styled from '@emotion/styled'
import { ThemeProvider, withTheme } from 'emotion-theming'

// object-style theme

const theme = {
  backgroundColor: 'green',
  color: 'red'
}

// function-style theme; note that if multiple <ThemeProvider> are used,
// the parent theme will be passed as a function argument

const adjustedTheme = ancestorTheme => ({ ...ancestorTheme, color: 'blue' })

class Container extends React.Component {
  render() {
    return (
      <ThemeProvider theme={theme}>
        <ThemeProvider theme={adjustedTheme}>
          <Text>Boom shaka laka!</Text>
        </ThemeProvider>
      </ThemeProvider>
    )
  }
}
```

> Note:
>
> Make sure to hoist your theme out of render otherwise you may have performance problems.

### withTheme(component: React.ComponentType): React.ComponentType

A higher-order component that provides the current theme as a prop to the wrapped child and listens for changes. If the theme is updated, the child component will be re-rendered accordingly.

```jsx
import PropTypes from 'prop-types'
import React from 'react'
import { withTheme } from 'emotion-theming'

class TellMeTheColor extends React.Component {
  render() {
    return <div>The color is {this.props.theme.color}.</div>
  }
}

TellMeTheColor.propTypes = {
  theme: PropTypes.shape({
    color: PropTypes.string
  })
}

const TellMeTheColorWithTheme = withTheme(TellMeTheColor)
```

### useTheme

A React hook that provides the current theme as its value. If the theme is updated, the child component will be re-rendered accordingly.

```jsx
// @live
/** @jsx jsx */
import { jsx } from '@emotion/core'
import styled from '@emotion/styled'
import { ThemeProvider, useTheme } from 'emotion-theming'

const theme = {
  colors: {
    primary: 'hotpink'
  }
}

function SomeText (props) {
  const theme = useTheme()
  return (
    <div
      css={{ color: theme.colors.primary }}
      {...props}
    />
  )
}

render(
  <ThemeProvider theme={theme}>
    <SomeText>some text</SomeText>
  </ThemeProvider>
)
```

## Credits

Thanks goes to the [styled-components team](https://github.com/styled-components/styled-components) and [their contributors](https://github.com/styled-components/styled-components/graphs/contributors) who designed this API.

## License

MIT 2017-present

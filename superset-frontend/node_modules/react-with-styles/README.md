# react-with-styles <sup>[![Version Badge][npm-version-svg]][package-url]</sup>

[![Build Status][travis-svg]][travis-url]
[![dependency status][deps-svg]][deps-url]
[![dev dependency status][dev-deps-svg]][dev-deps-url]
[![License][license-image]][license-url]
[![Downloads][downloads-image]][downloads-url]

[![npm badge][npm-badge-png]][package-url]

Use CSS-in-JavaScript for your React components without being tightly coupled to one implementation (e.g. [Aphrodite][aphrodite], [Radium][radium], or [React Native][react-native]). Easily access shared theme information (e.g. colors, fonts) when defining your styles.

## Interfaces

- [Aphrodite][interface-aphrodite]
- [JSS][interface-jss]
- [React Native][interface-react-native]

[interface-aphrodite]: https://github.com/airbnb/react-with-styles-interface-aphrodite
[interface-jss]: https://github.com/oliviertassinari/react-with-styles-interface-jss
[interface-react-native]: https://github.com/airbnb/react-with-styles-interface-react-native

## Other resources

- [eslint-plugin-react-with-styles][eslint-plugin-react-with-styles]: ESLint plugin for react-with-styles.

[eslint-plugin-react-with-styles]: https://github.com/airbnb/eslint-plugin-react-with-styles

## How to use

Create a module that exports an object with shared theme information like colors.

```js
export default {
  color: {
    primary: '#FF5A5F',
    secondary: '#00A699',
  },
};
```

Register your default theme and interface. For example, if your default theme is exported by `MyDefaultTheme.js`, and you want to use Aphrodite, you can set this up in your own `withStyles.js` file.

```js
import ThemedStyleSheet from 'react-with-styles/lib/ThemedStyleSheet';
import aphroditeInterface from 'react-with-styles-interface-aphrodite';
import { css, withStyles, ThemeProvider } from 'react-with-styles';

import MyDefaultTheme from './MyDefaultTheme';

ThemedStyleSheet.registerDefaultTheme(MyDefaultTheme);
ThemedStyleSheet.registerInterface(aphroditeInterface);

export { css, withStyles, ThemeProvider, ThemedStyleSheet };
```

It is convenient to pass through `css`, `withStyles`, and `ThemeProvider` from `react-with-styles` here so that everywhere you use them you can be assured that the default theme and interface have been registered. You could likely also set this up as an initializer that is added to the top of your bundles and then use `react-with-styles` directly in your components.

In your component, from our `withStyles.js` file above, use `withStyles()` to define styles and `css()` to consume them.

```jsx
import React from 'react';
import PropTypes from 'prop-types';
import { css, withStyles } from './withStyles';

function MyComponent({ styles }) {
  return (
    <div>
      <a
        href="/somewhere"
        {...css(styles.firstLink)}
      >
        A link to somewhere
      </a>

      {' '}
      and
      {' '}

      <a
        href="/somewhere-else"
        {...css(styles.secondLink)}
      >
        a link to somewhere else
      </a>
    </div>
  );
}

MyComponent.propTypes = {
  styles: PropTypes.object.isRequired,
};

export default withStyles(({ color }) => ({
  firstLink: {
    color: color.primary,
  },

  secondLink: {
    color: color.secondary,
  },
}))(MyComponent);
```

## `ThemedStyleSheet`

Registers themes and interfaces.

### `ThemedStyleSheet.registerDefaultTheme(theme)`

Registers the default theme. `theme` is an object with properties that you want to be made available when styling your components.

```js
import ThemedStyleSheet from 'react-with-styles/lib/ThemedStyleSheet';

ThemedStyleSheet.registerDefaultTheme({
  color: {
    primary: '#FF5A5F',
    secondary: '#00A699',
  },
});
```

### `ThemedStyleSheet.registerTheme(name, overrides)`

Registers a named theme that defines overrides for the default theme. This object is merged with the default theme.

```js
import ThemedStyleSheet from 'react-with-styles/lib/ThemedStyleSheet';

ThemedStyleSheet.registerTheme('tropical', {
  color: {
    primary: 'yellow',
  },
});
```

Combined with the above example for default theme, `color.primary` would be `'yellow'` and `color.secondary` would be `'#00A699'`.

### `ThemedStyleSheet.registerInterface(interface)`

Instructs react-with-styles how to process your styles.

```js
import ThemedStyleSheet from 'react-with-styles/lib/ThemedStyleSheet';
import aphroditeInterface from 'react-with-styles-interface-aphrodite';

ThemedStyleSheet.registerInterface(aphroditeInterface);
```


## `<ThemeProvider name="theme name">`

This component simply takes a `name` prop that matches a registered theme, and stores that value in context. This allows sub-trees of your application to change to different themes as necessary.

```jsx
import React from 'react';
import { ThemeProvider } from './withStyles';

export default function App() {
  return (
    <div>
      <MyComponent />

      <ThemeProvider name="tropical">
        <MyComponent />
      </ThemeProvider>
    </div>
  );
}
```


## `withStyles([ stylesThunk [, options ] ])`

This is a higher-order function that returns a higher-order component used to wrap React components to add styles using the theme provided from context. We use this to abstract away the context, to make themed styles easier to work with.

`stylesThunk` will receive the theme as an argument, and it should return an object containing the styles for the component.

The wrapped component will receive a `styles` prop containing the processed styles for this component and a `theme` prop with the current theme object. Most of the time you will only need the `styles` prop. Reliance on the `theme` prop should be minimized.

### Example usage

```jsx
import React from 'react';
import { css, withStyles } from './withStyles';

function MyComponent({ styles }) {
  return (
    <div {...css(styles.container)}>
      Try to be a rainbow in someone's cloud.
    </div>
  );
}

export default withStyles(({ color, unit }) => ({
  container: {
    color: color.primary,
    marginBottom: 2 * unit,
  },
}))(MyComponent);
```

Or, as a decorator:

```jsx
import React from 'react';
import { css, withStyles } from './withStyles';

@withStyles(({ color, unit }) => ({
  container: {
    color: color.primary,
    marginBottom: 2 * unit,
  },
}))
export default function MyComponent({ styles }) {
  return (
    <div {...css(styles.container)}>
      Try to be a rainbow in someone's cloud.
    </div>
  );
}
```

### Options

#### `pureComponent` (default: `false`, React 15.3.0+)

By default `withStyles()` will create a component that extends `React.Component`. If you want to apply the `shouldComponentUpdate()` optimization offered by `React.PureComponent`, you can set the `pureComponent` option to `true`. Note that [`React.PureComponent` was introduced in React 15.3.0](https://github.com/facebook/react/blob/master/CHANGELOG.md#1530-july-29-2016), so this will only work if you are using that version or later.

#### `stylesPropName` (default: `'styles'`)

By default, `withStyles()` will pass down the styles to the wrapped component in the `styles` prop, but the name of this prop can be customized by setting the `stylesPropName` option. This is useful if you already have a prop called `styles` and aren't able to change it.

```jsx
import React from 'react';
import { css, withStyles } from './withStyles';

function MyComponent({ withStylesStyles }) {
  return (
    <div {...css(withStylesStyles.container)}>
      Try to be a rainbow in someone's cloud.
    </div>
  );
}

export default withStyles(({ color, unit }) => ({
  container: {
    color: color.primary,
    marginBottom: 2 * unit,
  },
}), { stylesPropName: 'withStylesStyles' })(MyComponent);
```

#### `themePropName` (default `'theme'`)

Likewise, the theme prop name can also be customized by setting the `themePropName` option.

```jsx
import React from 'react';
import { css, withStyles } from './withStyles';

function MyComponent({ styles, withStylesTheme }) {
  return (
    <div {...css(styles.container)}>
      <Background color={withStylesTheme.color.primary}>
        Try to be a rainbow in someone's cloud.
      </Background>
    </div>
  );
}

export default withStyles(({ color, unit }) => ({
  container: {
    color: color.primary,
    marginBottom: 2 * unit,
  },
}), { themePropName: 'withStylesTheme' })(MyComponent);
```

#### `flushBefore` (default: `false`)

Some components depend on previous styles to be ready in the component tree when mounting (e.g. dimension calculations). Some interfaces add styles to the page asynchronously, which is an obstacle for this. So, we provide the option of flushing the buffered styles before the rendering cycle begins. It is up to the interface to define what this means.


## `css(...styles)`

This function takes styles that were processed by `withStyles()`, plain objects, or arrays of these things. It returns an object with an opaque structure that must be spread into a JSX element.

```jsx
import React from 'react';
import { css, withStyles } from './withStyles';

function MyComponent({ bold, padding, styles }) {
  return (
    <div {...css(styles.container, { padding })}>
      Try to be a rainbow in{' '}
      <a
        href="/somewhere"
        {...css(styles.link, bold && styles.link_bold)}
      >
        someone's cloud
      </a>
    </div>
  );
}

export default withStyles(({ color, unit }) => ({
  container: {
    color: color.primary,
    marginBottom: 2 * unit,
  },

  link: {
    color: color.secondary,
  },

  link_bold: {
    fontWeight: 700,
  },
}))(MyComponent);
```

`className` and `style` props must not be used on the same elements as `css()`.

## Examples
### With React Router's `Link`
[React Router][react-router]'s [`<Link/>`][react-router-link] and [`<IndexLink/>`][react-router-index-link] components accept `activeClassName='...'` and `activeStyle={{...}}` as props. As previously stated, `css(...styles)` must spread to JSX, so simply passing `styles.thing` or even `css(styles.thing)` directly will not work. In order to mimic `activeClassName`/`activeStyles` you can use React Router's [`withRouter()`][react-router-with-router] Higher Order Component to pass `router` as prop to your component and toggle styles based on [`router.isActive(pathOrLoc, indexOnly)`](react-router-is-active). This works because `<Link />` passes down the generated `className` from `css(..styles)` down through to the final leaf.

```jsx
import React from 'react';
import { withRouter, Link } from 'react-router';
import { css, withStyles } from '../withStyles';

function Nav({ router, styles }) {
  return (
    <div {...css(styles.container)}>
      <Link
        to="/"
        {...css(styles.link, router.isActive('/', true) && styles.link_bold)}
      >
        home
      </Link>
      <Link
        to="/somewhere"
        {...css(styles.link, router.isActive('/somewhere', true) && styles.link_bold)}
      >
        somewhere
      </Link>
    </div>
  );
}

export default withRouter(withStyles(({ color, unit }) => ({
  container: {
    color: color.primary,
    marginBottom: 2 * unit,
  },

  link: {
    color: color.primary,
  },

  link_bold: {
    fontWeight: 700,
  }
}))(Nav));
```

## In the wild

[Organizations and projects using `react-with-styles`](INTHEWILD.md).

[package-url]: https://npmjs.org/package/react-with-styles
[npm-version-svg]: http://versionbadg.es/airbnb/react-with-styles.svg
[travis-svg]: https://travis-ci.org/airbnb/react-with-styles.svg
[travis-url]: https://travis-ci.org/airbnb/react-with-styles
[deps-svg]: https://david-dm.org/airbnb/react-with-styles.svg
[deps-url]: https://david-dm.org/airbnb/react-with-styles
[dev-deps-svg]: https://david-dm.org/airbnb/react-with-styles/dev-status.svg
[dev-deps-url]: https://david-dm.org/airbnb/react-with-styles#info=devDependencies
[npm-badge-png]: https://nodei.co/npm/react-with-styles.png?downloads=true&stars=true
[license-image]: http://img.shields.io/npm/l/react-with-styles.svg
[license-url]: LICENSE
[downloads-image]: http://img.shields.io/npm/dm/react-with-styles.svg
[downloads-url]: http://npm-stat.com/charts.html?package=react-with-styles

[aphrodite]: https://github.com/khan/aphrodite
[radium]: https://formidable.com/open-source/radium/
[react-native]: https://facebook.github.io/react-native/
[react-router]: https://github.com/reactjs/react-router
[react-router-link]: https://github.com/reactjs/react-router/blob/master/docs/API.md#link
[react-router-index-link]: https://github.com/reactjs/react-router/blob/master/docs/API.md#indexlink
[react-router-with-router]: https://github.com/reactjs/react-router/blob/master/docs/API.md#withroutercomponent-options
[react-router-is-active]: https://github.com/reactjs/react-router/blob/master/docs/API.md#isactivepathorloc-indexonly

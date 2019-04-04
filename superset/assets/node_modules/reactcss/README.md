# [ReactCSS](http://reactcss.com/)

[![Build Status][travis-svg]][travis-url]
[![dependency status][deps-svg]][deps-url]
[![dev dependency status][dev-deps-svg]][dev-deps-url]
[![License][license-image]][license-url]
[![Downloads][downloads-image]][downloads-url]

## Inline Styles in JS with support for [React](http://reactcss.com/#react), [React Native](http://reactcss.com/#react-native), [Autoprefixing](http://reactcss.com/#autoprefixing), [Hover](http://reactcss.com/#hover), [Pseudo-Elements](http://reactcss.com/#pseudo-elements) & [Media Queries](http://reactcss.com/#media-queries)

## Install

```
npm install reactcss --save
```

## Style Object

Define a default styles for your elements:
```javascript
import reactCSS from 'reactcss'

const styles = reactCSS({
  'default': {
    card: {
      background: this.props.background,
      boxShadow: '0 2px 4px rgba(0,0,0,.15)',
    },
  },
})
```

Pass style definitions via inline styles:
```javascript
<div style={ styles.card } />
```

## Activating Classes

Activate additional classes by passing down objects as additional parameters to `reactCSS`:
```javascript
const styles = reactCSS({
  'default': {
    card: {
      background: '#fff',
      boxShadow: '0 2px 4px rgba(0,0,0,.15)',
    },
  },
  'zIndex-2': {
    card: {
      boxShadow: '0 4px 8px rgba(0,0,0,.15)',
    },
  },
}, {
  'zIndex-2': props.zIndex === 2,
})
```

## Documentation
See the [Full Documentation](http://reactcss.com)

## Examples

Examples and projects built with reactCSS:

[Felony](https://github.com/henryboldi/felony) - Next Level PGP Desktop App
[React Color](https://github.com/casesandberg/react-color) - Color Pickers from Sketch, Photoshop, Chrome, Github, Twitter & more
[Buffer App Components](https://www.npmjs.com/package/@bufferapp/components) - A shared set of UI Components
[React Reactions](https://github.com/casesandberg/react-reactions) - Use Reactions from Slack, Facebook, Pokemon, Github and Youtube


[travis-svg]: https://travis-ci.org/casesandberg/reactcss.svg
[travis-url]: https://travis-ci.org/casesandberg/reactcss
[deps-svg]: https://david-dm.org/casesandberg/reactcss.svg
[deps-url]: https://david-dm.org/casesandberg/reactcss
[dev-deps-svg]: https://david-dm.org/casesandberg/reactcss/dev-status.svg
[dev-deps-url]: https://david-dm.org/casesandberg/reactcss#info=devDependencies
[npm-badge-png]: https://nodei.co/npm/reactcss.png?downloads=true&stars=true
[license-image]: http://img.shields.io/npm/l/reactcss.svg
[license-url]: LICENSE
[downloads-image]: http://img.shields.io/npm/dm/reactcss.svg
[downloads-url]: http://npm-stat.com/charts.html?package=reactcss

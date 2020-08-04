[![Bower version](https://img.shields.io/bower/v/material-colors.svg)](https://github.com/shuhei/material-colors)
[![NPM version](https://img.shields.io/npm/v/material-colors.svg)](https://www.npmjs.com/package/material-colors)
[![NPM downloads](https://img.shields.io/npm/dm/material-colors.svg)](https://www.npmjs.com/package/material-colors)
[![CircleCI](https://circleci.com/gh/shuhei/material-colors.svg?style=shield)](https://circleci.com/gh/shuhei/material-colors)

# Material Colors

Colors from [Google's Material Design](http://www.google.com/design/spec/style/color.html) made available to coders.

The colors are scraped from the guide. The idea to publish colors in multiple forms is stolen from [mrmrs/colors](https://github.com/mrmrs/colors).

## Available Forms

- CSS: Classes for prototyping such as `.color-red-100`, `.bg-red-100`, `.border-red-100`, `.fill-red-100` and `.stroke-red-100`.
- CSS variables such as `--md-red-100`.
- Sass, Scss: Color variables such as `$md-red-100`.
- Less: Color variables such as `@md-red-100`.
- Stylus: Color variables such as `md-red-100`.
- JSON: Raw data of colors. Key names are hypenated. e.g. `deep-purple`
- JavaScript: Color set object provided via AMD, CommonJS or global variable `materialColor`. Key names are camelCase. e.g. `deepPurple`
- EcmaScript module: Color variables are exported as camelCase names.

See [dist directory](dist) or [demo](http://shuheikagawa.com/material-colors/) for more details.

## Usage

### Download

Download what you like from [dist directory](dist) and use it.

### Bower

```
bower install material-colors
```

and use what you like in `bower_components/material-colors/dist`.

### NPM

```
npm install material-colors
```

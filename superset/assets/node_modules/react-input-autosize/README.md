React-Input-Autosize
====================

A text input for [React](http://facebook.github.io/react/index.html) that resizes itself to the current content.


## Demo & Examples

Live demo: [jedwatson.github.io/react-input-autosize](http://jedwatson.github.io/react-input-autosize/)

To run the examples locally, run:

```
npm install
npm start
```

Then open [localhost:8000](http://localhost:8000) in a browser.


## Installation

The easiest way to use React-Input-Autosize is to install it from NPM and include it in your own React build process (using Browserify, rollup, webpack, etc).

You can also use the umd build by including `dist/AutosizeInput.js` in your page. If you use this, make sure you have already included a umd React build.

```
npm install react-input-autosize --save
```


## Usage

React-Input-Autosize generates an input field, wrapped in a `<div>` tag so it can detect the size of its value. Otherwise it behaves very similarly to a standard React input.


```es6
import AutosizeInput from 'react-input-autosize';

<AutosizeInput
	name="form-field-name"
	value={inputValue}
	onChange={function(event) {
		// event.target.value contains the new value
	}}
/>
```

## Gotchas

### Changing the styles at runtime
The styles applied to the input are only copied when the component mounts. Because of this, subsequent changes to the stylesheet may cause size to be detected incorrectly.

To work around this, either re-mount the input (e.g. by providing a different `key` prop) or call the `copyInputStyles()` method after the styles change.

### CSP and the IE "clear" indicator
The input will automatically inject a stylesheet that hides IE/Edge's "clear" indicator, which otherwise breaks the UI. This has the downside of being incompatible with some CSP policies.

To work around this, you can pass the `injectStyles={false}` prop, but if you do this I *strongly* recommend targeting the `input` element in your own stylesheet with the following rule:

```css
input::-ms-clear {display: none;}
```

### Custom font sizes
If your input uses custom font sizes, you will need to provide the custom size to `AutosizeInput`.

```es6
<AutosizeInput
	name="form-field-name"
	value={inputValue}
	style={{ fontSize: 36 }}
	onChange={function(event) {
		// event.target.value contains the new value
	}}
/>
```

### Uncontrolled input
`AutosizeInput` is a [controlled input](https://facebook.github.io/react/docs/forms.html#controlled-components) and depends on the `value` prop to work as intended. It does not support being used as an uncontrolled input.

## License

Copyright (c) 2018 Jed Watson. [MIT](LICENSE) License.

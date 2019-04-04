bootstrap-slider [![Build Status](https://travis-ci.org/seiyria/bootstrap-slider.png?branch=master)](https://travis-ci.org/seiyria/bootstrap-slider) [![Code Climate](https://codeclimate.com/github/seiyria/bootstrap-slider/badges/gpa.svg)](https://codeclimate.com/github/seiyria/bootstrap-slider)
================
Originally began as a loose "fork" of bootstrap-slider found on http://www.eyecon.ro/ by Stefan Petre.

Over time, this project has diverged sigfinicantly from Stefan Petre's version and is now almost completely different.

__Please ensure that you are using this library instead of the Petre version before creating issues in the repository issue tracker!!__

Installation
============
Want to use bower? `bower install seiyria-bootstrap-slider`

Want to use npm? `npm install bootstrap-slider`

Want to get it from a CDN? https://cdnjs.com/libraries/bootstrap-slider

Basic Setup
============
Grab the compiled JS/CSS (minified or non-minified versions) from the [/dist](https://github.com/seiyria/bootstrap-slider/tree/master/dist) directory, load them into your web page, and everything should work!

Remember to load the plugin code after loading the Bootstrap CSS and JQuery.

__JQuery is optional and the plugin can operate with or without it.__

Look below to see an example of how to interact with the non-JQuery interface.

Supported Browsers
========
__We only support modern browsers!!! Basically, anything below IE9 is not compatible with this plugin!__

Examples
========
You can see all of our API examples [here](http://seiyria.github.io/bootstrap-slider/).

Using bootstrap-slider (with JQuery)
======================

### Using `.slider` namespace
Create an input element and call .slider() on it:

```js
// Instantiate a slider
var mySlider = $("input.slider").slider();

// Call a method on the slider
var value = mySlider.slider('getValue');

// For non-getter methods, you can chain together commands
	mySlider
		.slider('setValue', 5)
		.slider('setValue', 7);
```

### Using `.bootstrapSlider` namespace
Create an input element and call .bootstrapSlider() on it:

```js
// Instantiate a slider
var mySlider = $("input.slider").bootstrapSlider();

// Call a method on the slider
var value = mySlider.bootstrapSlider('getValue');

// For non-getter methods, you can chain together commands
	mySlider
		.bootstrapSlider('setValue', 5)
		.bootstrapSlider('setValue', 7);
```

Using bootstrap-slider (via `data-provide`-API)
======================

Create an input element with the `data-provide="slider"` attribute automatically
turns it into a slider. Options can be supplied via `data-slider-` attributes.

```html
<input
	type="text"
	name="somename"
	data-provide="slider"
	data-slider-ticks="[1, 2, 3]"
	data-slider-ticks-labels='["short", "medium", "long"]'
	data-slider-min="1"
	data-slider-max="3"
	data-slider-step="1"
	data-slider-value="3"
	data-slider-tooltip="hide"
>
```

What if there is already a _slider_ plugin bound to the JQuery namespace?
======================

If there is already a JQuery plugin named _slider_ bound to the JQuery namespace, then this plugin will emit a console warning telling you this namespace has already been taken and will encourage you to use the alternate namespace _bootstrapSlider_ instead.

```js
// Instantiate a slider
var mySlider = $("input.slider").bootstrapSlider();

// Call a method on the slider
var value = mySlider.bootstrapSlider('getValue');

// For non-getter methods, you can chain together commands
	mySlider
		.bootstrapSlider('setValue', 5)
		.bootstrapSlider('setValue', 7);
```

Using bootstrap-slider (without JQuery)
======================

Create an input element in the DOM, and then create an instance of Slider, passing it a selector string referencing the input element.

```js
// Instantiate a slider
var mySlider = new Slider("input.slider", {
	// initial options object
});

// Call a method on the slider
var value = mySlider.getValue();

// For non-getter methods, you can chain together commands
mySlider
	.setValue(5)
	.setValue(7);
```

Using as CommonJS module
=======
bootstrap-slider can be loaded as a CommonJS module via [Browserify](https://github.com/substack/node-browserify), [Webpack](https://github.com/webpack/webpack), or some other build tool.

```js
var Slider = require("bootstrap-slider");

var mySlider = new Slider();
```

How do I exclude the optional JQuery dependency from my build?
=======
### Browserify
__Note that the JQuery dependency is considered to be optional.__ For example, to exclude JQuery from being part of your Browserify build, you would call something like the following (assuming `main.js` is requiring bootstrap-slider as a dependency):

```BASH
browserify --im -u jquery main.js > bundle.js
```
### Webpack
To exclude JQuery from your Webpack build, you will have to go into the Webpack config file for your specific project and add something like the following to your `resolve.alias` section:

```js
resolve: {
    alias: {
         "jquery": path.join(__dirname, "./jquery-stub.js");
    }
}
```

Then in your project, you will have to create a stub module for jquery that exports a `null` value. Whenever `require("jquery")` is mentioned in your project, it will load this stubbed module.

```js
// Path: ./jquery-stub.js
module.exports = null;
```

### Other
Please see the documentation for the specific module loader you are using to find out how to exclude dependencies.

Options
=======
Options can be passed either as a data (data-slider-foo) attribute, or as part of an object in the slider call. The only exception here is the formatter argument - that can not be passed as a data- attribute.


| Name | Type |	Default |	Description |
| ---- |:----:|:-------:|:----------- |
| id | string | '' | set the id of the slider element when it's created |
| min |	float	| 0 |	minimum possible value |
| max |	float |	10 |	maximum possible value |
| step | float |	1 |	increment step |
| precision | float |	number of digits after the decimal of _step_ value |	The number of digits shown after the decimal. Defaults to the number of digits after the decimal of _step_ value. |
| orientation |	string | 'horizontal' |	set the orientation. Accepts 'vertical' or 'horizontal' |
| value |	float,array |	5	| initial value. Use array to have a range slider. |
| range |	bool |	false	| make range slider. Optional if initial value is an array. If initial value is scalar, max will be used for second value. |
| selection |	string |	'before' |	selection placement. Accepts: 'before', 'after' or 'none'. In case of a range slider, the selection will be placed between the handles |
| tooltip |	string |	'show' |	whether to show the tooltip on drag, hide the tooltip, or always show the tooltip. Accepts: 'show', 'hide', or 'always' |
| tooltip_split |	bool |	false |	if false show one tootip if true show two tooltips one for each handler |
| tooltip_position |	string |	null |	Position of tooltip, relative to slider. Accepts 'top'/'bottom' for horizontal sliders and 'left'/'right' for vertically orientated sliders. Default positions are 'top' for horizontal and 'right' for vertical slider. |
| handle |	string |	'round' |	handle shape. Accepts: 'round', 'square', 'triangle' or 'custom' |
| reversed | bool | false | whether or not the slider should be reversed |
| rtl | bool|string | 'auto' | whether or not the slider should be shown in rtl mode. Accepts true, false, 'auto'. Default 'auto' : use actual direction of HTML (`dir='rtl'`) |
| enabled | bool | true | whether or not the slider is initially enabled |
| formatter |	function |	returns the plain value |	formatter callback. Return the value wanted to be displayed in the tooltip, useful for string values. If a string is returned it will be indicated in an `aria-valuetext` attribute.  |
| natural_arrow_keys | bool | false | The natural order is used for the arrow keys. Arrow up select the upper slider value for vertical sliders, arrow right the righter slider value for a horizontal slider - no matter if the slider was reversed or not. By default the arrow keys are oriented by arrow up/right to the higher slider value, arrow down/left to the lower slider value. |
| ticks | array | [ ] | Used to define the values of ticks. Tick marks are indicators to denote special values in the range. This option overwrites min and max options. |
| ticks_positions | array | [ ] | Defines the positions of the tick values in percentages. The first value should always be 0, the last value should always be 100 percent. |
| ticks_labels | array | [ ] | Defines the labels below the tick marks. Accepts HTML input. |
| ticks_snap_bounds | float | 0 | Used to define the snap bounds of a tick. Snaps to the tick if value is within these bounds. |
| ticks_tooltip | bool | false | Used to allow for a user to hover over a given tick to see it's value. Useful if custom formatter passed in |
| scale | string | 'linear' | Set to 'logarithmic' to use a logarithmic scale. |
| focus | bool | false | Focus the appropriate slider handle after a value change. |
| labelledby | string,array | null | ARIA labels for the slider handle's, Use array for multiple values in a range slider. |
| rangeHighlights | array | [] | Defines a range array that you want to highlight, for example: [{'start':val1, 'end': val2, 'class': 'optionalAdditionalClassName'}]. |

Functions
=========
__NOTE:__ Optional parameters are italicized.

| Function | Parameters | Description |
| -------- | ----------- | ----------- |
| getValue | --- | Get the current value from the slider |
| setValue | newValue, _triggerSlideEvent_, _triggerChangeEvent_ | Set a new value for the slider. If optional triggerSlideEvent parameter is _true_, 'slide' events will be triggered. If optional triggerChangeEvent parameter is _true_, 'change' events will be triggered. This function takes `newValue` as either a `Number`, `String`, `Array`. If the value is of type `String` it must be convertable to an integer or it will throw an error.|
| getElement | --- | Get the div slider element |
| destroy | --- | Properly clean up and remove the slider instance |
| disable | ---| Disables the slider and prevents the user from changing the value |
| enable | --- | Enables the slider |
| toggle | --- | Toggles the slider between enabled and disabled |
| isEnabled | --- |Returns true if enabled, false if disabled |
| setAttribute | attribute, value | Updates the slider's [attributes](#options) |
| getAttribute | attribute | Get the slider's [attributes](#options) |
| refresh | --- | Refreshes the current slider |
| on | eventType, callback | When the slider event _eventType_ is triggered, the callback function will be invoked |
| off | eventType, callback | Removes the callback function from the slider event _eventType_ |
| relayout | --- | Renders the tooltip again, after initialization. Useful in situations when the slider and tooltip are initially hidden. |

Events
======
| Event | Description | Value |
| ----- | ----------- | ----- |
| slide | This event fires when the slider is dragged | The new slider value |
| slideStart | This event fires when dragging starts | The new slider value |
| slideStop | This event fires when the dragging stops or has been clicked on | The new slider value |
| change | This event fires when the slider value has changed | An object with 2 properties: "oldValue" and "newValue" |
| slideEnabled | This event fires when the slider is enabled | N/A |
| slideDisabled | This event fires when the slider is disabled | N/A |


How Do I Run This Locally?
======
- Clone the repository
- Run `nvm use` in your Terminal to switch to the proper Node/NPM version
- Once you are on specified Node version, run `npm install`
- Install the Grunt CLI: `npm install grunt-cli -g`
- Type `grunt dev` to launch browser window with Examples page

Grunt Tasks
======
This plugin uses Grunt as its command-line task runner.

To install the Grunt CLI, type `npm install grunt-cli -g`.

To execute any of the commands, type `grunt <task-name>` in your terminal instance.

The following is a list of the commonly-used command line tasks:

* `grunt development`: Generates the `index.html`, compiles the LESS/JS to the `/temp` directory, and launches the index.html in your system's default browser. As changes are made to source code, the
	browser window will auto-refresh.
* `grunt production`: Generates the `/dist` directory with minified and unminified assetts.
* `grunt dev`: Alias for `grunt development`
* `grunt prod`: Alias for `grunt production`
* `grunt build`: Transpiles JavaScript source via Babel and compiles LESS source to CSS to `temp` directory.
* `grunt lint`: Runs JSLint on the JavaScript source code files, SASS-Lint on the SASS source code files, and LESSLint on the LESS source code files.
* `grunt test`: Runs unit tests contained in `/test` directory via Jasmine 2.x.x


Version Bumping and Publishing (Maintainers Only)
=======
To do the following release tasks:
* bump the version
* publish a new version to NPM
* update the `gh-pages` branch
* push a new `dist` bundle to the `master` branch on the remote `origin`
* push new tags to the remote `origin`

Type the following command:

`npm run release <patch|minor|major>`

If you do not specify a version bump type, the script will automatically defer to a patch bump.

Updating Github.io Page
===========================
The Github.io page can be automatically updated by running the following command:

`npm run update-gh-pages`

This command will handle generating the latest versions of the JS/CSS and index.html page, and push them to the `gh-pages` branch.

Other Platforms & Libraries
===========================
- [Ruby on Rails](https://github.com/YourCursus/bootstrap-slider-rails)
- [knockout.js](https://github.com/cosminstefanxp/bootstrap-slider-knockout-binding) ([@cosminstefanxp](https://github.com/cosminstefanxp), [#81](https://github.com/seiyria/bootstrap-slider/issues/81))
- [AngularJS](https://github.com/seiyria/angular-bootstrap-slider)
- [EmberJS](https://github.com/lifegadget/ui-slider) ([@ksnyde](https://github.com/ksnyde))
- [ReactJS](https://github.com/brownieboy/react-bootstrap-slider)
- [NuGet](https://www.nuget.org/packages/bootstrap-slider/) ([@ChrisMissal](https://github.com/ChrisMissal))
- [MeteorJS](https://github.com/kidovate/meteor-bootstrap-slider)
- [Maven](http://mvnrepository.com/artifact/org.webjars.bower/seiyria-bootstrap-slider)
- [Vue.js](https://github.com/pimlie/vue-bootstrap-slider) ([@pimlie](https://github.com/pimlie))

Maintainers
============
- Kyle Kemp
	* Twitter: [@seiyria](https://twitter.com/seiyria)
	* Github: [seiyria](https://github.com/seiyria)
- Rohit Kalkur
	* Twitter: [@Rovolutionary](https://twitter.com/Rovolutionary)
	* Github: [rovolution](https://github.com/rovolution)

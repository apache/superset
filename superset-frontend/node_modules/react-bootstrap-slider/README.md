# React Bootstrap Slider

## Overview
A ReactJS wrapper for [seiyria's Bootstrap Slider component](https://github.com/seiyria/bootstrap-slider)


## Background
Note: This project started as a split off from my [react-bootstrap-native-slider](https://www.npmjs.com/package/react-bootstrap-native-slider) plugin, which I've subsequently deprecated.


## How to install
Install from npm with:

    npm install --save react-bootstrap-slider

Require or import like so for ES6:

    import ReactBootstrapSlider from 'react-bootstrap-slider';

or like this for CommonJS:

    var ReactBootstrapSlider = require("react-bootstrap-slider");


The control is implemented in UMD format, so should also work for AMD/RequireJS, but I've not tested that.  You can also add it as a script tag.


### Peer Dependencies
React and Bootstrap are listed as peer dependencies (peerDependencies in package.json) for react-bootstrap-slider.  They will _not_ be installed automatically when you install this component into your own project.  You will need to install them yourself, as part of that project, if you have not done so already.  This command will install them for you if you don't yet have them:

    npm install react react-dom prop-types bootstrap@^3 --save
or

    yarn add react react-dom prop-types bootstrap@^3


#### jQuery
The bootstrap-slider component - and, therefore, react-bootstrap-slider - will work with jQuery if it detects it in your project setup, but it is _not_ a requirement.  It works fine without jQuery.  However, if you are using Webpack or Browserify to build your project, you may get a "missing dependency" build error if jQuery is not present.  This is a known, upstream issue in bootstrap-slider.  Please see https://github.com/seiyria/bootstrap-slider#how-do-i-exclude-the-optional-jquery-dependency-from-my-build for how you can workaround this issue.

You must also ensure that you have included bootstrap-slider's CSS file, otherwise the control will be blank!  You'll need Bootstrap's own CSS file too, of course.  If you're using Webpack, you can import the CSS file directly into your build.  Or you can simply add the files as links in your HTML file, e.g.:

    <link rel="stylesheet" href="//maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" />
    <script src="//cdnjs.cloudflare.com/ajax/libs/bootstrap-slider/9.4.1/bootstrap-slider.min.js"></script>

## How to use
Here's an example of how you might call it in your ReactJS's render method:

```JavaScript
<ReactBootstrapSlider
    value={this.state.currentValue}
    change={this.changeValue}
    slideStop={this.changeValue}
    step={this.state.step}
    max={this.state.max}
    min={this.state.min}
    orientation="vertical"
    reversed={true}
    disabled="disabled" />

```

The **value**, **step**, **max** and **min** parameters should be self-explanatory.  The `change` event is the callback method that will be called when the slider actually changes.  (NB: this is the `change` event for the Bootstrap slider.)  As of version 1.1.2, there is a new `slideStop` event, which only triggers when you've _finished_ moving the slider (i.e. you release it).  This makes `slideStop` a deal less "chatty" than the `change` event.  Decide which one you need; you'll only ever need one or the other (unlike my example code above!).

If the optional parameter **disabled** is included, and is set to "disabled", then the slider will display in a disabled state.  If the parameter is not included, or is set to anything else except "disabled", then the slider control will be enabled.

The default **orientation** value is 'horizontal', so you only need to include that prop if you want to set it to 'vertical'.

If **value** is a two member array, then the slider will have two handles: minimum and maximum.  You should also pass win a **range** parameter set to true in this case.

As of version 1.0.5, other values passed into the component will also passed into the underlying bootstrap-slider component via the [Object Spread Operator that's been proposed for ES2017](https://github.com/Microsoft/TypeScript/issues/7617) (yes, that's how cutting edge I am!!).  See [seyria's documentation](https://github.com/seiyria/bootstrap-slider) for a full list of these.  Those parameters have not all been tested yet but the `reversed` parameter definitely works, and I have included this in the demo of the vertical slider.

Version 1.0.6 fixed an issue that prevented ticks props from being rendered.  Pass in ticks props like so:

```JavaScript
          ticks = {[0, 100, 200, 300, 400]}
          ticks_labels = {["$0", "$100", "$200", "$300", "$400"]}
          ticks_snap_bounds = { 30 }
```


## Development
After cloning [the repository from Github](https://www.npmjs.com/package/react-bootstrap-slider), run either:

    yarn
or
    npm install

to install the dependencies.  Note: React and Bootstrap _will_ be installed this time because they are listed as development dependencies as well as peer dependencies for the project.  (Please see discussion here https://github.com/brownieboy/react-bootstrap-slider/pull/43 for why I've listed these packages under both peerDependencies and devDependencies.)

To develop, issue this command:

    npm run start

then point your browser to [http://localhost:8080/src/index.html](http://localhost:8080/src/index.html).  You need to edit the code in the /src folder.  It will update in the browser automatically, courtesy of webpack-dev-server.

To build the distribution version, issue:

    npm run build

The build JavaScript file will go on the /dist folder as react-bootstrap-slider.js.  This is the main file for the project, which is used whenever this the react-bootstrap-slider package is loaded from npm.


## Demo
There is a /demo folder present, but it only contains index.html and the CSS files by default.  The JavaScript files need to be built before you can run this demo.  If there is no /demo/js folder present, then you need to run:

        npm run buildDemo

Webpack will build the JavaScript files for the demo and put them in the /demo/js/ folder.  Demo code will go in the /demo/js/slider-bundle.min.js file.  Any 3rd-party code (e.g. Bootstrap, React and the react-bootstrap-slider itself) goes into the /demo/js/vendor.min.js file.  Source maps are generated both.

CSS files and the index.html file will be copied from the /src folder to the /demo folder, with the correct script tag reference being inserted into index.html.  You can then open /demo/index.html in your browser from the local server.  To run that local server, issue the command:

        npm run localServer

This will launch http-server running on port 8082, so you can then open the built demo from http://localhost:8082/demo/index.html.


## Tests
There are no unit tests.

End to end (E2E) tests are handled by Protractor with Selenium Web Driver.


### Installing E2E Tests Dependencies
Before running the E2E tests, you'll need to install the web driver first by running:

        npm run updateSelenium

You only have to do this once though.


### Running Tests Against Dev Version
The same set of tests can be run against either the Dev version or the built version of the Demo.  To run run tests against the development version of the Demo, you need to run:

        npm run testDev

This assumes that you already have webpack-dev-server running on port 8080, via an `npm run start` command.  So putting that all together, the full commands to run the Dev tests would be:

        npm run updateSelenium
        npm run start
        npm run testDev

Note: the last of those three commands will need to be run in a separate terminal window/tab, because the first terminal will be tied up with running webpack-dev-server.


### Running Tests Against Built Version
To run tests against the built version, you obviously need to build that version first!  You then need a server running on port 8082, before finally running the tests in a new terminal window/tab.  I've included [http-server](https://www.npmjs.com/package/http-server) as a development dependency for this purpose, and you can run this via `npm run localServer`.  Putting that all together, the commands to do run the build version tests are:

         npm run updateSelenium
         npm run buildDemo
         npm run localServer
         npm run testBuild

Once again, the last command listed here will need to be executed in new console tab/window because the first one will be tied up running the local server.



### Test Results & Reports
Test results will be displayed in whichever terminal to your the `npm run testBuild` or `npm run testDev` commands.

The tests will also generate HTML reports in the /reports folder, courtesy of the [protractor-jasmine2-screenshot-reporter](https://www.npmjs.com/package/protractor-jasmine2-screenshot-reporter) package.  Open the /reports/index.html file in a browser to see them.  Note how each test result in this report is a URL.  If you click on the URL, it will take you to a screen shot of how the browser looked when that particular test ran, which is pretty neat, IMHO!



### Editing Tests
The tests themselves are in the file tests/e2e/slidertest1.js.  The tests check:

1. The page loads with the correct default values set for both the vertical and horizontal versions of the Demo.
1. Dragging the horizontal slider to the right increases its value correctly
1. Dragging the vertical slider upwards increases its value correctly
1. Clicking on the Change Axes button for both demos changes each one's respective default value correctly.

There's a Protractor Tutorial at http://www.protractortest.org/#/tutorial, and the the Protractor API is at http://www.protractortest.org/#/api.

### Further Test Configs
Protractor defaults to using the Firefox browser, but I've overridden the config so that it uses Chrome instead, so make sure that you have Chrome installed!  If you want to use Firefox or even IE, then you'll need to make some modifications to the protractor.local.conf.js file.  Google for how to do that.

Whatever other changes you make to protractor.local.conf.js, you _must_ _not_ remove this line:

        browser.ignoreSynchronization = true;

Protractor is actually a testing tool designed for AngularJS, but hey, nobody's perfect!  By default, Protractor will wait for Angular models to send their update messages before proceeding onto the next test.  This line tells Protractor not to wait for any such messages, which, of course, won't be coming because you're not using Angular.


## Update History

Version 2.1.5: 2 May 2018
* Fixed issue where control was permanently disabled if initial `max` value was set to zero.

Version 2.1.4: 13 Apr 2018
* Explicitly allow labelledby to be passed into the control 

Version 2.1.2 & 2.1.3: 21 Oct 2017
* 2.1.2 Fixed issue where setting the "disabled" prop did not disable the component on load.
* 2.1.3 Removed a debugging console.log that I introduced in 2.1.2 (doh!).

Version 2.1.1: 3 Oct 2017
* Fixed missing peerDependencies and devDependencies issue.

Version 2.1.0: 30 Sep 2017
* Updated for React 16 (Fiber).
* Updated dev dependencies to latest versions too.
* Removed React and Bootstrap from dependencies list.  They are now in devDependencies and peerDependencies.

Version 2.0.1: 19 Aug 2017
* Module is now destroyed correctly via componentWillUnmount method (thanks to KevBelisle for the PR).

Version 2.0.0: 30 Apr 2017
* Updated for React 15.5.x and 16 (Fiber) compatibility by using prop-types package.  This version will not work with older versions of React, hence the major version bump.

Version 1.1.7: 2 Apr 2017
* Removed jQuery as any kind of dependency.  It's not actually needed, but it is used by boostrap-slider if present.

Version 1.1.6: 28 Mar 2017
* Moved bootstrap, jquery, react and react-dom from dependencies to peerDependencies and devDependencies. (They need to in both because neither yarn or npm install command actually installs peerDependencies.)

Version 1.1.5: 7 Mar 2017
* Remove unnecessary console.log() calls (thanks to saevarom for the PR).
* Fixed path to testBuild script in package.json

Version 1.1.4: 11 Feb 2017
* Removed es6bindall as a dependency.  This allows using react-bootstrap-slider with Require.JS.  (PR merge from TalAter.)
* Fixed readme.md error: `reverse` parameter should actually be `reversed`.  (Thanks to chunkiat82 for the pick up.)

Version 1.1.3: 19 Nov 2016
* Fixed bug where min, max and step values were not updating correctly when component received new props for them.
* Updated dependencies to latest versions.

Version 1.1.2: 24 Sep 2016
* Reverted change of slider trigger event from `change` to `slideStop` in v1.1.1.  This was a dumb way of doing it, and was a borderline breaking change to boot.
* Added new `slideStop` event, which maps to the bootstrap-slider event of the same name
* Added new `change` event, which maps to the bootstrap-slider event of the same name.  Note: this is in _addition_ to the previous `handleChange` event, which will continue to work and is _not_ being deprecated here.

Version 1.1.1: 23 Sep 2016 (NB: Bad version.  Do not use!  See 1.12 comments above.)
* Changed main slider trigger event from `change` to `slideStop`.  Component should now be less chatty with improved performance.

Version 1.1.0: 21 Sep 2016.
* Updated to seiyria's 9.2 version.  This includes the rangeHighlights feature.
* Updated readme to specify inclusion of bootstrap-slider's CSS file.
* Removed reports folder from NPM package

Version 1.0.6: 1 August 2016.
* Fixed issue where ticks props were not being rendered.  This is because the code was assuming that there would always be min and max props, but the ticks props actually override these.

Version 1.0.5: 13 June 2016.
* Explained how use dual slider controls.  Added test for same.
* Cleaned up demo to code to have one Demo class instead of three.

Version 1.0.4: 12 June 2016.
* Added vertical slider to demo page.
* Updated build process to copy (and update) CSS and HTML files from /src to /demo folder using Gulp.  So no longer have to update the /demo files manually when updating build.
* Added test suite using Protractor/Selenium.

Version 1.0.3: 7 June 2016.
* Fixed path issues in package.json scripts.
* Removed postInstall step from package.json, as not actually required.


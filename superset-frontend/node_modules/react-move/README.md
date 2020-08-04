<div style="text-align:center;">
  <a href="https://github.com/react-tools/react-move" target="\_parent"><img src="https://github.com/react-tools/media/raw/master/logo-react-move.png" alt="React Table Logo" style="width:450px;"/></a>
</div>

# React-Move

Beautiful, data-driven animations for React.

[![Build Status](https://travis-ci.org/react-tools/react-move.svg?branch=master)](https://travis-ci.org/react-tools/react-move)
[![npm version](https://img.shields.io/npm/v/react-move.svg)](https://www.npmjs.com/package/react-move)
[![npm downloads](https://img.shields.io/npm/dm/react-move.svg)](https://www.npmjs.com/package/react-move)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg?maxAge=2592000)](https://github.com/react-tools/react-move/blob/master/LICENSE)
![gzip size](http://img.badgesize.io/https://npmcdn.com/react-move/dist/react-move.min.js?compression=gzip)
[![Join the community on Spectrum](https://withspectrum.github.io/badge/badge.svg)](https://spectrum.chat/react-move)

### Go to [live examples, code and docs](https://react-move.js.org)!

## Features

* Built-in support for interpolating:
  * Strings
  * Numbers
  * Colors
  * SVG paths
  * SVG transforms
* Animate HTML, SVG & React-Native
* Fine-grained control of delay, duration and easing
* Animation lifecycle events: start, interrupt, end
* Custom tweening functions
* Awesome documentation and lots of examples
* Supported in React, React-Native & React-VR
* Supports TypeScript

## Demos

* [CodeSandbox - Animated Bars](https://codesandbox.io/s/w0ol90x9z5) ([@animateddata](https://github.com/animateddata))
* [CodeSandbox - Collapsible Tree](https://codesandbox.io/s/ww0xkyqonk) ([@techniq](https://github.com/techniq))
* [CodeSandbox - Draggable List](https://codesandbox.io/s/j2povnz8ly)
* [CodeSandbox - Circle Inferno](https://codesandbox.io/s/n033m6nw00)
* [CodeSandbox - Animated Mount/Unmount](https://codesandbox.io/s/9z04rpypny)
* [Examples](https://react-move.js.org)

## React-Move vs React-Motion

* React-move allows you to define your animations using durations, delays and ease functions.
  In react-motion you use spring configurations to define your animations.

* React-move has built-in support for interpolating strings, numbers, colors, SVG paths and SVG transforms.
  With react-motion you can only interpolate numbers so you have to do a bit more work or include another library to work with colors, paths, etc.

* In react-move you can define different animations for entering, updating and leaving with the ability to specify delay, duration and ease on each individual key.
  React-motion allows you to define a spring configuration for each key in the "style" object.

* React-move has lifecycle events on its transitions.
  You can pass a function to be called on transition start, interrupt or end.
  React-motion has an "onRest" prop that fires a callback when the animation stops (just the `Motion` component not `TransitionMotion` or `StaggeredMotion`).

* React-move also allows you to pass your own custom interpolators. It's all springs in react-motion.

## Questions? Ideas? Chat with us!

Sign up for the [React-Tools Spectrum Community](https://spectrum.chat/react-move)!

## Installation

```bash
$ yarn add react-move
# or
$ npm install react-move
```

# Documentation

The docs below are for version **2.x.x** of React-Move.

Older versions:

* [Version 1.x.x](https://github.com/react-tools/react-move/tree/v1.6.1)

## < NodeGroup />

The NodeGroup component allows you to create complex animated transitions. You pass it an array of objects and a key accessor function and it will run your enter, update and leave transitions as the data updates.
The idea is similar to transition components like [react-transition-group](https://github.com/reactjs/react-transition-group) or [react-motion's TransitionMotion](https://github.com/chenglou/react-motion) but you use objects to express how you want your state to transition.

Not only can you can have independent duration, delay and easing for entering, updating and leaving but each individual key in your state can define its own timing!

### Component Props

| Name                                               | Type     | Default  | Description                                                                                                                                                                              |
| :------------------------------------------------- | :------- | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span style="color: #31a148">data \*</span>        | Array    |          | An array of data objects. The data prop is treated as immutable so the nodes will only update if prev.data !== next.data.                                                                |
| <span style="color: #31a148">keyAccessor \*</span> | function |          | Function that returns a string key given a data object and its index. Used to track which nodes are entering, updating and leaving.                                                      |
| <span style="color: #31a148">start \*</span>       | function |          | A function that returns the starting state. The function is passed the data and index and must return an object.                                                                         |
| enter                                              | function | () => {} | A function that **returns an object or array of objects** describing how the state should transform on enter. The function is passed the data and index.                                 |
| update                                             | function | () => {} | A function that **returns an object or array of objects** describing how the state should transform on update. The function is passed the data and index.                                |
| leave                                              | function | () => {} | A function that **returns an object or array of objects** describing how the state should transform on leave. The function is passed the data and index.                                 |
| <span style="color: #31a148">children \*</span>    | function |          | A function that renders the nodes. It should accept an array of nodes as its only argument. Each node is an object with the key, data, state and a type of 'ENTER', 'UPDATE' or 'LEAVE'. |

* required props

### Usage

Go to [live examples, code and docs](https://react-move.js.org)!

A typical usage of NodeGroup looks like this...

```js
<NodeGroup
  data={this.state.data} // an array (required)
  keyAccessor={(d) => d.name} // function to get the key of each object (required)

  start={(data, index) => ({ // returns the starting state of node (required)
    ...
  })}

  enter={(data, index) => ({ // how to transform node state on enter - runs immediately after start (optional)
    ...
  })}

  update={(data, index) => ({ // how to transform node state on update - runs each time data updates and key remains (optional)
    ...
  })}

  leave={(data, index) => ({ // how to transform node state on leave - run when data updates and key is gone (optional)
    ...
  })}
>
  {(nodes) => ( // the only child of NodeGroup should be a function to render the nodes (required)
    ...
      {nodes.map(({ key, data, state }) => {
        ...
      })}
    ...
  )}
</NodeGroup>
```

### Transitions

Go to [live examples, code and docs](https://react-move.js.org)!

```js
<NodeGroup
  data={this.state.data}
  keyAccessor={(d) => d.name}

  // start - starting state of the node. Just return an object.
  start={(data, index) => ({
    opacity: 1e-6,
    x: 1e-6,
    fill: 'green',
    width: scale.bandwidth(),
  })}

  // enter - return an object or array of objects describing how to transform the state.
  enter={(data, index) => ({
    opacity: [0.5], // transition opacity on enter
    x: [scale(data.name)], // transition x on on enter
    timing: { duration: 1500 }, // timing for transitions
  })}

  update={(data) => ({
    ...
  })}

  leave={() => ({
    ...
  })}
>
  {(nodes) => (
    ...
  )}
</NodeGroup>
```

You return an object or an array of objects in your **enter**, **update** and **leave** functions.
Instead of simply returning the next state these objects describe how to transform the state.
This is far more powerful than just returning a state object. By approaching it this way, you can describe really complex transformations and handle interrupts easily.

If you're familiar with D3, this approach mimics selection/transition behavior. In D3 your are really describing how the state should look on enter, update and exit and how to get there: set the value immediately or transition to it.
D3 deals with the fact that transitions might be in-flight or the key is already at that value in the background without you having to worry about that.
The NodeGroup takes the same approach but it's done in idiomatic React.

Each object returned from your enter, update and leave functions can specify its own duration, delay, easing and events independently.
To support that, inside your object there are two special keys you can use: **timing** and **events**. Both are optional.
Timing and events are covered in more detail below.
The rest of the keys in each object are assumed to be keys in your state.

If you aren't transitioning anything then it wouldn't make sense to be using NodeGroup.
That said, like in D3, it's also convenient to be able to set a key to value when a node enters, updates or leaves without transitioning.
To support this you can return four different types of values to specify how you want to transform the state.

* `string or number`: Set the key to the value immediately with no transition.

* `array [value]`: Transition from the key's current value to the specified value. Value is a string or number.

* `array [value, value]`: Transition from the first value to the second value. Each value is a string or number.

* `function`: Function will be used as a custom tween function.

In all cases above a "string" can be a color, path, transform (the key must be called "transform" see below), etc and it will be interpolated using the correct interpolator.
See the interpolators section below.

## Timing

Go to [live examples, code and docs](https://react-move.js.org)!

If there's no timing key in your object you'll get the timing defaults.
You can specify just the things you want to override on your timing key.

Here's the timing defaults...

```js
const defaultTiming = {
  delay: 0,
  duration: 250,
  ease: easeLinear
};
```

For the ease key, just provide the function. You can use any easing function, like those from d3-ease...

[List of ease functions exported from d3-ease](https://github.com/d3/d3-ease/blob/master/index.js)

## Passing an array of objects

Go to [live examples, code and docs](https://react-move.js.org)!

Each object can define its own timing and it will be applied to any transitions in the object.

```js
import { easeQuadInOut } from 'd3-ease';

...

<NodeGroup
  data={this.state.data}
  keyAccessor={(d) => d.name}

  // start - starting state of the node. Just return an object.
  start={(data, index) => ({
    opacity: 1e-6,
    x: 1e-6,
    fill: 'green',
    width: scale.bandwidth(),
  })}

  // enter - return an object or array of objects describing how to transform the state.
  enter={(data, index) => ([ // An array
    {
      opacity: [0.5], // transition opacity on enter
      timing: { duration: 1000 }, // timing for transition
    },
    {
      x: [scale(data.name)], // transition x on on enter
      timing: { delay: 750, duration: 1500, ease: easeQuadInOut }, // timing for transition
    },
  ])}

  update={(data) => ({
    ...
  })}

  leave={() => ({
    ...
  })}
>
  {(nodes) => (
    ...
  )}
</NodeGroup>
```

## Contributing

We love contributions from the community! Read the [contributing info here](https://github.com/react-tools/react-move/blob/master/CONTRIBUTING.md).

#### Run the repo locally

* Fork this repo
* `npm install`
* `cd docs`
* `npm install`
* `npm start`

#### Scripts

Run these from the root of the repo

* `npm run lint` Lints all files in src and docs
* `npm run test` Runs the test suite locally
* `npm run test:coverage` Get a coverage report in the console
* `npm run test:coverage:html` Get an HTML coverage report in coverage folder

Go to [live examples, code and docs](https://react-move.js.org)!

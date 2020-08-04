# Hammer.js 2.0.6

[![Build Status](https://travis-ci.org/hammerjs/hammer.js.svg)](https://travis-ci.org/hammerjs/hammer.js)

## Support, Questions, and Collaboration

[![Slack Status](https://hammerjs.herokuapp.com/badge.svg)](https://hammerjs.herokuapp.com/)

## Documentation

Visit [hammerjs.github.io](http://hammerjs.github.io) for detailed documentation.

```js
// get a reference to an element
var stage = document.getElementById('stage');

// create a manager for that element
var mc = new Hammer.Manager(stage);

// create a recognizer
var Rotate = new Hammer.Rotate();

// add the recognizer
mc.add(Rotate);

// subscribe to events
mc.on('rotate', function(e) {
    // do something cool
    var rotation = Math.round(e.rotation);    
    stage.style.transform = 'rotate('+rotation+'deg)';
});
```

An advanced demo is available here: [http://codepen.io/runspired/full/ZQBGWd/](http://codepen.io/runspired/full/ZQBGWd/)


## Contributing

Read the [contributing guidelines](./CONTRIBUTING.md).

For PRs.

- Use [Angular Style commit messages](https://github.com/angular/angular.js/blob/v1.4.8/CONTRIBUTING.md#commit)
- Rebase your PR branch when necessary
- If you add a feature or fix a bug, please add or fix any necessary tests.
- If a new feature, open a docs PR to go with.

## Building

You can get the pre-build versions from the Hammer.js website, or do this by yourself running 
`npm install -g grunt-cli && npm install && grunt build`

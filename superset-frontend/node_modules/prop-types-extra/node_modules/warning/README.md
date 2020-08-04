# Warning [![npm version](https://badge.fury.io/js/warning.svg)](https://badge.fury.io/js/warning)

[![Greenkeeper badge](https://badges.greenkeeper.io/BerkeleyTrue/warning.svg)](https://greenkeeper.io/)
A mirror of Facebook's [Warning](https://github.com/facebook/fbjs/blob/master/packages/fbjs/src/__forks__/warning.js)


## Usage
```
npm install warning
```

```
// some script
var warning = require('warning');

var ShouldBeTrue = false;

warning(
  ShouldBeTrue,
  'This thing should be true but you set to false. No soup for you!'
);
//  'This thing should be true but you set to false. No soup for you!'
```

Similar to Facebook's (FB) invariant but only logs a warning if the condition is not met.
This can be used to log issues in development environments in critical
paths. Removing the logging code for production environments will keep the
same logic and follow the same code paths.

## FAQ (READ before opening an issue)

> Why do you use `console.error` instead of `console.warn` ?

This is a mirror of Facebook's (FB) [warning](https://github.com/facebook/fbjs/blob/master/packages/fbjs/src/__forks__/warning.js) module used within React's source code (and other FB software).
As such this module will mirror their code as much as possible. 

The descision to use `error` over `warn` was made a long time ago by the FB team and isn't going to change anytime soon.

The source can be found here: https://github.com/facebook/fbjs/blob/master/packages/fbjs/src/__forks__/warning.js
The reasoning can be found here and elsewhere: https://github.com/facebook/fbjs/pull/94#issuecomment-168332326

> Can I add X feature?

This is a mirror of Facebook's (FB) [warning](https://github.com/facebook/fbjs/blob/master/packages/fbjs/src/__forks__/warning.js) and as such the source and signature will mirror that module.

If you believe a feature is missing than please open a feature request [there](https://github.com/facebook/fbjs).
If it is approved and merged in that this module will be updated to reflect that change, otherwise this module will not change.

## Use in Production

It is recommended to add [babel-plugin-dev-expression](https://github.com/4Catalyzer/babel-plugin-dev-expression) with this module to remove warning messages in production.
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<small>Don't Forget To Be Awesome</small>

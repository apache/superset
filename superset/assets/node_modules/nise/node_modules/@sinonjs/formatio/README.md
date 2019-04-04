# formatio

[![Build status](https://secure.travis-ci.org/sinonjs/formatio.svg?branch=master)](http://travis-ci.org/sinonjs/formatio)
[![Coverage Status](https://coveralls.io/repos/github/sinonjs/formatio/badge.svg?branch=master)](https://coveralls.io/github/sinonjs/formatio?branch=master)

> The cheesy object formatter

Pretty formatting of arbitrary JavaScript values. Currently only supports ascii
formatting, suitable for command-line utilities. Like `JSON.stringify`, it
formats objects recursively, but unlike `JSON.stringify`, it can handle
regular expressions, functions, circular objects and more.

`formatio` is a general-purpose library. It works in browsers (including old
and rowdy ones, like IE6) and Node. It will define itself as an AMD module if
you want it to (i.e. if there's a `define` function available).

## Installation

```shell
npm install @sinonjs/formatio
```

## Documentation

https://sinonjs.github.io/formatio/


## Backers

Support us with a monthly donation and help us continue our activities. [[Become a backer](https://opencollective.com/sinon#backer)]

<a href="https://opencollective.com/sinon/backer/0/website" target="_blank"><img src="https://opencollective.com/sinon/backer/0/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/1/website" target="_blank"><img src="https://opencollective.com/sinon/backer/1/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/2/website" target="_blank"><img src="https://opencollective.com/sinon/backer/2/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/3/website" target="_blank"><img src="https://opencollective.com/sinon/backer/3/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/4/website" target="_blank"><img src="https://opencollective.com/sinon/backer/4/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/5/website" target="_blank"><img src="https://opencollective.com/sinon/backer/5/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/6/website" target="_blank"><img src="https://opencollective.com/sinon/backer/6/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/7/website" target="_blank"><img src="https://opencollective.com/sinon/backer/7/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/8/website" target="_blank"><img src="https://opencollective.com/sinon/backer/8/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/9/website" target="_blank"><img src="https://opencollective.com/sinon/backer/9/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/10/website" target="_blank"><img src="https://opencollective.com/sinon/backer/10/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/11/website" target="_blank"><img src="https://opencollective.com/sinon/backer/11/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/12/website" target="_blank"><img src="https://opencollective.com/sinon/backer/12/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/13/website" target="_blank"><img src="https://opencollective.com/sinon/backer/13/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/14/website" target="_blank"><img src="https://opencollective.com/sinon/backer/14/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/15/website" target="_blank"><img src="https://opencollective.com/sinon/backer/15/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/16/website" target="_blank"><img src="https://opencollective.com/sinon/backer/16/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/17/website" target="_blank"><img src="https://opencollective.com/sinon/backer/17/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/18/website" target="_blank"><img src="https://opencollective.com/sinon/backer/18/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/19/website" target="_blank"><img src="https://opencollective.com/sinon/backer/19/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/20/website" target="_blank"><img src="https://opencollective.com/sinon/backer/20/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/21/website" target="_blank"><img src="https://opencollective.com/sinon/backer/21/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/22/website" target="_blank"><img src="https://opencollective.com/sinon/backer/22/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/23/website" target="_blank"><img src="https://opencollective.com/sinon/backer/23/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/24/website" target="_blank"><img src="https://opencollective.com/sinon/backer/24/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/25/website" target="_blank"><img src="https://opencollective.com/sinon/backer/25/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/26/website" target="_blank"><img src="https://opencollective.com/sinon/backer/26/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/27/website" target="_blank"><img src="https://opencollective.com/sinon/backer/27/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/28/website" target="_blank"><img src="https://opencollective.com/sinon/backer/28/avatar.svg"></a>
<a href="https://opencollective.com/sinon/backer/29/website" target="_blank"><img src="https://opencollective.com/sinon/backer/29/avatar.svg"></a>


## Sponsors

Become a sponsor and get your logo on our README on GitHub with a link to your site. [[Become a sponsor](https://opencollective.com/sinon#sponsor)]

<a href="https://opencollective.com/sinon/sponsor/0/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/0/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/1/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/1/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/2/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/2/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/3/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/3/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/4/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/4/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/5/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/5/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/6/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/6/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/7/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/7/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/8/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/8/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/9/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/9/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/10/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/10/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/11/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/11/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/12/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/12/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/13/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/13/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/14/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/14/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/15/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/15/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/16/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/16/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/17/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/17/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/18/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/18/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/19/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/19/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/20/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/20/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/21/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/21/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/22/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/22/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/23/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/23/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/24/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/24/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/25/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/25/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/26/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/26/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/27/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/27/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/28/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/28/avatar.svg"></a>
<a href="https://opencollective.com/sinon/sponsor/29/website" target="_blank"><img src="https://opencollective.com/sinon/sponsor/29/avatar.svg"></a>

## Licence

formatio was released under [BSD-3](LICENSE)

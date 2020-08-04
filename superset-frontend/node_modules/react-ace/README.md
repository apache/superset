# React-Ace

[![Backers on Open Collective](https://opencollective.com/react-ace/backers/badge.svg)](#backers) [![Sponsors on Open Collective](https://opencollective.com/react-ace/sponsors/badge.svg)](#sponsors) [![Greenkeeper badge](https://badges.greenkeeper.io/securingsincity/react-ace.svg)](https://greenkeeper.io/)

[![npm version](https://badge.fury.io/js/react-ace.svg)](http://badge.fury.io/js/react-ace)
[![Build Status](https://travis-ci.org/securingsincity/react-ace.svg)](https://travis-ci.org/securingsincity/react-ace)
[![CDNJS](https://img.shields.io/cdnjs/v/react-ace.svg)](https://cdnjs.com/libraries/react-ace)
[![Coverage Status](https://coveralls.io/repos/github/securingsincity/react-ace/badge.svg?branch=master)](https://coveralls.io/github/securingsincity/react-ace?branch=master)

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/j)

A set of react components for Ace / Brace

[DEMO of React Ace](http://securingsincity.github.io/react-ace/)

[DEMO of React Ace Split Editor](http://securingsincity.github.io/react-ace/split.html)

## Install

`npm install react-ace`

## Basic Usage

```javascript
import React from 'react';
import { render } from 'react-dom';
import brace from 'brace';
import AceEditor from 'react-ace';

import 'brace/mode/java';
import 'brace/theme/github';

function onChange(newValue) {
  console.log('change',newValue);
}

// Render editor
render(
  <AceEditor
    mode="java"
    theme="github"
    onChange={onChange}
    name="UNIQUE_ID_OF_DIV"
    editorProps={{$blockScrolling: true}}
  />,
  document.getElementById('example')
);
```

## Examples

Checkout the `example` directory for a working example using webpack.

## Documentation

[Ace Editor](https://github.com/securingsincity/react-ace/blob/master/docs/Ace.md)

[Split View Editor](https://github.com/securingsincity/react-ace/blob/master/docs/Split.md)

[How to add modes, themes and keyboard handlers](https://github.com/securingsincity/react-ace/blob/master/docs/Modes.md)

[Frequently Asked Questions](https://github.com/securingsincity/react-ace/blob/master/docs/FAQ.md)

## Backers

Support us with a monthly donation and help us continue our activities. [[Become a backer](https://opencollective.com/react-ace#backer)]

<a href="https://opencollective.com/react-ace/backer/0/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/0/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/1/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/1/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/2/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/2/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/3/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/3/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/4/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/4/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/5/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/5/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/6/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/6/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/7/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/7/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/8/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/8/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/9/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/9/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/10/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/10/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/11/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/11/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/12/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/12/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/13/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/13/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/14/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/14/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/15/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/15/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/16/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/16/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/17/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/17/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/18/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/18/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/19/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/19/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/20/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/20/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/21/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/21/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/22/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/22/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/23/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/23/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/24/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/24/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/25/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/25/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/26/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/26/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/27/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/27/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/28/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/28/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/backer/29/website" target="_blank"><img src="https://opencollective.com/react-ace/backer/29/avatar.svg"></a>


## Sponsors

Become a sponsor and get your logo on our README on Github with a link to your site. [[Become a sponsor](https://opencollective.com/react-ace#sponsor)]

<a href="https://opencollective.com/react-ace/sponsor/0/website" target="_blank"><img src="https://opencollective.com/react-ace/sponsor/0/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/sponsor/1/website" target="_blank"><img src="https://opencollective.com/react-ace/sponsor/1/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/sponsor/2/website" target="_blank"><img src="https://opencollective.com/react-ace/sponsor/2/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/sponsor/3/website" target="_blank"><img src="https://opencollective.com/react-ace/sponsor/3/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/sponsor/4/website" target="_blank"><img src="https://opencollective.com/react-ace/sponsor/4/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/sponsor/5/website" target="_blank"><img src="https://opencollective.com/react-ace/sponsor/5/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/sponsor/6/website" target="_blank"><img src="https://opencollective.com/react-ace/sponsor/6/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/sponsor/7/website" target="_blank"><img src="https://opencollective.com/react-ace/sponsor/7/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/sponsor/8/website" target="_blank"><img src="https://opencollective.com/react-ace/sponsor/8/avatar.svg"></a>
<a href="https://opencollective.com/react-ace/sponsor/9/website" target="_blank"><img src="https://opencollective.com/react-ace/sponsor/9/avatar.svg"></a>



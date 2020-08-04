# import-local [![Build Status](https://travis-ci.org/sindresorhus/import-local.svg?branch=master)](https://travis-ci.org/sindresorhus/import-local)

> Let a globally installed package use a locally installed version of itself if available

Useful for CLI tools that want to defer to the user's locally installed version when available, but still work if it's not installed locally. For example, [AVA](http://ava.li) and [XO](https://github.com/xojs/xo) uses this method.


## Install

```
$ npm install import-local
```


## Usage

```js
const importLocal = require('import-local');

if (importLocal(__filename)) {
	console.log('Using local version of this package');
} else {
	// Code for both global and local version here…
}
```


---

<div align="center">
	<b>
		<a href="https://tidelift.com/subscription/pkg/npm-import-local?utm_source=npm-import-local&utm_medium=referral&utm_campaign=readme">Get professional support for this package with a Tidelift subscription</a>
	</b>
	<br>
	<sub>
		Tidelift helps make open source sustainable for maintainers while giving companies<br>assurances about security, maintenance, and licensing for their dependencies.
	</sub>
</div>

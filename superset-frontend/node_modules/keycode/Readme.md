# keycode

  Simple map of keyboard codes.

[![Build Status](https://travis-ci.org/timoxley/keycode.png?branch=master)](https://travis-ci.org/timoxley/keycode)

## Installation

#### npm

```sh
$ npm install keycode
```

#### component
```sh
$ component install timoxley/keycode
```

## Example

```js
var keycode = require('keycode');
document.addEventListener('keydown', function(e) {
  console.log("You pressed", keycode(e))
})
```

## API

`keycode` tries to make an intelligent guess as to what
you're trying to discover based on the type of argument
you supply.

### keycode(keycode:Event)

Returns the name of the key associated with this event.

```js
document.body.addEventListener('keyup', function(e) {
  console.log(keycode(e)) // prints name of key
})
```

[Due to the keypress event being weird](https://github.com/timoxley/keycode/wiki/wtf%3F-keydown,-keyup-vs-keypress),`keycode `currently does not support the `keypress` event, but this should not be an issue as `keydown` and `keyup` work perfectly fine.

### keycode(keycode:Number)

Returns the lowercase name of a given numeric keycode.

```js
keycode(13) // => 'enter'
```

### keycode(name:String)

Returns the numeric keycode for given key name.

```js
keycode('Enter') // => 13

// keycode is not case sensitive
keycode('eNtEr') // => 13
```

### Name Aliases

Common aliases are also supplied:

```js
> for (var alias in keycode.aliases) { console.log(alias, keycode(keycode(alias))) }
ctl ctrl
pause pause/break
break pause/break
caps caps lock
escape esc
pgup page up
pgdn page down
ins insert
del delete
spc space
```

## keycode.isEventKey(event: Event, nameOrCode: String | Number)

Tests if an keyboard event against a given name or keycode.
Will return `true` if the event matches the given name or keycode, `false` otherwise.

```js
// assume event is an keydown event with key 'enter'
keycode.isEventKey(event, 'enter') // => true
keycode.isEventKey(event, 'down') // => false

keycode.isEventKey(event, 13) // => true
keycode.isEventKey(event, 40) // => false
```


## Maps

Key code/name maps are available directly as `keycode.codes` and `keycode.names` respectively.

```js
keycode.names[13] // => 'enter'
keycode.codes['Enter'] // => 13
```

## Credit

```
 project  : keycode
 repo age : 3 years, 8 months
 active   : 29 days
 commits  : 66
 files    : 13
 authors  :
    49	Tim Oxley        74.3%
     4	jkroso           6.1%
     3	Amir Abu Shareb  4.5%
     1	Greg Reimer      1.5%
     1	Kenan Yildirim   1.5%
     1	Abel Toledano    1.5%
     1	Sam              1.5%
     1	TJ Holowaychuk   1.5%
     1	Yoshua Wuyts     1.5%
     1	Nathan Zadoks    1.5%
     1	Brenton Simpson  1.5%
     1	Brian Noguchi    1.5%
     1	Gilad Peleg      1.5%
```

Original key mappings lifted from http://jsfiddle.net/vWx8V/ via http://stackoverflow.com/questions/5603195/full-list-of-javascript-keycodes

## License

[MIT](http://opensource.org/licenses/mit-license.php)

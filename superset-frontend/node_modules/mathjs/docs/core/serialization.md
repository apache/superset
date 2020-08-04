# Serialization

Math.js has a number of data types like `Matrix`, `Complex`, and `Unit`. These
types are instantiated JavaScript objects. To be able to store these data types
or send them between processes, they must be serialized. The data types of
math.js can be serialized to JSON. Use cases:

- Store data in a database or on disk.
- Interchange of data between a server and a client.
- Interchange of data between a web worker and the browser.

Math.js types can be serialized using JavaScript's built-in `JSON.stringify`
function:

```js
var x   = math.complex('2 + 3i');
var str = JSON.stringify(x);
console.log(str);
// outputs a string '{"mathjs":"Complex","re":2,"im":3}'
```

In order to deserialize a string, containing math.js data types, `JSON.parse`
can be used. In order to recognize the data types of math.js, `JSON.parse` must
be called with the reviver function of math.js:

```js
var json = '{"mathjs":"Unit","value":5,"unit":"cm","fixPrefix":false}';
var x    = JSON.parse(json, math.json.reviver);   // Unit 5 cm
```

Note that if math.js is used in conjunction with other data types, it is
possible to use multiple reviver functions at the same time by cascading them:

```js
var reviver = function (key, value) {
  return reviver1(key, reviver2(key, value));
}
```

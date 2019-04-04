# Chaining

Math.js supports chaining operations by wrapping a value into a `Chain`.
A chain can be created with the function `math.chain(value)`
(formerly `math.select(value)`).
All functions available in the math namespace can be executed via the chain.
The functions will be executed with the chain's value as the first argument,
followed by extra arguments provided by the function call itself.

```js
math.chain(3)
    .add(4)
    .subtract(2)
    .done(); // 5

math.chain( [[1, 2], [3, 4]] )
    .subset(math.index(0, 0), 8)
    .multiply(3)
    .done(); // [[24, 6], [9, 12]]
```

### API

A `Chain` is constructed as:

```js
math.chain()
math.chain(value)
```

The `Chain` has all functions available in the `math` namespace, and has
a number of special functions:

 - `done()`
   Finalize the chain and return the chain's value.
 - `valueOf()`
   The same as `done()`, returns the chain's value.
 - `toString()`
   Executes `math.format(value)` onto the chain's value, returning
   a string representation of the value.


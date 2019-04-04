# Core

## Usage

The core of math.js is the `math` namespace containing all functions and constants. There are three ways to do calculations in math.js:

- Doing regular function calls like `math.add(math.sqrt(4), 2)`.
- Evaluating expressions like `math.eval('sqrt(4) + 2')`
- Chaining operations like `math.chain(4).sqrt().add(2)`.

## Configuration

math.js can be configured using the `math.config()`, see page [Configuration](configuration.md).

## Extension

math.js can be extended with new functions and constants using the function `math.import()`, see page [Extension](extension.md).

## Serialization

To persist or exchange data structures like matrices and units, the data types of math.js can be stringified as JSON. This is explained on the page [Serialization](serialization.md).

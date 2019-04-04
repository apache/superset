// Note: This file is used by the file ./index.js


// factory function which defines a new data type MyType
function factory(type, config, load, typed) {

  // create a new data type
  function MyType (value) {
    this.value = value;
  }
  MyType.prototype.isMyType = true;
  MyType.prototype.toString = function () {
    return 'MyType:' + this.value;
  };

  // define a new data type
  typed.addType({
    name: 'MyType',
    test: function (x) {
      // test whether x is of type MyType
      return x && x.isMyType;
    }
  });

  // define conversions if applicable
  typed.addConversion({
    from: 'number',
    to: 'MyType',
    convert: function (x) {
      // convert a number to MyType
      return new MyType(x);
    }
  });

  // return the construction function, this will
  // be added to math.type.MyType when imported
  return MyType;
}

exports.name = 'MyType';
exports.path = 'type';        // will be imported into math.type.MyType
exports.factory = factory;
exports.lazy = false;         // disable lazy loading as this factory has side
                              // effects: it adds a type and a conversion.

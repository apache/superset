var Filter = function () {
  function Filter() {}

  var _proto = Filter.prototype;

  _proto.attribute = function attribute(name, value) {
    return value;
  };

  _proto.node = function (_node) {
    function node(_x, _x2) {
      return _node.apply(this, arguments);
    }

    node.toString = function () {
      return _node.toString();
    };

    return node;
  }(function (name, node) {
    return node;
  });

  return Filter;
}();

export { Filter as default };
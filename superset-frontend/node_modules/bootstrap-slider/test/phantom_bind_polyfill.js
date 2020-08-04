/////////////////////////////////////
// Taken from ariya/phantomjs#10522
//


Function.prototype.bind = function bind(that) { // .length is 1
      var target = this;
      if (typeof target != "function") {
          throw new TypeError("Function.prototype.bind called on incompatible " + target);
      }
      var args = Array.prototype.slice.call(arguments, 1); // for normal call
      var bound = function () {

          if (this instanceof bound) {

              var result = target.apply(
                  this,
                  args.concat(Array.prototype.slice.call(arguments))
              );
              if (Object(result) === result) {
                  return result;
              }
              return this;

          } else {
              return target.apply(
                  that,
                  args.concat(Array.prototype.slice.call(arguments))
              );

          }

      };
      function Empty() {};
      if(target.prototype) {
          Empty.prototype = target.prototype;
          bound.prototype = new Empty();
          Empty.prototype = null;
      }
      return bound;
  };
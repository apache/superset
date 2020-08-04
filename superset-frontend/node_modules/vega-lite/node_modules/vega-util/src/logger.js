function log(method, level, input) {
  var args = [level].concat([].slice.call(input));
  console[method].apply(console, args); // eslint-disable-line no-console
}

export var None  = 0;
export var Error = 1;
export var Warn  = 2;
export var Info  = 3;
export var Debug = 4;

export default function(_, method) {
  var level = _ || None;
  return {
    level: function(_) {
      if (arguments.length) {
        level = +_;
        return this;
      } else {
        return level;
      }
    },
    error: function() {
      if (level >= Error) log(method || 'error', 'ERROR', arguments);
      return this;
    },
    warn: function() {
      if (level >= Warn) log(method || 'warn', 'WARN', arguments);
      return this;
    },
    info: function() {
      if (level >= Info) log(method || 'log', 'INFO', arguments);
      return this;
    },
    debug: function() {
      if (level >= Debug) log(method || 'log', 'DEBUG', arguments);
      return this;
    }
  }
}

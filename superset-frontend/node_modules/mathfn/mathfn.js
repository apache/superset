
var files = ['erf', 'gamma', 'beta', 'log'];

function exportFns(fns) {
  var keys = Object.keys(fns);

  for (var n = 0, r = keys.length; n < r; n++) {
    exports[ keys[n] ] = fns[keys[n]];
  }
}

exportFns(require('./functions/beta.js'));
exportFns(require('./functions/erf.js'));
exportFns(require('./functions/gamma.js'));
exportFns(require('./functions/log.js'));

'use strict';
var browserify =  require('browserify')
  , fs         =  require('fs');

browserify()
  .require(require.resolve('./javascript-editor'), { entry: true })
  .require(require.resolve('./coffee-editor'), { entry: true })
  .require(require.resolve('./json-editor'), { entry: true })
  .require(require.resolve('./lua-editor'), { entry: true })
  .bundle({ debug: true })
  .pipe(fs.createWriteStream(__dirname + '/bundle.js'));

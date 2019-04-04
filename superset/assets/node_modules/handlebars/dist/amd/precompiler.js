define(['exports', 'async', 'fs', './handlebars', 'path', 'source-map'], function (exports, _async, _fs, _handlebars, _path, _sourceMap) {
  /* eslint-disable no-console */
  'use strict';

  // istanbul ignore next

  function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

  var _Async = _interopRequireDefault(_async);

  var _fs2 = _interopRequireDefault(_fs);

  module.exports.loadTemplates = function (opts, callback) {
    loadStrings(opts, function (err, strings) {
      if (err) {
        callback(err);
      } else {
        loadFiles(opts, function (err, files) {
          if (err) {
            callback(err);
          } else {
            opts.templates = strings.concat(files);
            callback(undefined, opts);
          }
        });
      }
    });
  };

  function loadStrings(opts, callback) {
    var strings = arrayCast(opts.string),
        names = arrayCast(opts.name);

    if (names.length !== strings.length && strings.length > 1) {
      return callback(new _handlebars.Exception('Number of names did not match the number of string inputs'));
    }

    _Async['default'].map(strings, function (string, callback) {
      if (string !== '-') {
        callback(undefined, string);
      } else {
        (function () {
          // Load from stdin
          var buffer = '';
          process.stdin.setEncoding('utf8');

          process.stdin.on('data', function (chunk) {
            buffer += chunk;
          });
          process.stdin.on('end', function () {
            callback(undefined, buffer);
          });
        })();
      }
    }, function (err, strings) {
      strings = strings.map(function (string, index) {
        return {
          name: names[index],
          path: names[index],
          source: string
        };
      });
      callback(err, strings);
    });
  }

  function loadFiles(opts, callback) {
    // Build file extension pattern
    var extension = (opts.extension || 'handlebars').replace(/[\\^$*+?.():=!|{}\-[\]]/g, function (arg) {
      return '\\' + arg;
    });
    extension = new RegExp('\\.' + extension + '$');

    var ret = [],
        queue = (opts.files || []).map(function (template) {
      return { template: template, root: opts.root };
    });
    _Async['default'].whilst(function () {
      return queue.length;
    }, function (callback) {
      var _queue$shift = queue.shift();

      var path = _queue$shift.template;
      var root = _queue$shift.root;

      _fs2['default'].stat(path, function (err, stat) {
        if (err) {
          return callback(new _handlebars.Exception('Unable to open template file "' + path + '"'));
        }

        if (stat.isDirectory()) {
          opts.hasDirectory = true;

          _fs2['default'].readdir(path, function (err, children) {
            /* istanbul ignore next : Race condition that being too lazy to test */
            if (err) {
              return callback(err);
            }
            children.forEach(function (file) {
              var childPath = path + '/' + file;

              if (extension.test(childPath) || _fs2['default'].statSync(childPath).isDirectory()) {
                queue.push({ template: childPath, root: root || path });
              }
            });

            callback();
          });
        } else {
          _fs2['default'].readFile(path, 'utf8', function (err, data) {
            /* istanbul ignore next : Race condition that being too lazy to test */
            if (err) {
              return callback(err);
            }

            if (opts.bom && data.indexOf('﻿') === 0) {
              data = data.substring(1);
            }

            // Clean the template name
            var name = path;
            if (!root) {
              name = _path.basename(name);
            } else if (name.indexOf(root) === 0) {
              name = name.substring(root.length + 1);
            }
            name = name.replace(extension, '');

            ret.push({
              path: path,
              name: name,
              source: data
            });

            callback();
          });
        }
      });
    }, function (err) {
      if (err) {
        callback(err);
      } else {
        callback(undefined, ret);
      }
    });
  }

  module.exports.cli = function (opts) {
    if (opts.version) {
      console.log(_handlebars.VERSION);
      return;
    }

    if (!opts.templates.length && !opts.hasDirectory) {
      throw new _handlebars.Exception('Must define at least one template or directory.');
    }

    if (opts.simple && opts.min) {
      throw new _handlebars.Exception('Unable to minimize simple output');
    }

    var multiple = opts.templates.length !== 1 || opts.hasDirectory;
    if (opts.simple && multiple) {
      throw new _handlebars.Exception('Unable to output multiple templates in simple mode');
    }

    // Force simple mode if we have only one template and it's unnamed.
    if (!opts.amd && !opts.commonjs && opts.templates.length === 1 && !opts.templates[0].name) {
      opts.simple = true;
    }

    // Convert the known list into a hash
    var known = {};
    if (opts.known && !Array.isArray(opts.known)) {
      opts.known = [opts.known];
    }
    if (opts.known) {
      for (var i = 0, len = opts.known.length; i < len; i++) {
        known[opts.known[i]] = true;
      }
    }

    var objectName = opts.partial ? 'Handlebars.partials' : 'templates';

    var output = new _sourceMap.SourceNode();
    if (!opts.simple) {
      if (opts.amd) {
        output.add('define([\'' + opts.handlebarPath + 'handlebars.runtime\'], function(Handlebars) {\n  Handlebars = Handlebars["default"];');
      } else if (opts.commonjs) {
        output.add('var Handlebars = require("' + opts.commonjs + '");');
      } else {
        output.add('(function() {\n');
      }
      output.add('  var template = Handlebars.template, templates = ');
      if (opts.namespace) {
        output.add(opts.namespace);
        output.add(' = ');
        output.add(opts.namespace);
        output.add(' || ');
      }
      output.add('{};\n');
    }

    opts.templates.forEach(function (template) {
      var options = {
        knownHelpers: known,
        knownHelpersOnly: opts.o
      };

      if (opts.map) {
        options.srcName = template.path;
      }
      if (opts.data) {
        options.data = true;
      }

      var precompiled = _handlebars.precompile(template.source, options);

      // If we are generating a source map, we have to reconstruct the SourceNode object
      if (opts.map) {
        var consumer = new _sourceMap.SourceMapConsumer(precompiled.map);
        precompiled = _sourceMap.SourceNode.fromStringWithSourceMap(precompiled.code, consumer);
      }

      if (opts.simple) {
        output.add([precompiled, '\n']);
      } else {
        if (!template.name) {
          throw new _handlebars.Exception('Name missing for template');
        }

        if (opts.amd && !multiple) {
          output.add('return ');
        }
        output.add([objectName, '[\'', template.name, '\'] = template(', precompiled, ');\n']);
      }
    });

    // Output the content
    if (!opts.simple) {
      if (opts.amd) {
        if (multiple) {
          output.add(['return ', objectName, ';\n']);
        }
        output.add('});');
      } else if (!opts.commonjs) {
        output.add('})();');
      }
    }

    if (opts.map) {
      output.add('\n//# sourceMappingURL=' + opts.map + '\n');
    }

    output = output.toStringWithSourceMap();
    output.map = output.map + '';

    if (opts.min) {
      output = minify(output, opts.map);
    }

    if (opts.map) {
      _fs2['default'].writeFileSync(opts.map, output.map, 'utf8');
    }
    output = output.code;

    if (opts.output) {
      _fs2['default'].writeFileSync(opts.output, output, 'utf8');
    } else {
      console.log(output);
    }
  };

  function arrayCast(value) {
    value = value != null ? value : [];
    if (!Array.isArray(value)) {
      value = [value];
    }
    return value;
  }

  /**
   * Run uglify to minify the compiled template, if uglify exists in the dependencies.
   *
   * We are using `require` instead of `import` here, because es6-modules do not allow
   * dynamic imports and uglify-js is an optional dependency. Since we are inside NodeJS here, this
   * should not be a problem.
   *
   * @param {string} output the compiled template
   * @param {string} sourceMapFile the file to write the source map to.
   */
  function minify(output, sourceMapFile) {
    try {
      // Try to resolve uglify-js in order to see if it does exist
      require.resolve('uglify-js');
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') {
        // Something else seems to be wrong
        throw e;
      }
      // it does not exist!
      console.error('Code minimization is disabled due to missing uglify-js dependency');
      return output;
    }
    return require('uglify-js').minify(output.code, {
      sourceMap: {
        content: output.map,
        url: sourceMapFile
      }
    });
  }
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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KiBlc2xpbnQtZGlzYWJsZSBuby1jb25zb2xlICovXG5pbXBvcnQgQXN5bmMgZnJvbSAnYXN5bmMnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIEhhbmRsZWJhcnMgZnJvbSAnLi9oYW5kbGViYXJzJztcbmltcG9ydCB7YmFzZW5hbWV9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHtTb3VyY2VNYXBDb25zdW1lciwgU291cmNlTm9kZX0gZnJvbSAnc291cmNlLW1hcCc7XG5cblxubW9kdWxlLmV4cG9ydHMubG9hZFRlbXBsYXRlcyA9IGZ1bmN0aW9uKG9wdHMsIGNhbGxiYWNrKSB7XG4gIGxvYWRTdHJpbmdzKG9wdHMsIGZ1bmN0aW9uKGVyciwgc3RyaW5ncykge1xuICAgIGlmIChlcnIpIHtcbiAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvYWRGaWxlcyhvcHRzLCBmdW5jdGlvbihlcnIsIGZpbGVzKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9wdHMudGVtcGxhdGVzID0gc3RyaW5ncy5jb25jYXQoZmlsZXMpO1xuICAgICAgICAgIGNhbGxiYWNrKHVuZGVmaW5lZCwgb3B0cyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG59O1xuXG5mdW5jdGlvbiBsb2FkU3RyaW5ncyhvcHRzLCBjYWxsYmFjaykge1xuICBsZXQgc3RyaW5ncyA9IGFycmF5Q2FzdChvcHRzLnN0cmluZyksXG4gICAgICBuYW1lcyA9IGFycmF5Q2FzdChvcHRzLm5hbWUpO1xuXG4gIGlmIChuYW1lcy5sZW5ndGggIT09IHN0cmluZ3MubGVuZ3RoXG4gICAgICAmJiBzdHJpbmdzLmxlbmd0aCA+IDEpIHtcbiAgICByZXR1cm4gY2FsbGJhY2sobmV3IEhhbmRsZWJhcnMuRXhjZXB0aW9uKCdOdW1iZXIgb2YgbmFtZXMgZGlkIG5vdCBtYXRjaCB0aGUgbnVtYmVyIG9mIHN0cmluZyBpbnB1dHMnKSk7XG4gIH1cblxuICBBc3luYy5tYXAoc3RyaW5ncywgZnVuY3Rpb24oc3RyaW5nLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHN0cmluZyAhPT0gJy0nKSB7XG4gICAgICAgIGNhbGxiYWNrKHVuZGVmaW5lZCwgc3RyaW5nKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIExvYWQgZnJvbSBzdGRpblxuICAgICAgICBsZXQgYnVmZmVyID0gJyc7XG4gICAgICAgIHByb2Nlc3Muc3RkaW4uc2V0RW5jb2RpbmcoJ3V0ZjgnKTtcblxuICAgICAgICBwcm9jZXNzLnN0ZGluLm9uKCdkYXRhJywgZnVuY3Rpb24oY2h1bmspIHtcbiAgICAgICAgICBidWZmZXIgKz0gY2h1bms7XG4gICAgICAgIH0pO1xuICAgICAgICBwcm9jZXNzLnN0ZGluLm9uKCdlbmQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBjYWxsYmFjayh1bmRlZmluZWQsIGJ1ZmZlcik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sXG4gICAgZnVuY3Rpb24oZXJyLCBzdHJpbmdzKSB7XG4gICAgICBzdHJpbmdzID0gc3RyaW5ncy5tYXAoKHN0cmluZywgaW5kZXgpID0+ICh7XG4gICAgICAgIG5hbWU6IG5hbWVzW2luZGV4XSxcbiAgICAgICAgcGF0aDogbmFtZXNbaW5kZXhdLFxuICAgICAgICBzb3VyY2U6IHN0cmluZ1xuICAgICAgfSkpO1xuICAgICAgY2FsbGJhY2soZXJyLCBzdHJpbmdzKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gbG9hZEZpbGVzKG9wdHMsIGNhbGxiYWNrKSB7XG4gIC8vIEJ1aWxkIGZpbGUgZXh0ZW5zaW9uIHBhdHRlcm5cbiAgbGV0IGV4dGVuc2lvbiA9IChvcHRzLmV4dGVuc2lvbiB8fCAnaGFuZGxlYmFycycpLnJlcGxhY2UoL1tcXFxcXiQqKz8uKCk6PSF8e31cXC1bXFxdXS9nLCBmdW5jdGlvbihhcmcpIHsgcmV0dXJuICdcXFxcJyArIGFyZzsgfSk7XG4gIGV4dGVuc2lvbiA9IG5ldyBSZWdFeHAoJ1xcXFwuJyArIGV4dGVuc2lvbiArICckJyk7XG5cbiAgbGV0IHJldCA9IFtdLFxuICAgICAgcXVldWUgPSAob3B0cy5maWxlcyB8fCBbXSkubWFwKCh0ZW1wbGF0ZSkgPT4gKHt0ZW1wbGF0ZSwgcm9vdDogb3B0cy5yb290fSkpO1xuICBBc3luYy53aGlsc3QoKCkgPT4gcXVldWUubGVuZ3RoLCBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIGxldCB7dGVtcGxhdGU6IHBhdGgsIHJvb3R9ID0gcXVldWUuc2hpZnQoKTtcblxuICAgIGZzLnN0YXQocGF0aCwgZnVuY3Rpb24oZXJyLCBzdGF0KSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhuZXcgSGFuZGxlYmFycy5FeGNlcHRpb24oYFVuYWJsZSB0byBvcGVuIHRlbXBsYXRlIGZpbGUgXCIke3BhdGh9XCJgKSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChzdGF0LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgb3B0cy5oYXNEaXJlY3RvcnkgPSB0cnVlO1xuXG4gICAgICAgIGZzLnJlYWRkaXIocGF0aCwgZnVuY3Rpb24oZXJyLCBjaGlsZHJlbikge1xuICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0IDogUmFjZSBjb25kaXRpb24gdGhhdCBiZWluZyB0b28gbGF6eSB0byB0ZXN0ICovXG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24oZmlsZSkge1xuICAgICAgICAgICAgbGV0IGNoaWxkUGF0aCA9IHBhdGggKyAnLycgKyBmaWxlO1xuXG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9uLnRlc3QoY2hpbGRQYXRoKSB8fCBmcy5zdGF0U3luYyhjaGlsZFBhdGgpLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgcXVldWUucHVzaCh7dGVtcGxhdGU6IGNoaWxkUGF0aCwgcm9vdDogcm9vdCB8fCBwYXRofSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZzLnJlYWRGaWxlKHBhdGgsICd1dGY4JywgZnVuY3Rpb24oZXJyLCBkYXRhKSB7XG4gICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgOiBSYWNlIGNvbmRpdGlvbiB0aGF0IGJlaW5nIHRvbyBsYXp5IHRvIHRlc3QgKi9cbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAob3B0cy5ib20gJiYgZGF0YS5pbmRleE9mKCdcXHVGRUZGJykgPT09IDApIHtcbiAgICAgICAgICAgIGRhdGEgPSBkYXRhLnN1YnN0cmluZygxKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBDbGVhbiB0aGUgdGVtcGxhdGUgbmFtZVxuICAgICAgICAgIGxldCBuYW1lID0gcGF0aDtcbiAgICAgICAgICBpZiAoIXJvb3QpIHtcbiAgICAgICAgICAgIG5hbWUgPSBiYXNlbmFtZShuYW1lKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKG5hbWUuaW5kZXhPZihyb290KSA9PT0gMCkge1xuICAgICAgICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyaW5nKHJvb3QubGVuZ3RoICsgMSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIG5hbWUgPSBuYW1lLnJlcGxhY2UoZXh0ZW5zaW9uLCAnJyk7XG5cbiAgICAgICAgICByZXQucHVzaCh7XG4gICAgICAgICAgICBwYXRoOiBwYXRoLFxuICAgICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICAgIHNvdXJjZTogZGF0YVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIGZ1bmN0aW9uKGVycikge1xuICAgIGlmIChlcnIpIHtcbiAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxiYWNrKHVuZGVmaW5lZCwgcmV0KTtcbiAgICB9XG4gIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cy5jbGkgPSBmdW5jdGlvbihvcHRzKSB7XG4gIGlmIChvcHRzLnZlcnNpb24pIHtcbiAgICBjb25zb2xlLmxvZyhIYW5kbGViYXJzLlZFUlNJT04pO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmICghb3B0cy50ZW1wbGF0ZXMubGVuZ3RoICYmICFvcHRzLmhhc0RpcmVjdG9yeSkge1xuICAgIHRocm93IG5ldyBIYW5kbGViYXJzLkV4Y2VwdGlvbignTXVzdCBkZWZpbmUgYXQgbGVhc3Qgb25lIHRlbXBsYXRlIG9yIGRpcmVjdG9yeS4nKTtcbiAgfVxuXG4gIGlmIChvcHRzLnNpbXBsZSAmJiBvcHRzLm1pbikge1xuICAgIHRocm93IG5ldyBIYW5kbGViYXJzLkV4Y2VwdGlvbignVW5hYmxlIHRvIG1pbmltaXplIHNpbXBsZSBvdXRwdXQnKTtcbiAgfVxuXG4gIGNvbnN0IG11bHRpcGxlID0gb3B0cy50ZW1wbGF0ZXMubGVuZ3RoICE9PSAxIHx8IG9wdHMuaGFzRGlyZWN0b3J5O1xuICBpZiAob3B0cy5zaW1wbGUgJiYgbXVsdGlwbGUpIHtcbiAgICB0aHJvdyBuZXcgSGFuZGxlYmFycy5FeGNlcHRpb24oJ1VuYWJsZSB0byBvdXRwdXQgbXVsdGlwbGUgdGVtcGxhdGVzIGluIHNpbXBsZSBtb2RlJyk7XG4gIH1cblxuICAvLyBGb3JjZSBzaW1wbGUgbW9kZSBpZiB3ZSBoYXZlIG9ubHkgb25lIHRlbXBsYXRlIGFuZCBpdCdzIHVubmFtZWQuXG4gIGlmICghb3B0cy5hbWQgJiYgIW9wdHMuY29tbW9uanMgJiYgb3B0cy50ZW1wbGF0ZXMubGVuZ3RoID09PSAxXG4gICAgICAmJiAhb3B0cy50ZW1wbGF0ZXNbMF0ubmFtZSkge1xuICAgIG9wdHMuc2ltcGxlID0gdHJ1ZTtcbiAgfVxuXG4gIC8vIENvbnZlcnQgdGhlIGtub3duIGxpc3QgaW50byBhIGhhc2hcbiAgbGV0IGtub3duID0ge307XG4gIGlmIChvcHRzLmtub3duICYmICFBcnJheS5pc0FycmF5KG9wdHMua25vd24pKSB7XG4gICAgb3B0cy5rbm93biA9IFtvcHRzLmtub3duXTtcbiAgfVxuICBpZiAob3B0cy5rbm93bikge1xuICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBvcHRzLmtub3duLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBrbm93bltvcHRzLmtub3duW2ldXSA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgY29uc3Qgb2JqZWN0TmFtZSA9IG9wdHMucGFydGlhbCA/ICdIYW5kbGViYXJzLnBhcnRpYWxzJyA6ICd0ZW1wbGF0ZXMnO1xuXG4gIGxldCBvdXRwdXQgPSBuZXcgU291cmNlTm9kZSgpO1xuICBpZiAoIW9wdHMuc2ltcGxlKSB7XG4gICAgaWYgKG9wdHMuYW1kKSB7XG4gICAgICBvdXRwdXQuYWRkKCdkZWZpbmUoW1xcJycgKyBvcHRzLmhhbmRsZWJhclBhdGggKyAnaGFuZGxlYmFycy5ydW50aW1lXFwnXSwgZnVuY3Rpb24oSGFuZGxlYmFycykge1xcbiAgSGFuZGxlYmFycyA9IEhhbmRsZWJhcnNbXCJkZWZhdWx0XCJdOycpO1xuICAgIH0gZWxzZSBpZiAob3B0cy5jb21tb25qcykge1xuICAgICAgb3V0cHV0LmFkZCgndmFyIEhhbmRsZWJhcnMgPSByZXF1aXJlKFwiJyArIG9wdHMuY29tbW9uanMgKyAnXCIpOycpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdXRwdXQuYWRkKCcoZnVuY3Rpb24oKSB7XFxuJyk7XG4gICAgfVxuICAgIG91dHB1dC5hZGQoJyAgdmFyIHRlbXBsYXRlID0gSGFuZGxlYmFycy50ZW1wbGF0ZSwgdGVtcGxhdGVzID0gJyk7XG4gICAgaWYgKG9wdHMubmFtZXNwYWNlKSB7XG4gICAgICBvdXRwdXQuYWRkKG9wdHMubmFtZXNwYWNlKTtcbiAgICAgIG91dHB1dC5hZGQoJyA9ICcpO1xuICAgICAgb3V0cHV0LmFkZChvcHRzLm5hbWVzcGFjZSk7XG4gICAgICBvdXRwdXQuYWRkKCcgfHwgJyk7XG4gICAgfVxuICAgIG91dHB1dC5hZGQoJ3t9O1xcbicpO1xuICB9XG5cbiAgb3B0cy50ZW1wbGF0ZXMuZm9yRWFjaChmdW5jdGlvbih0ZW1wbGF0ZSkge1xuICAgIGxldCBvcHRpb25zID0ge1xuICAgICAga25vd25IZWxwZXJzOiBrbm93bixcbiAgICAgIGtub3duSGVscGVyc09ubHk6IG9wdHMub1xuICAgIH07XG5cbiAgICBpZiAob3B0cy5tYXApIHtcbiAgICAgIG9wdGlvbnMuc3JjTmFtZSA9IHRlbXBsYXRlLnBhdGg7XG4gICAgfVxuICAgIGlmIChvcHRzLmRhdGEpIHtcbiAgICAgIG9wdGlvbnMuZGF0YSA9IHRydWU7XG4gICAgfVxuXG4gICAgbGV0IHByZWNvbXBpbGVkID0gSGFuZGxlYmFycy5wcmVjb21waWxlKHRlbXBsYXRlLnNvdXJjZSwgb3B0aW9ucyk7XG5cbiAgICAvLyBJZiB3ZSBhcmUgZ2VuZXJhdGluZyBhIHNvdXJjZSBtYXAsIHdlIGhhdmUgdG8gcmVjb25zdHJ1Y3QgdGhlIFNvdXJjZU5vZGUgb2JqZWN0XG4gICAgaWYgKG9wdHMubWFwKSB7XG4gICAgICBsZXQgY29uc3VtZXIgPSBuZXcgU291cmNlTWFwQ29uc3VtZXIocHJlY29tcGlsZWQubWFwKTtcbiAgICAgIHByZWNvbXBpbGVkID0gU291cmNlTm9kZS5mcm9tU3RyaW5nV2l0aFNvdXJjZU1hcChwcmVjb21waWxlZC5jb2RlLCBjb25zdW1lcik7XG4gICAgfVxuXG4gICAgaWYgKG9wdHMuc2ltcGxlKSB7XG4gICAgICBvdXRwdXQuYWRkKFtwcmVjb21waWxlZCwgJ1xcbiddKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCF0ZW1wbGF0ZS5uYW1lKSB7XG4gICAgICAgIHRocm93IG5ldyBIYW5kbGViYXJzLkV4Y2VwdGlvbignTmFtZSBtaXNzaW5nIGZvciB0ZW1wbGF0ZScpO1xuICAgICAgfVxuXG4gICAgICBpZiAob3B0cy5hbWQgJiYgIW11bHRpcGxlKSB7XG4gICAgICAgIG91dHB1dC5hZGQoJ3JldHVybiAnKTtcbiAgICAgIH1cbiAgICAgIG91dHB1dC5hZGQoW29iamVjdE5hbWUsICdbXFwnJywgdGVtcGxhdGUubmFtZSwgJ1xcJ10gPSB0ZW1wbGF0ZSgnLCBwcmVjb21waWxlZCwgJyk7XFxuJ10pO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gT3V0cHV0IHRoZSBjb250ZW50XG4gIGlmICghb3B0cy5zaW1wbGUpIHtcbiAgICBpZiAob3B0cy5hbWQpIHtcbiAgICAgIGlmIChtdWx0aXBsZSkge1xuICAgICAgICBvdXRwdXQuYWRkKFsncmV0dXJuICcsIG9iamVjdE5hbWUsICc7XFxuJ10pO1xuICAgICAgfVxuICAgICAgb3V0cHV0LmFkZCgnfSk7Jyk7XG4gICAgfSBlbHNlIGlmICghb3B0cy5jb21tb25qcykge1xuICAgICAgb3V0cHV0LmFkZCgnfSkoKTsnKTtcbiAgICB9XG4gIH1cblxuICBpZiAob3B0cy5tYXApIHtcbiAgICBvdXRwdXQuYWRkKCdcXG4vLyMgc291cmNlTWFwcGluZ1VSTD0nICsgb3B0cy5tYXAgKyAnXFxuJyk7XG4gIH1cblxuICBvdXRwdXQgPSBvdXRwdXQudG9TdHJpbmdXaXRoU291cmNlTWFwKCk7XG4gIG91dHB1dC5tYXAgPSBvdXRwdXQubWFwICsgJyc7XG5cbiAgaWYgKG9wdHMubWluKSB7XG4gICAgb3V0cHV0ID0gbWluaWZ5KG91dHB1dCwgb3B0cy5tYXApO1xuICB9XG5cbiAgaWYgKG9wdHMubWFwKSB7XG4gICAgZnMud3JpdGVGaWxlU3luYyhvcHRzLm1hcCwgb3V0cHV0Lm1hcCwgJ3V0ZjgnKTtcbiAgfVxuICBvdXRwdXQgPSBvdXRwdXQuY29kZTtcblxuICBpZiAob3B0cy5vdXRwdXQpIHtcbiAgICBmcy53cml0ZUZpbGVTeW5jKG9wdHMub3V0cHV0LCBvdXRwdXQsICd1dGY4Jyk7XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS5sb2cob3V0cHV0KTtcbiAgfVxufTtcblxuZnVuY3Rpb24gYXJyYXlDYXN0KHZhbHVlKSB7XG4gIHZhbHVlID0gdmFsdWUgIT0gbnVsbCA/IHZhbHVlIDogW107XG4gIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICB2YWx1ZSA9IFt2YWx1ZV07XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuXG4vKipcbiAqIFJ1biB1Z2xpZnkgdG8gbWluaWZ5IHRoZSBjb21waWxlZCB0ZW1wbGF0ZSwgaWYgdWdsaWZ5IGV4aXN0cyBpbiB0aGUgZGVwZW5kZW5jaWVzLlxuICpcbiAqIFdlIGFyZSB1c2luZyBgcmVxdWlyZWAgaW5zdGVhZCBvZiBgaW1wb3J0YCBoZXJlLCBiZWNhdXNlIGVzNi1tb2R1bGVzIGRvIG5vdCBhbGxvd1xuICogZHluYW1pYyBpbXBvcnRzIGFuZCB1Z2xpZnktanMgaXMgYW4gb3B0aW9uYWwgZGVwZW5kZW5jeS4gU2luY2Ugd2UgYXJlIGluc2lkZSBOb2RlSlMgaGVyZSwgdGhpc1xuICogc2hvdWxkIG5vdCBiZSBhIHByb2JsZW0uXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IG91dHB1dCB0aGUgY29tcGlsZWQgdGVtcGxhdGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBzb3VyY2VNYXBGaWxlIHRoZSBmaWxlIHRvIHdyaXRlIHRoZSBzb3VyY2UgbWFwIHRvLlxuICovXG5mdW5jdGlvbiBtaW5pZnkob3V0cHV0LCBzb3VyY2VNYXBGaWxlKSB7XG4gIHRyeSB7XG4gICAgLy8gVHJ5IHRvIHJlc29sdmUgdWdsaWZ5LWpzIGluIG9yZGVyIHRvIHNlZSBpZiBpdCBkb2VzIGV4aXN0XG4gICAgcmVxdWlyZS5yZXNvbHZlKCd1Z2xpZnktanMnKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGlmIChlLmNvZGUgIT09ICdNT0RVTEVfTk9UX0ZPVU5EJykge1xuICAgICAgLy8gU29tZXRoaW5nIGVsc2Ugc2VlbXMgdG8gYmUgd3JvbmdcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICAgIC8vIGl0IGRvZXMgbm90IGV4aXN0IVxuICAgIGNvbnNvbGUuZXJyb3IoJ0NvZGUgbWluaW1pemF0aW9uIGlzIGRpc2FibGVkIGR1ZSB0byBtaXNzaW5nIHVnbGlmeS1qcyBkZXBlbmRlbmN5Jyk7XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxuICByZXR1cm4gcmVxdWlyZSgndWdsaWZ5LWpzJykubWluaWZ5KG91dHB1dC5jb2RlLCB7XG4gICAgc291cmNlTWFwOiB7XG4gICAgICBjb250ZW50OiBvdXRwdXQubWFwLFxuICAgICAgdXJsOiBzb3VyY2VNYXBGaWxlXG4gICAgfVxuICB9KTtcbn1cbiJdfQ==

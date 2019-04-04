var _ = require("underscore"),
    colors = require("colors");


function ArgParser() {
   this.commands = {};  // expected commands
   this.specs = {};     // option specifications
}

ArgParser.prototype = {
  /* Add a command to the expected commands */
  command : function(name) {
    var command;
    if (name) {
      command = this.commands[name] = {
        name: name,
        specs: {}
      };
    }
    else {
      command = this.fallback = {
        specs: {}
      };
    }

    // facilitates command('name').options().cb().help()
    var chain = {
      options : function(specs) {
        command.specs = specs;
        return chain;
      },
      opts : function(specs) {
        // old API
        return this.options(specs);
      },
      option : function(name, spec) {
        command.specs[name] = spec;
        return chain;
      },
      callback : function(cb) {
        command.cb = cb;
        return chain;
      },
      help : function(help) {
        command.help = help;
        return chain;
      },
      usage : function(usage) {
        command._usage = usage;
        return chain;
      }
    };
    return chain;
  },

  nocommand : function() {
    return this.command();
  },

  options : function(specs) {
    this.specs = specs;
    return this;
  },

  opts : function(specs) {
    // old API
    return this.options(specs);
  },

  globalOpts : function(specs) {
    // old API
    return this.options(specs);
  },

  option : function(name, spec) {
    this.specs[name] = spec;
    return this;
  },

  usage : function(usage) {
    this._usage = usage;
    return this;
  },

  printer : function(print) {
    this.print = print;
    return this;
  },

  script : function(script) {
    this._script = script;
    return this;
  },

  scriptName : function(script) {
    // old API
    return this.script(script);
  },

  help : function(help) {
    this._help = help;
    return this;
  },

  colors: function() {
    // deprecated - colors are on by default now
    return this;
  },

  nocolors : function() {
    this._nocolors = true;
    return this;
  },

  parseArgs : function(argv) {
    // old API
    return this.parse(argv);
  },

  nom : function(argv) {
    return this.parse(argv);
  },

  parse : function(argv) {
    this.print = this.print || function(str, code) {
      console.log(str);
      process.exit(code || 0);
    };
    this._help = this._help || "";
    this._script = this._script || process.argv[0] + " "
          + require('path').basename(process.argv[1]);
    this.specs = this.specs || {};

    var argv = argv || process.argv.slice(2);

    var arg = Arg(argv[0]).isValue && argv[0],
        command = arg && this.commands[arg],
        commandExpected = !_(this.commands).isEmpty();

    if (commandExpected) {
       if (command) {
          _(this.specs).extend(command.specs);
          this._script += " " + command.name;
          if (command.help) {
            this._help = command.help;
          }
          this.command = command;
       }
       else if (arg) {
          return this.print(this._script + ": no such command '" + arg + "'", 1);
       }
       else {
          // no command but command expected e.g. 'git -v'
          var helpStringBuilder = {
            list : function() {
               return 'one of: ' + _(this.commands).keys().join(", ");
            },
            twoColumn : function() {
              // find the longest command name to ensure horizontal alignment
              var maxLength = _(this.commands).max(function (cmd) {
                return cmd.name.length;
              }).name.length;

              // create the two column text strings
              var cmdHelp = _.map(this.commands, function(cmd, name) {
                var diff = maxLength - name.length;
                var pad = new Array(diff + 4).join(" ");
                return "  " + [ name, pad, cmd.help ].join(" ");
              });
              return "\n" + cmdHelp.join("\n");
            }
          };

          // if there are a small number of commands and all have help strings,
          // display them in a two column table; otherwise use the brief version.
          // The arbitrary choice of "20" comes from the number commands git
          // displays as "common commands"
          var helpType = 'list';
          if (_(this.commands).size() <= 20) {
            if (_(this.commands).every(function (cmd) { return cmd.help; })) {
                helpType = 'twoColumn';
            }
          }

          this.specs.command = {
            position: 0,
            help: helpStringBuilder[helpType].call(this)
          }

          if (this.fallback) {
            _(this.specs).extend(this.fallback.specs);
            this._help = this.fallback.help;
          } else {
            this.specs.command.required = true;
          }
       }
    }

    if (this.specs.length === undefined) {
      // specs is a hash not an array
      this.specs = _(this.specs).map(function(opt, name) {
        opt.name = name;
        return opt;
      });
    }
    this.specs = this.specs.map(function(opt) {
      return Opt(opt);
    });

    if (argv.indexOf("--help") >= 0 || argv.indexOf("-h") >= 0) {
      return this.print(this.getUsage());
    }

    var options = {};
    var args = argv.map(function(arg) {
      return Arg(arg);
    })
    .concat(Arg());

    var positionals = [];

    /* parse the args */
    var that = this;
    args.reduce(function(arg, val) {
      /* positional */
      if (arg.isValue) {
        positionals.push(arg.value);
      }
      else if (arg.chars) {
        var last = arg.chars.pop();

        /* -cfv */
        (arg.chars).forEach(function(ch) {
          that.setOption(options, ch, true);
        });

        /* -v key */
        if (!that.opt(last).flag) {
           if (val.isValue)  {
              that.setOption(options, last, val.value);
              return Arg(); // skip next turn - swallow arg
           }
           else {
              that.print("'-" + (that.opt(last).name || last) + "'"
                + " expects a value\n\n" + that.getUsage(), 1);
           }
        }
        else {
          /* -v */
          that.setOption(options, last, true);
        }

      }
      else if (arg.full) {
        var value = arg.value;

        /* --key */
        if (value === undefined) {
          /* --key value */
          if (!that.opt(arg.full).flag) {
            if (val.isValue) {
              that.setOption(options, arg.full, val.value);
              return Arg();
            }
            else {
              that.print("'--" + (that.opt(arg.full).name || arg.full) + "'"
                + " expects a value\n\n" + that.getUsage(), 1);
            }
          }
          else {
            /* --flag */
            value = true;
          }
        }
        that.setOption(options, arg.full, value);
      }
      return val;
    });

    positionals.forEach(function(pos, index) {
      this.setOption(options, index, pos);
    }, this);

    options._ = positionals;

    this.specs.forEach(function(opt) {
      if (opt.default !== undefined && options[opt.name] === undefined) {
        options[opt.name] = opt.default;
      }
    }, this);

    // exit if required arg isn't present
    this.specs.forEach(function(opt) {
      if (opt.required && options[opt.name] === undefined) {
         var msg = opt.name + " argument is required";
         msg = this._nocolors ? msg : msg.red;

         this.print("\n" + msg + "\n" + this.getUsage(), 1);
      }
    }, this);

    if (command && command.cb) {
      command.cb(options);
    }
    else if (this.fallback && this.fallback.cb) {
      this.fallback.cb(options);
    }

    return options;
  },

  getUsage : function() {
    if (this.command && this.command._usage) {
      return this.command._usage;
    }
    else if (this.fallback && this.fallback._usage) {
      return this.fallback._usage;
    }
    if (this._usage) {
      return this._usage;
    }

    // todo: use a template
    var str = "\n"
    if (!this._nocolors) {
      str += "Usage:".bold;
    }
    else {
      str += "Usage:";
    }
    str += " " + this._script;

    var positionals = _(this.specs).select(function(opt) {
      return opt.position != undefined;
    })
    positionals = _(positionals).sortBy(function(opt) {
      return opt.position;
    });
    var options = _(this.specs).select(function(opt) {
      return opt.position === undefined;
    });

    // assume there are no gaps in the specified pos. args
    positionals.forEach(function(pos) {
      str += " ";
      var posStr = pos.string;
      if (!posStr) {
        posStr = pos.name || "arg" + pos.position;
        if (pos.required) {
            posStr = "<" + posStr + ">";
        } else {
            posStr = "[" + posStr + "]";
        }
        if (pos.list) {
          posStr += "...";
        }
      }
      str += posStr;
    });

    if (options.length) {
      if (!this._nocolors) {
        // must be a better way to do this
        str += " [options]".blue;
      }
      else {
        str += " [options]";
      }
    }

    if (options.length || positionals.length) {
      str += "\n\n";
    }

    function spaces(length) {
      var spaces = "";
      for (var i = 0; i < length; i++) {
        spaces += " ";
      }
      return spaces;
    }
    var longest = positionals.reduce(function(max, pos) {
      return pos.name.length > max ? pos.name.length : max;
    }, 0);

    positionals.forEach(function(pos) {
      var posStr = pos.string || pos.name;
      str += posStr + spaces(longest - posStr.length) + "     ";
      if (!this._nocolors) {
        str += (pos.help || "").grey
      }
      else {
        str += (pos.help || "")
      }
      str += "\n";
    }, this);
    if (positionals.length && options.length) {
      str += "\n";
    }

    if (options.length) {
      if (!this._nocolors) {
        str += "Options:".blue;
      }
      else {
        str += "Options:";
      }
      str += "\n"

      var longest = options.reduce(function(max, opt) {
        return opt.string.length > max && !opt.hidden ? opt.string.length : max;
      }, 0);

      options.forEach(function(opt) {
        if (!opt.hidden) {
          str += "   " + opt.string + spaces(longest - opt.string.length) + "   ";

          var defaults = (opt.default != null ? "  [" + opt.default + "]" : "");
          var help = opt.help ? opt.help + defaults : "";
          str += this._nocolors ? help: help.grey;

          str += "\n";
        }
      }, this);
    }

    if (this._help) {
      str += "\n" + this._help;
    }
    return str;
  }
};

ArgParser.prototype.opt = function(arg) {
  // get the specified opt for this parsed arg
  var match = Opt({});
  this.specs.forEach(function(opt) {
    if (opt.matches(arg)) {
       match = opt;
    }
  });
  return match;
};

ArgParser.prototype.setOption = function(options, arg, value) {
  var option = this.opt(arg);
  if (option.callback) {
    var message = option.callback(value);

    if (typeof message == "string") {
      this.print(message, 1);
    }
  }

  if (option.type != "string") {
     try {
       // infer type by JSON parsing the string
       value = JSON.parse(value)
     }
     catch(e) {}
  }

  var name = option.name || arg;
  if (option.choices && option.choices.indexOf(value) == -1) {
     this.print(name + " must be one of: " + option.choices.join(", "), 1);
  }

  if (option.list) {
    if (!options[name]) {
      options[name] = [value];
    }
    else {
      options[name].push(value);
    }
  }
  else {
    options[name] = value;
  }
};


/* an arg is an item that's actually parsed from the command line
   e.g. "-l", "log.txt", or "--logfile=log.txt" */
Arg = function(str) {
  var abbrRegex = /^\-(\w+?)$/,
      fullRegex = /^\-\-(no\-)?(.+?)(?:=(.+))?$/,
      valRegex = /^[^\-].*/;

  var charMatch = abbrRegex.exec(str),
      chars = charMatch && charMatch[1].split("");

  var fullMatch = fullRegex.exec(str),
      full = fullMatch && fullMatch[2];

  var isValue = str !== undefined && (str === "" || valRegex.test(str));
  var value;
  if (isValue) {
    value = str;
  }
  else if (full) {
    value = fullMatch[1] ? false : fullMatch[3];
  }

  return {
    str: str,
    chars: chars,
    full: full,
    value: value,
    isValue: isValue
  }
}


/* an opt is what's specified by the user in opts hash */
Opt = function(opt) {
  var strings = (opt.string || "").split(","),
      abbr, full, metavar;
  for (var i = 0; i < strings.length; i++) {
    var string = strings[i].trim(),
        matches;
    if (matches = string.match(/^\-([^-])(?:\s+(.*))?$/)) {
      abbr = matches[1];
      metavar = matches[2];
    }
    else if (matches = string.match(/^\-\-(.+?)(?:[=\s]+(.+))?$/)) {
      full = matches[1];
      metavar = metavar || matches[2];
    }
  }

  matches = matches || [];
  var abbr = opt.abbr || abbr,   // e.g. v from -v
      full = opt.full || full, // e.g. verbose from --verbose
      metavar = opt.metavar || metavar;  // e.g. PATH from '--config=PATH'

  var string;
  if (opt.string) {
    string = opt.string;
  }
  else if (opt.position === undefined) {
    string = "";
    if (abbr) {
      string += "-" + abbr;
      if (metavar)
        string += " " + metavar
      string += ", ";
    }
    string += "--" + (full || opt.name);
    if (metavar) {
      string += " " + metavar;
    }
  }

  opt = _(opt).extend({
    name: opt.name || full || abbr,
    string: string,
    abbr: abbr,
    full: full,
    metavar: metavar,
    matches: function(arg) {
      return opt.full == arg || opt.abbr == arg || opt.position == arg
        || opt.name == arg || (opt.list && arg >= opt.position);
    }
  });
  return opt;
}


var createParser = function() {
  return new ArgParser();
}

var nomnom = createParser();

for (var i in nomnom) {
  if (typeof nomnom[i] == "function") {
     createParser[i] = _(nomnom[i]).bind(nomnom);
  }
}

module.exports = createParser;

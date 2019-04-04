# nomnom
nomnom is an option parser for node. It noms your args and gives them back to you in a hash.

```javascript
var opts = require("nomnom")
   .option('debug', {
      abbr: 'd',
      flag: true,
      help: 'Print debugging info'
   })
   .option('config', {
      abbr: 'c',
      default: 'config.json',
      help: 'JSON file with tests to run'
   })
   .option('version', {
      flag: true,
      help: 'print version and exit',
      callback: function() {
         return "version 1.2.4";
      }
   })
   .parse();

if (opts.debug)
   // do stuff
```

You don't have to specify anything if you don't want to:

```javascript
var opts = require("nomnom").parse();

var url = opts[0];     // get the first positional arg
var file = opts.file   // see if --file was specified
var verbose = opts.v   // see if -v was specified
var extras = opts._    // get an array of the unmatched, positional args
```

# Install
for [node.js](http://nodejs.org/) and [npm](http://github.com/isaacs/npm):

	npm install nomnom

# More Details
Nomnom supports args like `-d`, `--debug`, `--no-debug`, `--file=test.txt`, `--file test.txt`, `-f test.txt`, `-xvf`, and positionals. Positionals are arguments that don't fit the `-a` or `--atomic` format and aren't attached to an option.

Values are JSON parsed, so `--debug=true --count=3 --file=log.txt` would give you:

```
{
   "debug": true,
   "count": 3,
   "file": "log.txt"
}
```

# Commands
Nomnom supports command-based interfaces (e.g. with git: `git add -p` and `git rebase -i` where `add` and `rebase` are the commands):

```javascript
var parser = require("nomnom");

parser.command('browser')
   .callback(function(opts) {
      runBrowser(opts.url);
   })
   .help("run browser tests");

parser.command('sanity')
   .option('outfile', {
      abbr: 'o',
      help: "file to write results to"
   })
   .option('config', {
      abbr: 'c',
      default: 'config.json',
      help: "json manifest of tests to run"
   })
   .callback(function(opts) {
      runSanity(opts.filename);
   })
   .help("run the sanity tests")

parser.parse();
```

Each command generates its own usage message when `-h` or `--help` is specified with the command.

# Usage
Nomnom prints out a usage message if `--help` or `-h` is an argument. Usage for these options in `test.js`:

```javascript
var opts = require("nomnom")
   .script("runtests")
   .options({
      path: {
         position: 0,
         help: "Test file to run",
         list: true
      },
      config: {
         abbr: 'c',
         metavar: 'FILE',
         help: "Config file with tests to run"
      },
      debug: {
         abbr: 'd',
         flag: true,
         help: "Print debugging info"
      }
   }).parse();
```

...would look like this:

	usage: runtests <path>... [options]

	path     Test file to run

	options:
	   -c FILE, --config FILE   Config file with tests to run
	   -d, --debug              Print debugging info

# Options
You can either add a specification for an option with `nomnom.option('name', spec)` or pass the specifications to `nomnom.options()` as a hash keyed on option name. Each option specification can have the following fields:

#### abbr and full
`abbr` is the single character string to match to this option, `full` is the full-length string (defaults to the name of the option).

This option matches `-d` and `--debug` on the command line:

```javascript
nomnom.option('debug', {
   abbr: 'd'
})
```

This option matches `-n 3`, `--num-lines 12` on the command line:

```javascript
nomnom.option('numLines', {
   abbr: 'n',
   full: 'num-lines'
})
```

#### flag

If this is set to true, the option acts as a flag and doesn't swallow the next value on the command line. Default is `false`, so normally if you had a command line `--config test.js`, `config` would get a value of `test.js` in the options hash. Whereas if you specify:

```javascript
nomnom.option('config', {
   flag: true
})
```

`config` would get a value of `true` in the options hash, and `test.js` would be a free positional arg.

#### metavar

`metavar` is used in the usage printout e.g. `"PATH"` in `"-f PATH, --file PATH"`.

#### string

A shorthand for `abbr`, `full`, and `metavar`. For example, to attach an option to `-c` and `--config` use a `string: "-c FILE, --config=FILE"`

#### help

A string description of the option for the usage printout.

#### default

The value to give the option if it's not specified in the arguments.

#### type

If you don't want the option JSON-parsed, specify type `"string"`.

#### callback

A callback that will be executed as soon as the option is encountered. If the callback returns a string it will print the string and exit:

```javascript
nomnom.option('count', {
   callback: function(count) {
      if (count != parseInt(count)) {
         return "count must be an integer";
      }
   }
})
```

#### position

The position of the option if it's a positional argument. If the option should be matched to the first positional arg use position `0`, etc.

#### list

Specifies that the option is a list. Appending can be achieved by specifying the arg more than once on the command line:

	node test.js --file=test1.js --file=test2.js

If the option has a `position` and `list` is `true`, all positional args including and after `position` will be appended to the array.

#### required

If this is set to `true` and the option isn't in the args, a message will be printed and the program will exit.

#### choices

A list of the possible values for the option (e.g. `['run', 'test', 'open']`). If the parsed value isn't in the list a message will be printed and the program will exit.

#### transform

A function that takes the value of the option as entered and returns a new value that will be seen as the value of the option.

```javascript
nomnom.option('date', {
   abbr: 'd',
   transform: function(timestamp) {
     return new Date(timestamp);
   }
})
```

#### hidden

Option won't be printed in the usage


# Parser interface
`require("nomnom")` will give you the option parser. You can also make an instance of a parser with `require("nomnom")()`. You can chain any of these functions off of a parser:

#### option

Add an option specification with the given name:

```javascript
nomnom.option('debug', {
   abbr: 'd',
   flag: true,
   help: "Print debugging info"
})
```

#### options

Add options as a hash keyed by option name, good for a cli with tons of options like [this example](http://github.com/harthur/replace/blob/master/bin/replace.js):

```javascript
nomnom.options({
   debug: {
      abbr: 'd',
      flag: true,
      help: "Print debugging info"
   },
   fruit: {
      help: "Fruit to buy"
   }
})
```

#### usage

The string that will override the default generated usage message.

#### help

A string that is appended to the usage.

#### script

Nomnom can't detect the alias used to run your script. You can use `script` to provide the correct name for the usage printout instead of e.g. `node test.js`.

#### printer

Overrides the usage printing function.

#### command

Takes a command name and gives you a command object on which you can chain command options.

#### nocommand

Gives a command object that will be used when no command is called.

#### nocolors

Disables coloring of the usage message.

#### parse

Parses node's `process.argv` and returns the parsed options hash. You can also provide argv:

```javascript
var opts = nomnom.parse(["-xvf", "--atomic=true"])
```

#### nom

The same as `parse()`.

# Command interface
A command is specified with `nomnom.command('name')`. All these functions can be chained on a command:

#### option

Add an option specifically for this command.

#### options

Add options for this command as a hash of options keyed by name.

#### callback

A callback that will be called with the parsed options when the command is used.

#### help

A help string describing the function of this command.

#### usage

Override the default generated usage string for this command.

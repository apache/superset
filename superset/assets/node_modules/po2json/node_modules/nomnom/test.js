var opts = require("./nomnom")
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

if (opts.debug) {
  console.log("debug")
}

/* eslint-env node */

const prompt = require("prompt");
const open = require("open");
const argv = require("yargs").argv;

// user confirmation required!
prompt.start();

// disable prefix message & colors
prompt.message = "";
prompt.delimiter = "";
prompt.colors = false;

// wait for user confirmation
prompt.get({
  properties: {

    // setup the dialog
    confirm: {
      // allow yes, no, y, n, YES, NO, Y, N as answer
      pattern: /^(yes|no|y|n)$/gi,
      description: "Would you like to open the detailed reports now?",
      message: "Type yes/no",
      required: true,
      default: "yes"
    }
  }
}, function(err, result) {
  // transform to lower case
  var c = result.confirm.toLowerCase();

  // yes or y typed ? otherwise abort
  if (c != "y" && c != "yes") {
    // console.log("ABORT");
    return;
  }

  // your code
  // console.log("Action confirmed");
  open(argv.reportsurl);

});

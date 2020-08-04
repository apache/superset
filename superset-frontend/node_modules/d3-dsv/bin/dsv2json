#!/usr/bin/env node

var os = require("os"),
    rw = require("rw").dash,
    path = require("path"),
    iconv = require("iconv-lite"),
    commander = require("commander"),
    dsv = require("../");

var program = path.basename(process.argv[1]),
    defaultInDelimiter = program.slice(0, 3) === "tsv" ? "\t" : ",";

commander
    .version(require("../package.json").version)
    .usage("[options] [file]")
    .option("-o, --out <file>", "output file name; defaults to “-” for stdout", "-")
    .option("-r, --input-delimiter <character>", "input delimiter character", defaultInDelimiter)
    .option("-n, --newline-delimited", "output newline-delimited JSON")
    .option("--input-encoding <encoding>", "input character encoding; defaults to “utf8”", "utf8")
    .option("--output-encoding <encoding>", "output character encoding; defaults to “utf8”", "utf8")
    .parse(process.argv);

var inFormat = dsv.dsvFormat(commander.inputDelimiter);

rw.readFile(commander.args[0] || "-", function(error, text) {
  if (error) throw error;
  var rows = inFormat.parse(iconv.decode(text, commander.inputEncoding));
  rw.writeFile(commander.out, iconv.encode(commander.newlineDelimited
      ? rows.map(function(row) { return JSON.stringify(row); }).join("\n") + "\n"
      : JSON.stringify(rows) + os.EOL, commander.outputEncoding), function(error) {
    if (error) throw error;
  });
});

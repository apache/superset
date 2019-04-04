var util = require('util');
var colors = require('./colors');

//colors.mode = "browser";

var test = colors.red("hopefully colorless output");
util.puts('Rainbows are fun!'.rainbow);
util.puts('So '.italic + 'are'.underline + ' styles! '.bold + 'inverse'.inverse); // styles not widely supported
util.puts('Chains are also cool.'.bold.italic.underline.red); // styles not widely supported
//util.puts('zalgo time!'.zalgo);
util.puts(test.stripColors);
util.puts("a".grey + " b".black);

util.puts(colors.rainbow('Rainbows are fun!'));
util.puts(colors.italic('So ') + colors.underline('are') + colors.bold(' styles! ') + colors.inverse('inverse')); // styles not widely supported
util.puts(colors.bold(colors.italic(colors.underline(colors.red('Chains are also cool.'))))); // styles not widely supported
//util.puts(colors.zalgo('zalgo time!'));
util.puts(colors.stripColors(test));
util.puts(colors.grey("a") + colors.black(" b"));


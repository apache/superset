var fs = require("fs");
var text = fs.readFileSync(__dirname + "/file.txt", "utf-8");
document.write(text);
document.write(require("./test.coffee"));
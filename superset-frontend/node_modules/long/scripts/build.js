var MetaScript = require("metascript"),
    path = require("path"),
    fs = require("fs");

var rootDir = path.join(__dirname, ".."),
    srcDir = path.join(__dirname, "..", "src"),
    distDir = path.join(__dirname, "..", "dist"),
    pkg = require(path.join(rootDir, "package.json")),
    filename;

var scope = {};

// Build
console.log("Building long.js with scope", JSON.stringify(scope, null, 2));
fs.writeFileSync(
    path.join(distDir, "long.js"),
    MetaScript.transform(fs.readFileSync(filename = path.join(srcDir, "wrap.js")), filename, scope, srcDir)
);

// Update bower.json
scope = { VERSION: pkg.version };
console.log("Updating bower.json with scope", JSON.stringify(scope, null, 2));
fs.writeFileSync(
    path.join(rootDir, "bower.json"),
    MetaScript.transform(fs.readFileSync(filename = path.join(srcDir, "bower.json")), filename, scope, srcDir)
);

console.log("Done");

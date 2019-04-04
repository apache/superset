require("babel-register")();

const jsdom = require("jsdom").jsdom;

const exposedProperties = ["window", "navigator", "document"];

global.document = jsdom("");
global.window = document.defaultView;
Object.keys(document.defaultView).forEach(property => {
  if (typeof global[property] === "undefined") {
    exposedProperties.push(property);
    global[property] = document.defaultView[property];
  }
});

global.navigator = {
  userAgent: "node.js"
};

documentRef = document;

const mount = document.createElement("div");
mount.id = "mount";
document.body.appendChild(mount);

"use strict";
const lengthFromProperties = require("../utils").lengthFromProperties;
const idlUtils = require("./generated/utils");

const privates = Symbol("NodeList internal slots");

class NodeList {
  constructor(secret, config) {
    if (secret !== privates) {
      throw new TypeError("Invalid constructor");
    }

    if (config.nodes) {
      this[privates] = {
        isLive: false,
        length: config.nodes.length
      };

      for (let i = 0; i < config.nodes.length; ++i) {
        this[i] = config.nodes[i];
      }
    } else {
      this[privates] = {
        isLive: true,
        element: config.element,
        query: config.query,
        snapshot: undefined,
        length: 0,
        version: -1
      };
      updateNodeList(this);
    }
  }

  get length() {
    updateNodeList(this);
    return this[privates].length;
  }

  item(index) {
    updateNodeList(this);
    return this[index] || null;
  }

  // TODO reimplement this in webidl2js so these become more per-spec
  * keys() {
    updateNodeList(this);
    const length = this[privates].length;
    for (let i = 0; i < length; ++i) {
      yield i;
    }
  }

  * entries() {
    updateNodeList(this);
    const length = this[privates].length;
    for (let i = 0; i < length; ++i) {
      yield [i, this[i]];
    }
  }

  forEach(callback) {
    const thisArg = arguments[1]; // TODO Node v6: use default arguments
    let values = Array.from(this);
    let i = 0;
    while (i < values.length) {
      callback.call(thisArg, values[i], i, this);
      values = Array.from(this);
      ++i;
    }
  }
}

NodeList.prototype[Symbol.iterator] = NodeList.prototype.values = Array.prototype[Symbol.iterator];

function updateNodeList(nodeList) {
  if (nodeList[privates].isLive) {
    if (nodeList[privates].version < nodeList[privates].element._version) {
      nodeList[privates].snapshot = nodeList[privates].query();
      resetNodeListTo(nodeList, nodeList[privates].snapshot);
      nodeList[privates].version = nodeList[privates].element._version;
    }
  } else {
    nodeList[privates].length = lengthFromProperties(nodeList);
  }
}

function resetNodeListTo(nodeList, nodes) {
  const startingLength = lengthFromProperties(nodeList);
  for (let i = 0; i < startingLength; ++i) {
    delete nodeList[i];
  }

  for (let i = 0; i < nodes.length; ++i) {
    const wrapper = idlUtils.wrapperForImpl(nodes[i]);
    nodeList[i] = wrapper ? wrapper : nodes[i];
  }
  nodeList[privates].length = nodes.length;
}

module.exports = function (core) {
  core.NodeList = NodeList;
};

module.exports.createLive = function (element, query) {
  return new NodeList(privates, { element, query });
};

module.exports.createStatic = function (nodes) {
  return new NodeList(privates, { nodes });
};

module.exports.update = updateNodeList;

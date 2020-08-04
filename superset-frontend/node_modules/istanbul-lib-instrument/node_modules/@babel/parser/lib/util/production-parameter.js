"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.functionFlags = functionFlags;
exports.default = exports.PARAM_RETURN = exports.PARAM_AWAIT = exports.PARAM_YIELD = exports.PARAM = void 0;
const PARAM = 0b000,
      PARAM_YIELD = 0b001,
      PARAM_AWAIT = 0b010,
      PARAM_RETURN = 0b100;
exports.PARAM_RETURN = PARAM_RETURN;
exports.PARAM_AWAIT = PARAM_AWAIT;
exports.PARAM_YIELD = PARAM_YIELD;
exports.PARAM = PARAM;

class ProductionParameterHandler {
  constructor() {
    this.stacks = [];
  }

  enter(flags) {
    this.stacks.push(flags);
  }

  exit() {
    this.stacks.pop();
  }

  currentFlags() {
    return this.stacks[this.stacks.length - 1];
  }

  get hasAwait() {
    return (this.currentFlags() & PARAM_AWAIT) > 0;
  }

  get hasYield() {
    return (this.currentFlags() & PARAM_YIELD) > 0;
  }

  get hasReturn() {
    return (this.currentFlags() & PARAM_RETURN) > 0;
  }

}

exports.default = ProductionParameterHandler;

function functionFlags(isAsync, isGenerator) {
  return (isAsync ? PARAM_AWAIT : 0) | (isGenerator ? PARAM_YIELD : 0);
}
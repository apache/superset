"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ExpressionErrors = exports.default = void 0;

var _types = require("../tokenizer/types");

var _tokenizer = _interopRequireDefault(require("../tokenizer"));

var _state = _interopRequireDefault(require("../tokenizer/state"));

var _whitespace = require("../util/whitespace");

var _identifier = require("../util/identifier");

var _location = require("./location");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class UtilParser extends _tokenizer.default {
  addExtra(node, key, val) {
    if (!node) return;
    const extra = node.extra = node.extra || {};
    extra[key] = val;
  }

  isRelational(op) {
    return this.match(_types.types.relational) && this.state.value === op;
  }

  isLookaheadRelational(op) {
    const next = this.nextTokenStart();

    if (this.input.charAt(next) === op) {
      if (next + 1 === this.input.length) {
        return true;
      }

      const afterNext = this.input.charCodeAt(next + 1);
      return afterNext !== op.charCodeAt(0) && afterNext !== 61;
    }

    return false;
  }

  expectRelational(op) {
    if (this.isRelational(op)) {
      this.next();
    } else {
      this.unexpected(null, _types.types.relational);
    }
  }

  isContextual(name) {
    return this.match(_types.types.name) && this.state.value === name && !this.state.containsEsc;
  }

  isUnparsedContextual(nameStart, name) {
    const nameEnd = nameStart + name.length;
    return this.input.slice(nameStart, nameEnd) === name && (nameEnd === this.input.length || !(0, _identifier.isIdentifierChar)(this.input.charCodeAt(nameEnd)));
  }

  isLookaheadContextual(name) {
    const next = this.nextTokenStart();
    return this.isUnparsedContextual(next, name);
  }

  eatContextual(name) {
    return this.isContextual(name) && this.eat(_types.types.name);
  }

  expectContextual(name, message) {
    if (!this.eatContextual(name)) this.unexpected(null, message);
  }

  canInsertSemicolon() {
    return this.match(_types.types.eof) || this.match(_types.types.braceR) || this.hasPrecedingLineBreak();
  }

  hasPrecedingLineBreak() {
    return _whitespace.lineBreak.test(this.input.slice(this.state.lastTokEnd, this.state.start));
  }

  isLineTerminator() {
    return this.eat(_types.types.semi) || this.canInsertSemicolon();
  }

  semicolon() {
    if (!this.isLineTerminator()) this.unexpected(null, _types.types.semi);
  }

  expect(type, pos) {
    this.eat(type) || this.unexpected(pos, type);
  }

  assertNoSpace(message = "Unexpected space.") {
    if (this.state.start > this.state.lastTokEnd) {
      this.raise(this.state.lastTokEnd, message);
    }
  }

  unexpected(pos, messageOrType = "Unexpected token") {
    if (typeof messageOrType !== "string") {
      messageOrType = `Unexpected token, expected "${messageOrType.label}"`;
    }

    throw this.raise(pos != null ? pos : this.state.start, messageOrType);
  }

  expectPlugin(name, pos) {
    if (!this.hasPlugin(name)) {
      throw this.raiseWithData(pos != null ? pos : this.state.start, {
        missingPlugin: [name]
      }, `This experimental syntax requires enabling the parser plugin: '${name}'`);
    }

    return true;
  }

  expectOnePlugin(names, pos) {
    if (!names.some(n => this.hasPlugin(n))) {
      throw this.raiseWithData(pos != null ? pos : this.state.start, {
        missingPlugin: names
      }, `This experimental syntax requires enabling one of the following parser plugin(s): '${names.join(", ")}'`);
    }
  }

  checkYieldAwaitInDefaultParams() {
    if (this.state.yieldPos !== -1 && (this.state.awaitPos === -1 || this.state.yieldPos < this.state.awaitPos)) {
      this.raise(this.state.yieldPos, "Yield cannot be used as name inside a generator function");
    }

    if (this.state.awaitPos !== -1) {
      this.raise(this.state.awaitPos, "Await cannot be used as name inside an async function");
    }
  }

  tryParse(fn, oldState = this.state.clone()) {
    const abortSignal = {
      node: null
    };

    try {
      const node = fn((node = null) => {
        abortSignal.node = node;
        throw abortSignal;
      });

      if (this.state.errors.length > oldState.errors.length) {
        const failState = this.state;
        this.state = oldState;
        return {
          node,
          error: failState.errors[oldState.errors.length],
          thrown: false,
          aborted: false,
          failState
        };
      }

      return {
        node,
        error: null,
        thrown: false,
        aborted: false,
        failState: null
      };
    } catch (error) {
      const failState = this.state;
      this.state = oldState;

      if (error instanceof SyntaxError) {
        return {
          node: null,
          error,
          thrown: true,
          aborted: false,
          failState
        };
      }

      if (error === abortSignal) {
        return {
          node: abortSignal.node,
          error: null,
          thrown: false,
          aborted: true,
          failState
        };
      }

      throw error;
    }
  }

  checkExpressionErrors(refExpressionErrors, andThrow) {
    if (!refExpressionErrors) return false;
    const {
      shorthandAssign,
      doubleProto
    } = refExpressionErrors;
    if (!andThrow) return shorthandAssign >= 0 || doubleProto >= 0;

    if (shorthandAssign >= 0) {
      this.unexpected(shorthandAssign);
    }

    if (doubleProto >= 0) {
      this.raise(doubleProto, _location.Errors.DuplicateProto);
    }
  }

}

exports.default = UtilParser;

class ExpressionErrors {
  constructor() {
    this.shorthandAssign = -1;
    this.doubleProto = -1;
  }

}

exports.ExpressionErrors = ExpressionErrors;
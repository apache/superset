"use strict";

class ChildNodeImpl {
  remove() {
    if (!this.parentNode) {
      return;
    }

    this.parentNode.removeChild(this);
  }
}

module.exports = {
  implementation: ChildNodeImpl
};

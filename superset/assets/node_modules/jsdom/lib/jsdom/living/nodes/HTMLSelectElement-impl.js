"use strict";

const conversions = require("webidl-conversions");

const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const idlUtils = require("../generated/utils");
const NODE_TYPE = require("../node-type");
const createHTMLCollection = require("../html-collection").create;
const domSymbolTree = require("../helpers/internal-constants").domSymbolTree;
const descendantsByHTMLLocalName = require("../helpers/traversal").descendantsByHTMLLocalName;
const closest = require("../helpers/traversal").closest;

class HTMLSelectElementImpl extends HTMLElementImpl {
  _formReset() {
    Array.prototype.forEach.call(this.options, option => {
      const optionImpl = idlUtils.implForWrapper(option);
      optionImpl._selectedness = option.defaultSelected;
      optionImpl._dirtyness = false;
    });
    this._askedForAReset();
  }

  _askedForAReset() {
    if (this.hasAttribute("multiple")) {
      return;
    }

    const selected = Array.prototype.filter.call(this.options, option => {
      option = idlUtils.implForWrapper(option);
      return option._selectedness;
    });

    // size = 1 is default if not multiple
    if ((!this.size || this.size === 1) && !selected.length) {
      // select the first option that is not disabled
      for (let i = 0; i < this.options.length; ++i) {
        const option = idlUtils.implForWrapper(this.options[i]);
        let disabled = this.options[i].disabled;
        const parentNode = domSymbolTree.parent(option);
        if (parentNode &&
            parentNode.nodeName.toUpperCase() === "OPTGROUP" &&
            idlUtils.wrapperForImpl(parentNode).disabled) {
          disabled = true;
        }

        if (!disabled) {
          // (do not set dirty)
          option._selectedness = true;
          break;
        }
      }
    } else if (selected.length >= 2) {
      // select the last selected option
      selected.forEach((option, index) => {
        option = idlUtils.implForWrapper(option);
        option._selectedness = index === selected.length - 1;
      });
    }
  }

  _descendantAdded(parent, child) {
    if (child.nodeType === NODE_TYPE.ELEMENT_NODE) {
      this._askedForAReset();
    }

    super._descendantAdded.apply(this, arguments);
  }

  _descendantRemoved(parent, child) {
    if (child.nodeType === NODE_TYPE.ELEMENT_NODE) {
      this._askedForAReset();
    }

    super._descendantRemoved.apply(this, arguments);
  }

  _attrModified(name) {
    if (name === "multiple" || name === "size") {
      this._askedForAReset();
    }
    super._attrModified.apply(this, arguments);
  }

  get options() {
    // TODO: implement HTMLOptionsCollection
    return createHTMLCollection(this, () => descendantsByHTMLLocalName(this, "option"));
  }

  get length() {
    return this.options.length;
  }

  get selectedIndex() {
    return Array.prototype.reduceRight.call(this.options, (prev, option, i) => {
      option = idlUtils.implForWrapper(option);
      return option.selected ? i : prev;
    }, -1);
  }

  set selectedIndex(index) {
    Array.prototype.forEach.call(this.options, (option, i) => {
      option = idlUtils.implForWrapper(option);
      option.selected = i === index;
    });
  }

  get value() {
    let i = this.selectedIndex;
    if (this.options.length && (i === -1)) {
      i = 0;
    }
    if (i === -1) {
      return "";
    }
    return this.options[i].value;
  }

  set value(val) {
    const self = this;
    Array.prototype.forEach.call(this.options, option => {
      option = idlUtils.implForWrapper(option);
      if (option.value === val) {
        option.selected = true;
      } else if (!self.hasAttribute("multiple")) {
        // Remove the selected bit from all other options in this group
        // if the multiple attr is not present on the select
        option.selected = false;
      }
    });
  }

  get form() {
    return closest(this, "form");
  }

  get type() {
    return this.hasAttribute("multiple") ? "select-multiple" : "select-one";
  }

  add(opt, before) {
    if (before) {
      this.insertBefore(opt, before);
    } else {
      this.appendChild(opt);
    }
  }

  remove(index) {
    const opts = this.options;
    if (index >= 0 && index < opts.length) {
      const el = idlUtils.implForWrapper(opts[index]);
      domSymbolTree.parent(el).removeChild(el);
    }
  }

  get size() {
    if (!this.hasAttribute("size")) {
      return 0;
    }
    const size = conversions["unsigned long"](this.getAttribute("size"));
    if (isNaN(size)) {
      return 0;
    }
    return size;
  }

  set size(V) {
    this.setAttribute("size", V);
  }
}

module.exports = {
  implementation: HTMLSelectElementImpl
};

'use strict';

const color = require('kleur');
const Prompt = require('./prompt');
const { cursor } = require('sisteransi');
const { style, clear, figures, strip } = require('../util');

const getVal = (arr, i) => arr[i] && (arr[i].value || arr[i].title || arr[i]);
const getTitle = (arr, i) => arr[i] && (arr[i].title || arr[i].value || arr[i]);

/**
 * TextPrompt Base Element
 * @param {Object} opts Options
 * @param {String} opts.message Message
 * @param {Array} opts.choices Array of auto-complete choices objects
 * @param {Function} [opts.suggest] Filter function. Defaults to sort by title
 * @param {Number} [opts.limit=10] Max number of results to show
 * @param {Number} [opts.cursor=0] Cursor start position
 * @param {String} [opts.style='default'] Render style
 * @param {String} [opts.fallback] Fallback message - initial to default value
 * @param {String} [opts.initial] Index of the default value
 * @param {Stream} [opts.stdin] The Readable stream to listen to
 * @param {Stream} [opts.stdout] The Writable stream to write readline data to
 * @param {String} [opts.noMatches] The no matches found label
 */
class AutocompletePrompt extends Prompt {
  constructor(opts={}) {
    super(opts);
    this.msg = opts.message;
    this.suggest = opts.suggest;
    this.choices = opts.choices;
    this.initial = opts.initial;
    this.select = opts.initial || opts.cursor || 0;
    this.fallback = opts.fallback || opts.initial !== void 0 ?
      `${figures.pointerSmall} ${getTitle(this.choices, this.initial)}` :
      `${figures.pointerSmall} ${opts.noMatches || 'no matches found'}`;
    this.suggestions = [];
    this.input = '';
    this.limit = opts.limit || 10;
    this.cursor = 0;
    this.transform = style.render(opts.style);
    this.scale = this.transform.scale;
    this.render = this.render.bind(this);
    this.complete = this.complete.bind(this);
    this.clear = clear('');
    this.complete(this.render);
    this.render();
  }

  moveSelect(i) {
    this.select = i;
    if (this.suggestions.length > 0) this.value = getVal(this.suggestions, i);
    else this.value = this.initial !== void 0 ? getVal(this.choices, this.initial) : null;
    this.fire();
  }

  async complete(cb) {
    const p = (this.completing = this.suggest(this.input, this.choices));
    const suggestions = await p;

    if (this.completing !== p) return;
    this.suggestions = suggestions.slice(0, this.limit)
        .map((s, i, arr) => ({title: getTitle(arr, i), value: getVal(arr, i)}));
    this.completing = false;

    const l = Math.max(suggestions.length - 1, 0);
    this.moveSelect(Math.min(l, this.select));

    cb && cb();
  }

  reset() {
    this.input = '';
    this.complete(() => {
      this.moveSelect(this.initial !== void 0 ? this.initial : 0);
      this.render();
    });
    this.render();
  }

  abort() {
    this.done = this.aborted = true;
    this.fire();
    this.render();
    this.out.write('\n');
    this.close();
  }

  submit() {
    this.done = true;
    this.aborted = false;
    this.fire();
    this.render();
    this.out.write('\n');
    this.close();
  }

  _(c, key) {
    let s1 = this.input.slice(0, this.cursor);
    let s2 = this.input.slice(this.cursor);
    this.input = `${s1}${c}${s2}`;
    this.cursor = s1.length+1;
    this.complete(this.render);
    this.render();
  }

  delete() {
    if (this.cursor === 0) return this.bell();
    let s1 = this.input.slice(0, this.cursor-1);
    let s2 = this.input.slice(this.cursor);
    this.input = `${s1}${s2}`;
    this.complete(this.render);
    this.cursor = this.cursor-1;
    this.render();
  }

  deleteForward() {
      if(this.cursor*this.scale >= this.rendered.length) return this.bell();
      let s1 = this.input.slice(0, this.cursor);
      let s2 = this.input.slice(this.cursor+1);
      this.input = `${s1}${s2}`;
      this.complete(this.render);
      this.render();
  }

  first() {
    this.moveSelect(0);
    this.render();
  }

  last() {
    this.moveSelect(this.suggestions.length - 1);
    this.render();
  }

  up() {
    if (this.select <= 0) return this.bell();
    this.moveSelect(this.select - 1);
    this.render();
  }

  down() {
    if (this.select >= this.suggestions.length - 1) return this.bell();
    this.moveSelect(this.select + 1);
    this.render();
  }

  next() {
    this.moveSelect((this.select + 1) % this.suggestions.length);
    this.render();
  }

  left() {
    if (this.cursor <= 0) return this.bell();
    this.cursor = this.cursor-1;
    this.render();
  }

  right() {
    if (this.cursor*this.scale >= this.rendered.length) return this.bell();
    this.cursor = this.cursor+1;
    this.render();
  }

  render() {
    if (this.closed) return;
    super.render();
    if (this.lineCount) this.out.write(cursor.down(this.lineCount));

    let prompt = `${style.symbol(this.done, this.aborted)} ${this.msg} ${style.delimiter(this.completing)} `;
    let length = strip(prompt).length;

    if (this.done && this.suggestions[this.select]) {
        prompt += `${this.suggestions[this.select].title}`;
    } else {
        this.rendered = `${this.transform.render(this.input)}`;
        length += this.rendered.length;
        prompt += this.rendered;
    }

    if (!this.done) {
      this.lineCount = this.suggestions.length;
      let suggestions = this.suggestions.reduce((acc, item, i) =>
        acc + `\n${i === this.select ? color.cyan(item.title) : item.title}`, '');
      if (suggestions) {
        prompt += suggestions;
      } else {
        prompt += `\n${color.gray(this.fallback)}`;
        this.lineCount += 1;
      }
    }

    this.out.write(this.clear + prompt);
    this.clear = clear(prompt);

    if (this.lineCount && !this.done) {
      let pos = cursor.up(this.lineCount);
      pos += cursor.left+cursor.to(length);
      pos += cursor.move(-this.rendered.length+this.cursor*this.scale);
      this.out.write(pos);
    }
  }
}

module.exports = AutocompletePrompt;

'use strict';

const ESC = '\u001B[';
const clear = '\u0007';
const beep = '\u0007';

const cursor = {
  to(x, y) {
    if (!y) return `${ESC}${x + 1}G`;
    return `${ESC}${y + 1};${x + 1}H`;
  },
  move(x, y) {
    let ret = '';

    if (x < 0) ret += `${ESC}${-x}D`;
    else if (x > 0) ret += `${ESC}${x}C`;

    if (y < 0) ret += `${ESC}${-y}A`;
    else if (y > 0) ret += `${ESC}${y}B`;

    return ret;
  },
  up: (count = 1) => `${ESC}${count}A`,
  down: (count = 1) => `${ESC}${count}B`,
  forward: (count = 1) => `${ESC}${count}C`,
  backward: (count = 1) => `${ESC}${count}D`,
  nextLine: (count = 1) => `${ESC}E`.repeat(count),
  prevLine: (count = 1) => `${ESC}F`.repeat(count),
  left: `${ESC}G`,
  hide: `${ESC}?25l`,
  show: `${ESC}?25h`
}

const scroll = {
  up: (count = 1) => `${ESC}S`.repeat(count),
  down: (count = 1) => `${ESC}T`.repeat(count)
}

const erase = {
  screen: `${ESC}2J`,
  up: (count = 1) => `${ESC}1J`.repeat(count),
  down: (count = 1) => `${ESC}J`.repeat(count),
  line: `${ESC}2K`,
  lineEnd: `${ESC}K`,
  lineStart: `${ESC}1K`,
  lines(count) {
    let clear = '';
    for (let i = 0; i < count; i++)
      clear += this.line + (i < count - 1 ? cursor.up() : '');
    if (count)
      clear += cursor.left;
    return clear;
  }
}

module.exports = { cursor, scroll, erase, beep, clear };

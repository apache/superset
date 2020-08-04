(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = global || self, factory(global.doc = {}));
}(this, (function (exports) { 'use strict';

  /**
   * @param {Doc[]} parts
   * @returns Doc
   */


  function concat(parts) {
    // access the internals of a document directly.
    // if(parts.length === 1) {
    //   // If it's a single document, no need to concat it.
    //   return parts[0];
    // }


    return {
      type: "concat",
      parts
    };
  }
  /**
   * @param {Doc} contents
   * @returns Doc
   */


  function indent(contents) {

    return {
      type: "indent",
      contents
    };
  }
  /**
   * @param {number} n
   * @param {Doc} contents
   * @returns Doc
   */


  function align(n, contents) {

    return {
      type: "align",
      contents,
      n
    };
  }
  /**
   * @param {Doc} contents
   * @param {object} [opts] - TBD ???
   * @returns Doc
   */


  function group(contents, opts) {
    opts = opts || {};

    return {
      type: "group",
      id: opts.id,
      contents,
      break: !!opts.shouldBreak,
      expandedStates: opts.expandedStates
    };
  }
  /**
   * @param {Doc} contents
   * @returns Doc
   */


  function dedentToRoot(contents) {
    return align(-Infinity, contents);
  }
  /**
   * @param {Doc} contents
   * @returns Doc
   */


  function markAsRoot(contents) {
    // @ts-ignore - TBD ???:
    return align({
      type: "root"
    }, contents);
  }
  /**
   * @param {Doc} contents
   * @returns Doc
   */


  function dedent(contents) {
    return align(-1, contents);
  }
  /**
   * @param {Doc[]} states
   * @param {object} [opts] - TBD ???
   * @returns Doc
   */


  function conditionalGroup(states, opts) {
    return group(states[0], Object.assign({}, opts, {
      expandedStates: states
    }));
  }
  /**
   * @param {Doc[]} parts
   * @returns Doc
   */


  function fill(parts) {

    return {
      type: "fill",
      parts
    };
  }
  /**
   * @param {Doc} [breakContents]
   * @param {Doc} [flatContents]
   * @param {object} [opts] - TBD ???
   * @returns Doc
   */


  function ifBreak(breakContents, flatContents, opts) {
    opts = opts || {};

    return {
      type: "if-break",
      breakContents,
      flatContents,
      groupId: opts.groupId
    };
  }
  /**
   * @param {Doc} contents
   * @returns Doc
   */


  function lineSuffix(contents) {

    return {
      type: "line-suffix",
      contents
    };
  }

  const lineSuffixBoundary = {
    type: "line-suffix-boundary"
  };
  const breakParent = {
    type: "break-parent"
  };
  const trim = {
    type: "trim"
  };
  const line = {
    type: "line"
  };
  const softline = {
    type: "line",
    soft: true
  };
  const hardline = concat([{
    type: "line",
    hard: true
  }, breakParent]);
  const literalline = concat([{
    type: "line",
    hard: true,
    literal: true
  }, breakParent]);
  const cursor = {
    type: "cursor",
    placeholder: Symbol("cursor")
  };
  /**
   * @param {Doc} sep
   * @param {Doc[]} arr
   * @returns Doc
   */

  function join(sep, arr) {
    const res = [];

    for (let i = 0; i < arr.length; i++) {
      if (i !== 0) {
        res.push(sep);
      }

      res.push(arr[i]);
    }

    return concat(res);
  }
  /**
   * @param {Doc} doc
   * @param {number} size
   * @param {number} tabWidth
   */


  function addAlignmentToDoc(doc, size, tabWidth) {
    let aligned = doc;

    if (size > 0) {
      // Use indent to add tabs for all the levels of tabs we need
      for (let i = 0; i < Math.floor(size / tabWidth); ++i) {
        aligned = indent(aligned);
      } // Use align for all the spaces that are needed


      aligned = align(size % tabWidth, aligned); // size is absolute from 0 and not relative to the current
      // indentation, so we use -Infinity to reset the indentation to 0

      aligned = align(-Infinity, aligned);
    }

    return aligned;
  }

  var docBuilders = {
    concat,
    join,
    line,
    softline,
    hardline,
    literalline,
    group,
    conditionalGroup,
    fill,
    lineSuffix,
    lineSuffixBoundary,
    cursor,
    breakParent,
    ifBreak,
    trim,
    indent,
    align,
    addAlignmentToDoc,
    markAsRoot,
    dedentToRoot,
    dedent
  };

  var ansiRegex = ({
    onlyFirst = false
  } = {}) => {
    const pattern = ['[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)', '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'].join('|');
    return new RegExp(pattern, onlyFirst ? undefined : 'g');
  };

  var stripAnsi = string => typeof string === 'string' ? string.replace(ansiRegex(), '') : string;

  /* eslint-disable yoda */

  const isFullwidthCodePoint = codePoint => {
    if (Number.isNaN(codePoint)) {
      return false;
    } // Code points are derived from:
    // http://www.unix.org/Public/UNIDATA/EastAsianWidth.txt


    if (codePoint >= 0x1100 && (codePoint <= 0x115F || // Hangul Jamo
    codePoint === 0x2329 || // LEFT-POINTING ANGLE BRACKET
    codePoint === 0x232A || // RIGHT-POINTING ANGLE BRACKET
    // CJK Radicals Supplement .. Enclosed CJK Letters and Months
    0x2E80 <= codePoint && codePoint <= 0x3247 && codePoint !== 0x303F || // Enclosed CJK Letters and Months .. CJK Unified Ideographs Extension A
    0x3250 <= codePoint && codePoint <= 0x4DBF || // CJK Unified Ideographs .. Yi Radicals
    0x4E00 <= codePoint && codePoint <= 0xA4C6 || // Hangul Jamo Extended-A
    0xA960 <= codePoint && codePoint <= 0xA97C || // Hangul Syllables
    0xAC00 <= codePoint && codePoint <= 0xD7A3 || // CJK Compatibility Ideographs
    0xF900 <= codePoint && codePoint <= 0xFAFF || // Vertical Forms
    0xFE10 <= codePoint && codePoint <= 0xFE19 || // CJK Compatibility Forms .. Small Form Variants
    0xFE30 <= codePoint && codePoint <= 0xFE6B || // Halfwidth and Fullwidth Forms
    0xFF01 <= codePoint && codePoint <= 0xFF60 || 0xFFE0 <= codePoint && codePoint <= 0xFFE6 || // Kana Supplement
    0x1B000 <= codePoint && codePoint <= 0x1B001 || // Enclosed Ideographic Supplement
    0x1F200 <= codePoint && codePoint <= 0x1F251 || // CJK Unified Ideographs Extension B .. Tertiary Ideographic Plane
    0x20000 <= codePoint && codePoint <= 0x3FFFD)) {
      return true;
    }

    return false;
  };

  var isFullwidthCodePoint_1 = isFullwidthCodePoint;
  var default_1 = isFullwidthCodePoint;
  isFullwidthCodePoint_1.default = default_1;

  var emojiRegex = function emojiRegex() {
    // https://mths.be/emoji
    return /\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F|\uD83D\uDC68(?:\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFE])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|[\u2695\u2696\u2708]\uFE0F|\uD83D[\uDC66\uDC67]|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|(?:\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708])\uFE0F|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C[\uDFFB-\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)\uD83C\uDFFB|\uD83E\uDDD1(?:\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1)|(?:\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFE])|(?:\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB\uDFFC])|\uD83D\uDC69(?:\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFC-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|(?:\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB-\uDFFD])|\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83D\uDC69(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|(?:(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)\uFE0F|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF])\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\u200D[\u2640\u2642])|\uD83C\uDFF4\u200D\u2620)\uFE0F|\uD83D\uDC69\u200D\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83D\uDC15\u200D\uD83E\uDDBA|\uD83D\uDC69\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC67|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF4\uD83C\uDDF2|\uD83C\uDDF6\uD83C\uDDE6|[#\*0-9]\uFE0F\u20E3|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83D\uDC69(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270A-\u270D]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC70\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDCAA\uDD74\uDD7A\uDD90\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD36\uDDB5\uDDB6\uDDBB\uDDD2-\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5\uDEEB\uDEEC\uDEF4-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDED5\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDC8F\uDC91\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1F\uDD26\uDD30-\uDD39\uDD3C-\uDD3E\uDDB5\uDDB6\uDDB8\uDDB9\uDDBB\uDDCD-\uDDCF\uDDD1-\uDDDD])/g;
  };

  const stringWidth = string => {
    string = string.replace(emojiRegex(), '  ');

    if (typeof string !== 'string' || string.length === 0) {
      return 0;
    }

    string = stripAnsi(string);
    let width = 0;

    for (let i = 0; i < string.length; i++) {
      const code = string.codePointAt(i); // Ignore control characters

      if (code <= 0x1F || code >= 0x7F && code <= 0x9F) {
        continue;
      } // Ignore combining characters


      if (code >= 0x300 && code <= 0x36F) {
        continue;
      } // Surrogates


      if (code > 0xFFFF) {
        i++;
      }

      width += isFullwidthCodePoint_1(code) ? 2 : 1;
    }

    return width;
  };

  var stringWidth_1 = stringWidth; // TODO: remove this in the next major version

  var default_1$1 = stringWidth;
  stringWidth_1.default = default_1$1;

  const matchOperatorsRegex = /[|\\{}()[\]^$+*?.-]/g;

  var escapeStringRegexp = string => {
    if (typeof string !== 'string') {
      throw new TypeError('Expected a string');
    }

    return string.replace(matchOperatorsRegex, '\\$&');
  };

  var getLast = arr => arr[arr.length - 1];

  const notAsciiRegex = /[^\x20-\x7F]/;

  function getPenultimate(arr) {
    if (arr.length > 1) {
      return arr[arr.length - 2];
    }

    return null;
  }
  /**
   * @typedef {{backwards?: boolean}} SkipOptions
   */

  /**
   * @param {string | RegExp} chars
   * @returns {(text: string, index: number | false, opts?: SkipOptions) => number | false}
   */


  function skip(chars) {
    return (text, index, opts) => {
      const backwards = opts && opts.backwards; // Allow `skip` functions to be threaded together without having
      // to check for failures (did someone say monads?).

      if (index === false) {
        return false;
      }

      const {
        length
      } = text;
      let cursor = index;

      while (cursor >= 0 && cursor < length) {
        const c = text.charAt(cursor);

        if (chars instanceof RegExp) {
          if (!chars.test(c)) {
            return cursor;
          }
        } else if (!chars.includes(c)) {
          return cursor;
        }

        backwards ? cursor-- : cursor++;
      }

      if (cursor === -1 || cursor === length) {
        // If we reached the beginning or end of the file, return the
        // out-of-bounds cursor. It's up to the caller to handle this
        // correctly. We don't want to indicate `false` though if it
        // actually skipped valid characters.
        return cursor;
      }

      return false;
    };
  }
  /**
   * @type {(text: string, index: number | false, opts?: SkipOptions) => number | false}
   */


  const skipWhitespace = skip(/\s/);
  /**
   * @type {(text: string, index: number | false, opts?: SkipOptions) => number | false}
   */

  const skipSpaces = skip(" \t");
  /**
   * @type {(text: string, index: number | false, opts?: SkipOptions) => number | false}
   */

  const skipToLineEnd = skip(",; \t");
  /**
   * @type {(text: string, index: number | false, opts?: SkipOptions) => number | false}
   */

  const skipEverythingButNewLine = skip(/[^\r\n]/);
  /**
   * @param {string} text
   * @param {number | false} index
   * @returns {number | false}
   */

  function skipInlineComment(text, index) {
    if (index === false) {
      return false;
    }

    if (text.charAt(index) === "/" && text.charAt(index + 1) === "*") {
      for (let i = index + 2; i < text.length; ++i) {
        if (text.charAt(i) === "*" && text.charAt(i + 1) === "/") {
          return i + 2;
        }
      }
    }

    return index;
  }
  /**
   * @param {string} text
   * @param {number | false} index
   * @returns {number | false}
   */


  function skipTrailingComment(text, index) {
    if (index === false) {
      return false;
    }

    if (text.charAt(index) === "/" && text.charAt(index + 1) === "/") {
      return skipEverythingButNewLine(text, index);
    }

    return index;
  } // This one doesn't use the above helper function because it wants to
  // test \r\n in order and `skip` doesn't support ordering and we only
  // want to skip one newline. It's simple to implement.

  /**
   * @param {string} text
   * @param {number | false} index
   * @param {SkipOptions=} opts
   * @returns {number | false}
   */


  function skipNewline(text, index, opts) {
    const backwards = opts && opts.backwards;

    if (index === false) {
      return false;
    }

    const atIndex = text.charAt(index);

    if (backwards) {
      if (text.charAt(index - 1) === "\r" && atIndex === "\n") {
        return index - 2;
      }

      if (atIndex === "\n" || atIndex === "\r" || atIndex === "\u2028" || atIndex === "\u2029") {
        return index - 1;
      }
    } else {
      if (atIndex === "\r" && text.charAt(index + 1) === "\n") {
        return index + 2;
      }

      if (atIndex === "\n" || atIndex === "\r" || atIndex === "\u2028" || atIndex === "\u2029") {
        return index + 1;
      }
    }

    return index;
  }
  /**
   * @param {string} text
   * @param {number} index
   * @param {SkipOptions=} opts
   * @returns {boolean}
   */


  function hasNewline(text, index, opts) {
    opts = opts || {};
    const idx = skipSpaces(text, opts.backwards ? index - 1 : index, opts);
    const idx2 = skipNewline(text, idx, opts);
    return idx !== idx2;
  }
  /**
   * @param {string} text
   * @param {number} start
   * @param {number} end
   * @returns {boolean}
   */


  function hasNewlineInRange(text, start, end) {
    for (let i = start; i < end; ++i) {
      if (text.charAt(i) === "\n") {
        return true;
      }
    }

    return false;
  } // Note: this function doesn't ignore leading comments unlike isNextLineEmpty

  /**
   * @template N
   * @param {string} text
   * @param {N} node
   * @param {(node: N) => number} locStart
   */


  function isPreviousLineEmpty(text, node, locStart) {
    /** @type {number | false} */
    let idx = locStart(node) - 1;
    idx = skipSpaces(text, idx, {
      backwards: true
    });
    idx = skipNewline(text, idx, {
      backwards: true
    });
    idx = skipSpaces(text, idx, {
      backwards: true
    });
    const idx2 = skipNewline(text, idx, {
      backwards: true
    });
    return idx !== idx2;
  }
  /**
   * @param {string} text
   * @param {number} index
   * @returns {boolean}
   */


  function isNextLineEmptyAfterIndex(text, index) {
    /** @type {number | false} */
    let oldIdx = null;
    /** @type {number | false} */

    let idx = index;

    while (idx !== oldIdx) {
      // We need to skip all the potential trailing inline comments
      oldIdx = idx;
      idx = skipToLineEnd(text, idx);
      idx = skipInlineComment(text, idx);
      idx = skipSpaces(text, idx);
    }

    idx = skipTrailingComment(text, idx);
    idx = skipNewline(text, idx);
    return idx !== false && hasNewline(text, idx);
  }
  /**
   * @template N
   * @param {string} text
   * @param {N} node
   * @param {(node: N) => number} locEnd
   * @returns {boolean}
   */


  function isNextLineEmpty(text, node, locEnd) {
    return isNextLineEmptyAfterIndex(text, locEnd(node));
  }
  /**
   * @param {string} text
   * @param {number} idx
   * @returns {number | false}
   */


  function getNextNonSpaceNonCommentCharacterIndexWithStartIndex(text, idx) {
    /** @type {number | false} */
    let oldIdx = null;
    /** @type {number | false} */

    let nextIdx = idx;

    while (nextIdx !== oldIdx) {
      oldIdx = nextIdx;
      nextIdx = skipSpaces(text, nextIdx);
      nextIdx = skipInlineComment(text, nextIdx);
      nextIdx = skipTrailingComment(text, nextIdx);
      nextIdx = skipNewline(text, nextIdx);
    }

    return nextIdx;
  }
  /**
   * @template N
   * @param {string} text
   * @param {N} node
   * @param {(node: N) => number} locEnd
   * @returns {number | false}
   */


  function getNextNonSpaceNonCommentCharacterIndex(text, node, locEnd) {
    return getNextNonSpaceNonCommentCharacterIndexWithStartIndex(text, locEnd(node));
  }
  /**
   * @template N
   * @param {string} text
   * @param {N} node
   * @param {(node: N) => number} locEnd
   * @returns {string}
   */


  function getNextNonSpaceNonCommentCharacter(text, node, locEnd) {
    return text.charAt( // @ts-ignore => TBD: can return false, should we define a fallback?
    getNextNonSpaceNonCommentCharacterIndex(text, node, locEnd));
  }
  /**
   * @param {string} text
   * @param {number} index
   * @param {SkipOptions=} opts
   * @returns {boolean}
   */


  function hasSpaces(text, index, opts) {
    opts = opts || {};
    const idx = skipSpaces(text, opts.backwards ? index - 1 : index, opts);
    return idx !== index;
  }
  /**
   * @param {{range?: [number, number], start?: number}} node
   * @param {number} index
   */


  function setLocStart(node, index) {
    if (node.range) {
      node.range[0] = index;
    } else {
      node.start = index;
    }
  }
  /**
   * @param {{range?: [number, number], end?: number}} node
   * @param {number} index
   */


  function setLocEnd(node, index) {
    if (node.range) {
      node.range[1] = index;
    } else {
      node.end = index;
    }
  }

  const PRECEDENCE = {};
  [["|>"], ["??"], ["||"], ["&&"], ["|"], ["^"], ["&"], ["==", "===", "!=", "!=="], ["<", ">", "<=", ">=", "in", "instanceof"], [">>", "<<", ">>>"], ["+", "-"], ["*", "/", "%"], ["**"]].forEach((tier, i) => {
    tier.forEach(op => {
      PRECEDENCE[op] = i;
    });
  });

  function getPrecedence(op) {
    return PRECEDENCE[op];
  }

  const equalityOperators = {
    "==": true,
    "!=": true,
    "===": true,
    "!==": true
  };
  const multiplicativeOperators = {
    "*": true,
    "/": true,
    "%": true
  };
  const bitshiftOperators = {
    ">>": true,
    ">>>": true,
    "<<": true
  };

  function shouldFlatten(parentOp, nodeOp) {
    if (getPrecedence(nodeOp) !== getPrecedence(parentOp)) {
      return false;
    } // ** is right-associative
    // x ** y ** z --> x ** (y ** z)


    if (parentOp === "**") {
      return false;
    } // x == y == z --> (x == y) == z


    if (equalityOperators[parentOp] && equalityOperators[nodeOp]) {
      return false;
    } // x * y % z --> (x * y) % z


    if (nodeOp === "%" && multiplicativeOperators[parentOp] || parentOp === "%" && multiplicativeOperators[nodeOp]) {
      return false;
    } // x * y / z --> (x * y) / z
    // x / y * z --> (x / y) * z


    if (nodeOp !== parentOp && multiplicativeOperators[nodeOp] && multiplicativeOperators[parentOp]) {
      return false;
    } // x << y << z --> (x << y) << z


    if (bitshiftOperators[parentOp] && bitshiftOperators[nodeOp]) {
      return false;
    }

    return true;
  }

  function isBitwiseOperator(operator) {
    return !!bitshiftOperators[operator] || operator === "|" || operator === "^" || operator === "&";
  } // Tests if an expression starts with `{`, or (if forbidFunctionClassAndDoExpr
  // holds) `function`, `class`, or `do {}`. Will be overzealous if there's
  // already necessary grouping parentheses.


  function startsWithNoLookaheadToken(node, forbidFunctionClassAndDoExpr) {
    node = getLeftMost(node);

    switch (node.type) {
      case "FunctionExpression":
      case "ClassExpression":
      case "DoExpression":
        return forbidFunctionClassAndDoExpr;

      case "ObjectExpression":
        return true;

      case "MemberExpression":
      case "OptionalMemberExpression":
        return startsWithNoLookaheadToken(node.object, forbidFunctionClassAndDoExpr);

      case "TaggedTemplateExpression":
        if (node.tag.type === "FunctionExpression") {
          // IIFEs are always already parenthesized
          return false;
        }

        return startsWithNoLookaheadToken(node.tag, forbidFunctionClassAndDoExpr);

      case "CallExpression":
      case "OptionalCallExpression":
        if (node.callee.type === "FunctionExpression") {
          // IIFEs are always already parenthesized
          return false;
        }

        return startsWithNoLookaheadToken(node.callee, forbidFunctionClassAndDoExpr);

      case "ConditionalExpression":
        return startsWithNoLookaheadToken(node.test, forbidFunctionClassAndDoExpr);

      case "UpdateExpression":
        return !node.prefix && startsWithNoLookaheadToken(node.argument, forbidFunctionClassAndDoExpr);

      case "BindExpression":
        return node.object && startsWithNoLookaheadToken(node.object, forbidFunctionClassAndDoExpr);

      case "SequenceExpression":
        return startsWithNoLookaheadToken(node.expressions[0], forbidFunctionClassAndDoExpr);

      case "TSAsExpression":
        return startsWithNoLookaheadToken(node.expression, forbidFunctionClassAndDoExpr);

      default:
        return false;
    }
  }

  function getLeftMost(node) {
    if (node.left) {
      return getLeftMost(node.left);
    }

    return node;
  }
  /**
   * @param {string} value
   * @param {number} tabWidth
   * @param {number=} startIndex
   * @returns {number}
   */


  function getAlignmentSize(value, tabWidth, startIndex) {
    startIndex = startIndex || 0;
    let size = 0;

    for (let i = startIndex; i < value.length; ++i) {
      if (value[i] === "\t") {
        // Tabs behave in a way that they are aligned to the nearest
        // multiple of tabWidth:
        // 0 -> 4, 1 -> 4, 2 -> 4, 3 -> 4
        // 4 -> 8, 5 -> 8, 6 -> 8, 7 -> 8 ...
        size = size + tabWidth - size % tabWidth;
      } else {
        size++;
      }
    }

    return size;
  }
  /**
   * @param {string} value
   * @param {number} tabWidth
   * @returns {number}
   */


  function getIndentSize(value, tabWidth) {
    const lastNewlineIndex = value.lastIndexOf("\n");

    if (lastNewlineIndex === -1) {
      return 0;
    }

    return getAlignmentSize( // All the leading whitespaces
    value.slice(lastNewlineIndex + 1).match(/^[ \t]*/)[0], tabWidth);
  }
  /**
   * @typedef {'"' | "'"} Quote
   */

  /**
   *
   * @param {string} raw
   * @param {Quote} preferredQuote
   * @returns {Quote}
   */


  function getPreferredQuote(raw, preferredQuote) {
    // `rawContent` is the string exactly like it appeared in the input source
    // code, without its enclosing quotes.
    const rawContent = raw.slice(1, -1);
    /** @type {{ quote: '"', regex: RegExp }} */

    const double = {
      quote: '"',
      regex: /"/g
    };
    /** @type {{ quote: "'", regex: RegExp }} */

    const single = {
      quote: "'",
      regex: /'/g
    };
    const preferred = preferredQuote === "'" ? single : double;
    const alternate = preferred === single ? double : single;
    let result = preferred.quote; // If `rawContent` contains at least one of the quote preferred for enclosing
    // the string, we might want to enclose with the alternate quote instead, to
    // minimize the number of escaped quotes.

    if (rawContent.includes(preferred.quote) || rawContent.includes(alternate.quote)) {
      const numPreferredQuotes = (rawContent.match(preferred.regex) || []).length;
      const numAlternateQuotes = (rawContent.match(alternate.regex) || []).length;
      result = numPreferredQuotes > numAlternateQuotes ? alternate.quote : preferred.quote;
    }

    return result;
  }

  function printString(raw, options, isDirectiveLiteral) {
    // `rawContent` is the string exactly like it appeared in the input source
    // code, without its enclosing quotes.
    const rawContent = raw.slice(1, -1); // Check for the alternate quote, to determine if we're allowed to swap
    // the quotes on a DirectiveLiteral.

    const canChangeDirectiveQuotes = !rawContent.includes('"') && !rawContent.includes("'");
    /** @type {Quote} */

    const enclosingQuote = options.parser === "json" ? '"' : options.__isInHtmlAttribute ? "'" : getPreferredQuote(raw, options.singleQuote ? "'" : '"'); // Directives are exact code unit sequences, which means that you can't
    // change the escape sequences they use.
    // See https://github.com/prettier/prettier/issues/1555
    // and https://tc39.github.io/ecma262/#directive-prologue

    if (isDirectiveLiteral) {
      if (canChangeDirectiveQuotes) {
        return enclosingQuote + rawContent + enclosingQuote;
      }

      return raw;
    } // It might sound unnecessary to use `makeString` even if the string already
    // is enclosed with `enclosingQuote`, but it isn't. The string could contain
    // unnecessary escapes (such as in `"\'"`). Always using `makeString` makes
    // sure that we consistently output the minimum amount of escaped quotes.


    return makeString(rawContent, enclosingQuote, !(options.parser === "css" || options.parser === "less" || options.parser === "scss" || options.embeddedInHtml));
  }
  /**
   * @param {string} rawContent
   * @param {Quote} enclosingQuote
   * @param {boolean=} unescapeUnnecessaryEscapes
   * @returns {string}
   */


  function makeString(rawContent, enclosingQuote, unescapeUnnecessaryEscapes) {
    const otherQuote = enclosingQuote === '"' ? "'" : '"'; // Matches _any_ escape and unescaped quotes (both single and double).

    const regex = /\\([\s\S])|(['"])/g; // Escape and unescape single and double quotes as needed to be able to
    // enclose `rawContent` with `enclosingQuote`.

    const newContent = rawContent.replace(regex, (match, escaped, quote) => {
      // If we matched an escape, and the escaped character is a quote of the
      // other type than we intend to enclose the string with, there's no need for
      // it to be escaped, so return it _without_ the backslash.
      if (escaped === otherQuote) {
        return escaped;
      } // If we matched an unescaped quote and it is of the _same_ type as we
      // intend to enclose the string with, it must be escaped, so return it with
      // a backslash.


      if (quote === enclosingQuote) {
        return "\\" + quote;
      }

      if (quote) {
        return quote;
      } // Unescape any unnecessarily escaped character.
      // Adapted from https://github.com/eslint/eslint/blob/de0b4ad7bd820ade41b1f606008bea68683dc11a/lib/rules/no-useless-escape.js#L27


      return unescapeUnnecessaryEscapes && /^[^\\nrvtbfux\r\n\u2028\u2029"'0-7]$/.test(escaped) ? escaped : "\\" + escaped;
    });
    return enclosingQuote + newContent + enclosingQuote;
  }

  function printNumber(rawNumber) {
    return rawNumber.toLowerCase() // Remove unnecessary plus and zeroes from scientific notation.
    .replace(/^([+-]?[\d.]+e)(?:\+|(-))?0*(\d)/, "$1$2$3") // Remove unnecessary scientific notation (1e0).
    .replace(/^([+-]?[\d.]+)e[+-]?0+$/, "$1") // Make sure numbers always start with a digit.
    .replace(/^([+-])?\./, "$10.") // Remove extraneous trailing decimal zeroes.
    .replace(/(\.\d+?)0+(?=e|$)/, "$1") // Remove trailing dot.
    .replace(/\.(?=e|$)/, "");
  }
  /**
   * @param {string} str
   * @param {string} target
   * @returns {number}
   */


  function getMaxContinuousCount(str, target) {
    const results = str.match(new RegExp("(".concat(escapeStringRegexp(target), ")+"), "g"));

    if (results === null) {
      return 0;
    }

    return results.reduce((maxCount, result) => Math.max(maxCount, result.length / target.length), 0);
  }

  function getMinNotPresentContinuousCount(str, target) {
    const matches = str.match(new RegExp("(".concat(escapeStringRegexp(target), ")+"), "g"));

    if (matches === null) {
      return 0;
    }

    const countPresent = new Map();
    let max = 0;

    for (const match of matches) {
      const count = match.length / target.length;
      countPresent.set(count, true);

      if (count > max) {
        max = count;
      }
    }

    for (let i = 1; i < max; i++) {
      if (!countPresent.get(i)) {
        return i;
      }
    }

    return max + 1;
  }
  /**
   * @param {string} text
   * @returns {number}
   */


  function getStringWidth(text) {
    if (!text) {
      return 0;
    } // shortcut to avoid needless string `RegExp`s, replacements, and allocations within `string-width`


    if (!notAsciiRegex.test(text)) {
      return text.length;
    }

    return stringWidth_1(text);
  }

  function hasIgnoreComment(path) {
    const node = path.getValue();
    return hasNodeIgnoreComment(node);
  }

  function hasNodeIgnoreComment(node) {
    return node && (node.comments && node.comments.length > 0 && node.comments.some(comment => isNodeIgnoreComment(comment) && !comment.unignore) || node.prettierIgnore);
  }

  function isNodeIgnoreComment(comment) {
    return comment.value.trim() === "prettier-ignore";
  }

  function addCommentHelper(node, comment) {
    const comments = node.comments || (node.comments = []);
    comments.push(comment);
    comment.printed = false; // For some reason, TypeScript parses `// x` inside of JSXText as a comment
    // We already "print" it via the raw text, we don't need to re-print it as a
    // comment

    if (node.type === "JSXText") {
      comment.printed = true;
    }
  }

  function addLeadingComment(node, comment) {
    comment.leading = true;
    comment.trailing = false;
    addCommentHelper(node, comment);
  }

  function addDanglingComment(node, comment) {
    comment.leading = false;
    comment.trailing = false;
    addCommentHelper(node, comment);
  }

  function addTrailingComment(node, comment) {
    comment.leading = false;
    comment.trailing = true;
    addCommentHelper(node, comment);
  }

  function isWithinParentArrayProperty(path, propertyName) {
    const node = path.getValue();
    const parent = path.getParentNode();

    if (parent == null) {
      return false;
    }

    if (!Array.isArray(parent[propertyName])) {
      return false;
    }

    const key = path.getName();
    return parent[propertyName][key] === node;
  }

  function replaceEndOfLineWith(text, replacement) {
    const parts = [];

    for (const part of text.split("\n")) {
      if (parts.length !== 0) {
        parts.push(replacement);
      }

      parts.push(part);
    }

    return parts;
  }

  var util = {
    replaceEndOfLineWith,
    getStringWidth,
    getMaxContinuousCount,
    getMinNotPresentContinuousCount,
    getPrecedence,
    shouldFlatten,
    isBitwiseOperator,
    getPenultimate,
    getLast,
    getNextNonSpaceNonCommentCharacterIndexWithStartIndex,
    getNextNonSpaceNonCommentCharacterIndex,
    getNextNonSpaceNonCommentCharacter,
    skip,
    skipWhitespace,
    skipSpaces,
    skipToLineEnd,
    skipEverythingButNewLine,
    skipInlineComment,
    skipTrailingComment,
    skipNewline,
    isNextLineEmptyAfterIndex,
    isNextLineEmpty,
    isPreviousLineEmpty,
    hasNewline,
    hasNewlineInRange,
    hasSpaces,
    setLocStart,
    setLocEnd,
    startsWithNoLookaheadToken,
    getAlignmentSize,
    getIndentSize,
    getPreferredQuote,
    printString,
    printNumber,
    hasIgnoreComment,
    hasNodeIgnoreComment,
    isNodeIgnoreComment,
    makeString,
    addLeadingComment,
    addDanglingComment,
    addTrailingComment,
    isWithinParentArrayProperty
  };

  function guessEndOfLine(text) {
    const index = text.indexOf("\r");

    if (index >= 0) {
      return text.charAt(index + 1) === "\n" ? "crlf" : "cr";
    }

    return "lf";
  }

  function convertEndOfLineToChars(value) {
    switch (value) {
      case "cr":
        return "\r";

      case "crlf":
        return "\r\n";

      default:
        return "\n";
    }
  }

  var endOfLine = {
    guessEndOfLine,
    convertEndOfLineToChars
  };

  const {
    getStringWidth: getStringWidth$1
  } = util;
  const {
    convertEndOfLineToChars: convertEndOfLineToChars$1
  } = endOfLine;
  const {
    concat: concat$1,
    fill: fill$1,
    cursor: cursor$1
  } = docBuilders;
  /** @type {Record<symbol, typeof MODE_BREAK | typeof MODE_FLAT>} */

  let groupModeMap;
  const MODE_BREAK = 1;
  const MODE_FLAT = 2;

  function rootIndent() {
    return {
      value: "",
      length: 0,
      queue: []
    };
  }

  function makeIndent(ind, options) {
    return generateInd(ind, {
      type: "indent"
    }, options);
  }

  function makeAlign(ind, n, options) {
    return n === -Infinity ? ind.root || rootIndent() : n < 0 ? generateInd(ind, {
      type: "dedent"
    }, options) : !n ? ind : n.type === "root" ? Object.assign({}, ind, {
      root: ind
    }) : typeof n === "string" ? generateInd(ind, {
      type: "stringAlign",
      n
    }, options) : generateInd(ind, {
      type: "numberAlign",
      n
    }, options);
  }

  function generateInd(ind, newPart, options) {
    const queue = newPart.type === "dedent" ? ind.queue.slice(0, -1) : ind.queue.concat(newPart);
    let value = "";
    let length = 0;
    let lastTabs = 0;
    let lastSpaces = 0;

    for (const part of queue) {
      switch (part.type) {
        case "indent":
          flush();

          if (options.useTabs) {
            addTabs(1);
          } else {
            addSpaces(options.tabWidth);
          }

          break;

        case "stringAlign":
          flush();
          value += part.n;
          length += part.n.length;
          break;

        case "numberAlign":
          lastTabs += 1;
          lastSpaces += part.n;
          break;

        /* istanbul ignore next */

        default:
          throw new Error("Unexpected type '".concat(part.type, "'"));
      }
    }

    flushSpaces();
    return Object.assign({}, ind, {
      value,
      length,
      queue
    });

    function addTabs(count) {
      value += "\t".repeat(count);
      length += options.tabWidth * count;
    }

    function addSpaces(count) {
      value += " ".repeat(count);
      length += count;
    }

    function flush() {
      if (options.useTabs) {
        flushTabs();
      } else {
        flushSpaces();
      }
    }

    function flushTabs() {
      if (lastTabs > 0) {
        addTabs(lastTabs);
      }

      resetLast();
    }

    function flushSpaces() {
      if (lastSpaces > 0) {
        addSpaces(lastSpaces);
      }

      resetLast();
    }

    function resetLast() {
      lastTabs = 0;
      lastSpaces = 0;
    }
  }

  function trim$1(out) {
    if (out.length === 0) {
      return 0;
    }

    let trimCount = 0; // Trim whitespace at the end of line

    while (out.length > 0 && typeof out[out.length - 1] === "string" && out[out.length - 1].match(/^[ \t]*$/)) {
      trimCount += out.pop().length;
    }

    if (out.length && typeof out[out.length - 1] === "string") {
      const trimmed = out[out.length - 1].replace(/[ \t]*$/, "");
      trimCount += out[out.length - 1].length - trimmed.length;
      out[out.length - 1] = trimmed;
    }

    return trimCount;
  }

  function fits(next, restCommands, width, options, mustBeFlat) {
    let restIdx = restCommands.length;
    const cmds = [next]; // `out` is only used for width counting because `trim` requires to look
    // backwards for space characters.

    const out = [];

    while (width >= 0) {
      if (cmds.length === 0) {
        if (restIdx === 0) {
          return true;
        }

        cmds.push(restCommands[restIdx - 1]);
        restIdx--;
        continue;
      }

      const [ind, mode, doc] = cmds.pop();

      if (typeof doc === "string") {
        out.push(doc);
        width -= getStringWidth$1(doc);
      } else {
        switch (doc.type) {
          case "concat":
            for (let i = doc.parts.length - 1; i >= 0; i--) {
              cmds.push([ind, mode, doc.parts[i]]);
            }

            break;

          case "indent":
            cmds.push([makeIndent(ind, options), mode, doc.contents]);
            break;

          case "align":
            cmds.push([makeAlign(ind, doc.n, options), mode, doc.contents]);
            break;

          case "trim":
            width += trim$1(out);
            break;

          case "group":
            if (mustBeFlat && doc.break) {
              return false;
            }

            cmds.push([ind, doc.break ? MODE_BREAK : mode, doc.contents]);

            if (doc.id) {
              groupModeMap[doc.id] = cmds[cmds.length - 1][1];
            }

            break;

          case "fill":
            for (let i = doc.parts.length - 1; i >= 0; i--) {
              cmds.push([ind, mode, doc.parts[i]]);
            }

            break;

          case "if-break":
            {
              const groupMode = doc.groupId ? groupModeMap[doc.groupId] : mode;

              if (groupMode === MODE_BREAK) {
                if (doc.breakContents) {
                  cmds.push([ind, mode, doc.breakContents]);
                }
              }

              if (groupMode === MODE_FLAT) {
                if (doc.flatContents) {
                  cmds.push([ind, mode, doc.flatContents]);
                }
              }

              break;
            }

          case "line":
            switch (mode) {
              // fallthrough
              case MODE_FLAT:
                if (!doc.hard) {
                  if (!doc.soft) {
                    out.push(" ");
                    width -= 1;
                  }

                  break;
                }

                return true;

              case MODE_BREAK:
                return true;
            }

            break;
        }
      }
    }

    return false;
  }

  function printDocToString(doc, options) {
    groupModeMap = {};
    const width = options.printWidth;
    const newLine = convertEndOfLineToChars$1(options.endOfLine);
    let pos = 0; // cmds is basically a stack. We've turned a recursive call into a
    // while loop which is much faster. The while loop below adds new
    // cmds to the array instead of recursively calling `print`.

    const cmds = [[rootIndent(), MODE_BREAK, doc]];
    const out = [];
    let shouldRemeasure = false;
    let lineSuffix = [];

    while (cmds.length !== 0) {
      const [ind, mode, doc] = cmds.pop();

      if (typeof doc === "string") {
        const formatted = newLine !== "\n" && doc.includes("\n") ? doc.replace(/\n/g, newLine) : doc;
        out.push(formatted);
        pos += getStringWidth$1(formatted);
      } else {
        switch (doc.type) {
          case "cursor":
            out.push(cursor$1.placeholder);
            break;

          case "concat":
            for (let i = doc.parts.length - 1; i >= 0; i--) {
              cmds.push([ind, mode, doc.parts[i]]);
            }

            break;

          case "indent":
            cmds.push([makeIndent(ind, options), mode, doc.contents]);
            break;

          case "align":
            cmds.push([makeAlign(ind, doc.n, options), mode, doc.contents]);
            break;

          case "trim":
            pos -= trim$1(out);
            break;

          case "group":
            switch (mode) {
              case MODE_FLAT:
                if (!shouldRemeasure) {
                  cmds.push([ind, doc.break ? MODE_BREAK : MODE_FLAT, doc.contents]);
                  break;
                }

              // fallthrough

              case MODE_BREAK:
                {
                  shouldRemeasure = false;
                  const next = [ind, MODE_FLAT, doc.contents];
                  const rem = width - pos;

                  if (!doc.break && fits(next, cmds, rem, options)) {
                    cmds.push(next);
                  } else {
                    // Expanded states are a rare case where a document
                    // can manually provide multiple representations of
                    // itself. It provides an array of documents
                    // going from the least expanded (most flattened)
                    // representation first to the most expanded. If a
                    // group has these, we need to manually go through
                    // these states and find the first one that fits.
                    if (doc.expandedStates) {
                      const mostExpanded = doc.expandedStates[doc.expandedStates.length - 1];

                      if (doc.break) {
                        cmds.push([ind, MODE_BREAK, mostExpanded]);
                        break;
                      } else {
                        for (let i = 1; i < doc.expandedStates.length + 1; i++) {
                          if (i >= doc.expandedStates.length) {
                            cmds.push([ind, MODE_BREAK, mostExpanded]);
                            break;
                          } else {
                            const state = doc.expandedStates[i];
                            const cmd = [ind, MODE_FLAT, state];

                            if (fits(cmd, cmds, rem, options)) {
                              cmds.push(cmd);
                              break;
                            }
                          }
                        }
                      }
                    } else {
                      cmds.push([ind, MODE_BREAK, doc.contents]);
                    }
                  }

                  break;
                }
            }

            if (doc.id) {
              groupModeMap[doc.id] = cmds[cmds.length - 1][1];
            }

            break;
          // Fills each line with as much code as possible before moving to a new
          // line with the same indentation.
          //
          // Expects doc.parts to be an array of alternating content and
          // whitespace. The whitespace contains the linebreaks.
          //
          // For example:
          //   ["I", line, "love", line, "monkeys"]
          // or
          //   [{ type: group, ... }, softline, { type: group, ... }]
          //
          // It uses this parts structure to handle three main layout cases:
          // * The first two content items fit on the same line without
          //   breaking
          //   -> output the first content item and the whitespace "flat".
          // * Only the first content item fits on the line without breaking
          //   -> output the first content item "flat" and the whitespace with
          //   "break".
          // * Neither content item fits on the line without breaking
          //   -> output the first content item and the whitespace with "break".

          case "fill":
            {
              const rem = width - pos;
              const {
                parts
              } = doc;

              if (parts.length === 0) {
                break;
              }

              const [content, whitespace] = parts;
              const contentFlatCmd = [ind, MODE_FLAT, content];
              const contentBreakCmd = [ind, MODE_BREAK, content];
              const contentFits = fits(contentFlatCmd, [], rem, options, true);

              if (parts.length === 1) {
                if (contentFits) {
                  cmds.push(contentFlatCmd);
                } else {
                  cmds.push(contentBreakCmd);
                }

                break;
              }

              const whitespaceFlatCmd = [ind, MODE_FLAT, whitespace];
              const whitespaceBreakCmd = [ind, MODE_BREAK, whitespace];

              if (parts.length === 2) {
                if (contentFits) {
                  cmds.push(whitespaceFlatCmd);
                  cmds.push(contentFlatCmd);
                } else {
                  cmds.push(whitespaceBreakCmd);
                  cmds.push(contentBreakCmd);
                }

                break;
              } // At this point we've handled the first pair (context, separator)
              // and will create a new fill doc for the rest of the content.
              // Ideally we wouldn't mutate the array here but copying all the
              // elements to a new array would make this algorithm quadratic,
              // which is unusable for large arrays (e.g. large texts in JSX).


              parts.splice(0, 2);
              const remainingCmd = [ind, mode, fill$1(parts)];
              const secondContent = parts[0];
              const firstAndSecondContentFlatCmd = [ind, MODE_FLAT, concat$1([content, whitespace, secondContent])];
              const firstAndSecondContentFits = fits(firstAndSecondContentFlatCmd, [], rem, options, true);

              if (firstAndSecondContentFits) {
                cmds.push(remainingCmd);
                cmds.push(whitespaceFlatCmd);
                cmds.push(contentFlatCmd);
              } else if (contentFits) {
                cmds.push(remainingCmd);
                cmds.push(whitespaceBreakCmd);
                cmds.push(contentFlatCmd);
              } else {
                cmds.push(remainingCmd);
                cmds.push(whitespaceBreakCmd);
                cmds.push(contentBreakCmd);
              }

              break;
            }

          case "if-break":
            {
              const groupMode = doc.groupId ? groupModeMap[doc.groupId] : mode;

              if (groupMode === MODE_BREAK) {
                if (doc.breakContents) {
                  cmds.push([ind, mode, doc.breakContents]);
                }
              }

              if (groupMode === MODE_FLAT) {
                if (doc.flatContents) {
                  cmds.push([ind, mode, doc.flatContents]);
                }
              }

              break;
            }

          case "line-suffix":
            lineSuffix.push([ind, mode, doc.contents]);
            break;

          case "line-suffix-boundary":
            if (lineSuffix.length > 0) {
              cmds.push([ind, mode, {
                type: "line",
                hard: true
              }]);
            }

            break;

          case "line":
            switch (mode) {
              case MODE_FLAT:
                if (!doc.hard) {
                  if (!doc.soft) {
                    out.push(" ");
                    pos += 1;
                  }

                  break;
                } else {
                  // This line was forced into the output even if we
                  // were in flattened mode, so we need to tell the next
                  // group that no matter what, it needs to remeasure
                  // because the previous measurement didn't accurately
                  // capture the entire expression (this is necessary
                  // for nested groups)
                  shouldRemeasure = true;
                }

              // fallthrough

              case MODE_BREAK:
                if (lineSuffix.length) {
                  cmds.push([ind, mode, doc]);
                  cmds.push(...lineSuffix.reverse());
                  lineSuffix = [];
                  break;
                }

                if (doc.literal) {
                  if (ind.root) {
                    out.push(newLine, ind.root.value);
                    pos = ind.root.length;
                  } else {
                    out.push(newLine);
                    pos = 0;
                  }
                } else {
                  pos -= trim$1(out);
                  out.push(newLine + ind.value);
                  pos = ind.length;
                }

                break;
            }

            break;
        }
      }
    }

    const cursorPlaceholderIndex = out.indexOf(cursor$1.placeholder);

    if (cursorPlaceholderIndex !== -1) {
      const otherCursorPlaceholderIndex = out.indexOf(cursor$1.placeholder, cursorPlaceholderIndex + 1);
      const beforeCursor = out.slice(0, cursorPlaceholderIndex).join("");
      const aroundCursor = out.slice(cursorPlaceholderIndex + 1, otherCursorPlaceholderIndex).join("");
      const afterCursor = out.slice(otherCursorPlaceholderIndex + 1).join("");
      return {
        formatted: beforeCursor + aroundCursor + afterCursor,
        cursorNodeStart: beforeCursor.length,
        cursorNodeText: aroundCursor
      };
    }

    return {
      formatted: out.join("")
    };
  }

  var docPrinter = {
    printDocToString
  };

  const traverseDocOnExitStackMarker = {};

  function traverseDoc(doc, onEnter, onExit, shouldTraverseConditionalGroups) {
    const docsStack = [doc];

    while (docsStack.length !== 0) {
      const doc = docsStack.pop();

      if (doc === traverseDocOnExitStackMarker) {
        onExit(docsStack.pop());
        continue;
      }

      let shouldRecurse = true;

      if (onEnter) {
        if (onEnter(doc) === false) {
          shouldRecurse = false;
        }
      }

      if (onExit) {
        docsStack.push(doc);
        docsStack.push(traverseDocOnExitStackMarker);
      }

      if (shouldRecurse) {
        // When there are multiple parts to process,
        // the parts need to be pushed onto the stack in reverse order,
        // so that they are processed in the original order
        // when the stack is popped.
        if (doc.type === "concat" || doc.type === "fill") {
          for (let ic = doc.parts.length, i = ic - 1; i >= 0; --i) {
            docsStack.push(doc.parts[i]);
          }
        } else if (doc.type === "if-break") {
          if (doc.flatContents) {
            docsStack.push(doc.flatContents);
          }

          if (doc.breakContents) {
            docsStack.push(doc.breakContents);
          }
        } else if (doc.type === "group" && doc.expandedStates) {
          if (shouldTraverseConditionalGroups) {
            for (let ic = doc.expandedStates.length, i = ic - 1; i >= 0; --i) {
              docsStack.push(doc.expandedStates[i]);
            }
          } else {
            docsStack.push(doc.contents);
          }
        } else if (doc.contents) {
          docsStack.push(doc.contents);
        }
      }
    }
  }

  function mapDoc(doc, cb) {
    if (doc.type === "concat" || doc.type === "fill") {
      const parts = doc.parts.map(part => mapDoc(part, cb));
      return cb(Object.assign({}, doc, {
        parts
      }));
    } else if (doc.type === "if-break") {
      const breakContents = doc.breakContents && mapDoc(doc.breakContents, cb);
      const flatContents = doc.flatContents && mapDoc(doc.flatContents, cb);
      return cb(Object.assign({}, doc, {
        breakContents,
        flatContents
      }));
    } else if (doc.contents) {
      const contents = mapDoc(doc.contents, cb);
      return cb(Object.assign({}, doc, {
        contents
      }));
    }

    return cb(doc);
  }

  function findInDoc(doc, fn, defaultValue) {
    let result = defaultValue;
    let hasStopped = false;

    function findInDocOnEnterFn(doc) {
      const maybeResult = fn(doc);

      if (maybeResult !== undefined) {
        hasStopped = true;
        result = maybeResult;
      }

      if (hasStopped) {
        return false;
      }
    }

    traverseDoc(doc, findInDocOnEnterFn);
    return result;
  }

  function isEmpty(n) {
    return typeof n === "string" && n.length === 0;
  }

  function isLineNextFn(doc) {
    if (typeof doc === "string") {
      return false;
    }

    if (doc.type === "line") {
      return true;
    }
  }

  function isLineNext(doc) {
    return findInDoc(doc, isLineNextFn, false);
  }

  function willBreakFn(doc) {
    if (doc.type === "group" && doc.break) {
      return true;
    }

    if (doc.type === "line" && doc.hard) {
      return true;
    }

    if (doc.type === "break-parent") {
      return true;
    }
  }

  function willBreak(doc) {
    return findInDoc(doc, willBreakFn, false);
  }

  function breakParentGroup(groupStack) {
    if (groupStack.length > 0) {
      const parentGroup = groupStack[groupStack.length - 1]; // Breaks are not propagated through conditional groups because
      // the user is expected to manually handle what breaks.

      if (!parentGroup.expandedStates) {
        parentGroup.break = true;
      }
    }

    return null;
  }

  function propagateBreaks(doc) {
    const alreadyVisitedSet = new Set();
    const groupStack = [];

    function propagateBreaksOnEnterFn(doc) {
      if (doc.type === "break-parent") {
        breakParentGroup(groupStack);
      }

      if (doc.type === "group") {
        groupStack.push(doc);

        if (alreadyVisitedSet.has(doc)) {
          return false;
        }

        alreadyVisitedSet.add(doc);
      }
    }

    function propagateBreaksOnExitFn(doc) {
      if (doc.type === "group") {
        const group = groupStack.pop();

        if (group.break) {
          breakParentGroup(groupStack);
        }
      }
    }

    traverseDoc(doc, propagateBreaksOnEnterFn, propagateBreaksOnExitFn,
    /* shouldTraverseConditionalGroups */
    true);
  }

  function removeLinesFn(doc) {
    // Force this doc into flat mode by statically converting all
    // lines into spaces (or soft lines into nothing). Hard lines
    // should still output because there's too great of a chance
    // of breaking existing assumptions otherwise.
    if (doc.type === "line" && !doc.hard) {
      return doc.soft ? "" : " ";
    } else if (doc.type === "if-break") {
      return doc.flatContents || "";
    }

    return doc;
  }

  function removeLines(doc) {
    return mapDoc(doc, removeLinesFn);
  }

  function stripTrailingHardline(doc) {
    // HACK remove ending hardline, original PR: #1984
    if (doc.type === "concat" && doc.parts.length !== 0) {
      const lastPart = doc.parts[doc.parts.length - 1];

      if (lastPart.type === "concat") {
        if (lastPart.parts.length === 2 && lastPart.parts[0].hard && lastPart.parts[1].type === "break-parent") {
          return {
            type: "concat",
            parts: doc.parts.slice(0, -1)
          };
        }

        return {
          type: "concat",
          parts: doc.parts.slice(0, -1).concat(stripTrailingHardline(lastPart))
        };
      }
    }

    return doc;
  }

  var docUtils = {
    isEmpty,
    willBreak,
    isLineNext,
    traverseDoc,
    findInDoc,
    mapDoc,
    propagateBreaks,
    removeLines,
    stripTrailingHardline
  };

  function flattenDoc(doc) {
    if (doc.type === "concat") {
      const res = [];

      for (let i = 0; i < doc.parts.length; ++i) {
        const doc2 = doc.parts[i];

        if (typeof doc2 !== "string" && doc2.type === "concat") {
          res.push(...flattenDoc(doc2).parts);
        } else {
          const flattened = flattenDoc(doc2);

          if (flattened !== "") {
            res.push(flattened);
          }
        }
      }

      return Object.assign({}, doc, {
        parts: res
      });
    } else if (doc.type === "if-break") {
      return Object.assign({}, doc, {
        breakContents: doc.breakContents != null ? flattenDoc(doc.breakContents) : null,
        flatContents: doc.flatContents != null ? flattenDoc(doc.flatContents) : null
      });
    } else if (doc.type === "group") {
      return Object.assign({}, doc, {
        contents: flattenDoc(doc.contents),
        expandedStates: doc.expandedStates ? doc.expandedStates.map(flattenDoc) : doc.expandedStates
      });
    } else if (doc.contents) {
      return Object.assign({}, doc, {
        contents: flattenDoc(doc.contents)
      });
    }

    return doc;
  }

  function printDoc(doc) {
    if (typeof doc === "string") {
      return JSON.stringify(doc);
    }

    if (doc.type === "line") {
      if (doc.literal) {
        return "literalline";
      }

      if (doc.hard) {
        return "hardline";
      }

      if (doc.soft) {
        return "softline";
      }

      return "line";
    }

    if (doc.type === "break-parent") {
      return "breakParent";
    }

    if (doc.type === "trim") {
      return "trim";
    }

    if (doc.type === "concat") {
      return "[" + doc.parts.map(printDoc).join(", ") + "]";
    }

    if (doc.type === "indent") {
      return "indent(" + printDoc(doc.contents) + ")";
    }

    if (doc.type === "align") {
      return doc.n === -Infinity ? "dedentToRoot(" + printDoc(doc.contents) + ")" : doc.n < 0 ? "dedent(" + printDoc(doc.contents) + ")" : doc.n.type === "root" ? "markAsRoot(" + printDoc(doc.contents) + ")" : "align(" + JSON.stringify(doc.n) + ", " + printDoc(doc.contents) + ")";
    }

    if (doc.type === "if-break") {
      return "ifBreak(" + printDoc(doc.breakContents) + (doc.flatContents ? ", " + printDoc(doc.flatContents) : "") + ")";
    }

    if (doc.type === "group") {
      if (doc.expandedStates) {
        return "conditionalGroup(" + "[" + doc.expandedStates.map(printDoc).join(",") + "])";
      }

      return (doc.break ? "wrappedGroup" : "group") + "(" + printDoc(doc.contents) + ")";
    }

    if (doc.type === "fill") {
      return "fill" + "(" + doc.parts.map(printDoc).join(", ") + ")";
    }

    if (doc.type === "line-suffix") {
      return "lineSuffix(" + printDoc(doc.contents) + ")";
    }

    if (doc.type === "line-suffix-boundary") {
      return "lineSuffixBoundary";
    }

    throw new Error("Unknown doc type " + doc.type);
  }

  var docDebug = {
    printDocToDebug(doc) {
      return printDoc(flattenDoc(doc));
    }

  };

  var document = {
    builders: docBuilders,
    printer: docPrinter,
    utils: docUtils,
    debug: docDebug
  };
  var document_1 = document.builders;
  var document_2 = document.printer;
  var document_3 = document.utils;
  var document_4 = document.debug;

  exports.builders = document_1;
  exports.debug = document_4;
  exports.default = document;
  exports.printer = document_2;
  exports.utils = document_3;

  Object.defineProperty(exports, '__esModule', { value: true });

})));

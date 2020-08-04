"use strict";

const { isS, isChar, isNameStartChar, isNameChar, S_LIST, NAME_RE } =
      require("xmlchars/xml/1.0/ed5");
const { isNCNameStartChar, isNCNameChar, NC_NAME_RE } = require("xmlchars/xmlns/1.0/ed3");

const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";

const rootNS = {
  __proto__: null,
  xml: XML_NAMESPACE,
  xmlns: XMLNS_NAMESPACE,
};

const XML_ENTITIES = {
  __proto__: null,
  amp: "&",
  gt: ">",
  lt: "<",
  quot: "\"",
  apos: "'",
};

const S_INITIAL = "sInitial"; // initial state
const S_BEGIN_WHITESPACE = "sBeginWhitespace"; // leading whitespace
const S_DOCTYPE = "sDoctype"; // <!DOCTYPE
const S_DOCTYPE_QUOTE = "sDoctypeQuote"; // <!DOCTYPE "//blah
const S_DTD = "sDTD"; // <!DOCTYPE "//blah" [ ...
const S_DTD_QUOTED = "sDTDQuoted"; // <!DOCTYPE "//blah" [ "foo
const S_DTD_OPEN_WAKA = "sDTDOpenWaka";
const S_DTD_OPEN_WAKA_BANG = "sDTDOpenWakaBang";
const S_DTD_COMMENT = "sDTDComment"; // <!--
const S_DTD_COMMENT_ENDING = "sDTDCommentEnding"; // <!-- blah -
const S_DTD_COMMENT_ENDED = "sDTDCommentEnded"; // <!-- blah --
const S_DTD_PI = "sDTDPI"; // <?
const S_DTD_PI_ENDING = "sDTDPIEnding"; // <?hi "there" ?
const S_TEXT = "sText"; // general stuff
const S_ENTITY = "sEntity"; // &amp and such
const S_OPEN_WAKA = "sOpenWaka"; // <
const S_OPEN_WAKA_BANG = "sOpenWakaBang"; // <!...
const S_COMMENT = "sComment"; // <!--
const S_COMMENT_ENDING = "sCommentEnding"; // <!-- blah -
const S_COMMENT_ENDED = "sCommentEnded"; // <!-- blah --
const S_CDATA = "sCData"; // <![CDATA[ something
const S_CDATA_ENDING = "sCDataEnding"; // ]
const S_CDATA_ENDING_2 = "sCDataEnding2"; // ]]
const S_PI_FIRST_CHAR = "sPIFirstChar"; // <?hi, first char
const S_PI_REST = "sPIRest"; // <?hi, rest of the name
const S_PI_BODY = "sPIBody"; // <?hi there
const S_PI_ENDING = "sPIEnding"; // <?hi "there" ?
const S_OPEN_TAG = "sOpenTag"; // <strong
const S_OPEN_TAG_SLASH = "sOpenTagSlash"; // <strong /
const S_ATTRIB = "sAttrib"; // <a
const S_ATTRIB_NAME = "sAttribName"; // <a foo
const S_ATTRIB_NAME_SAW_WHITE = "sAttribNameSawWhite"; // <a foo _
const S_ATTRIB_VALUE = "sAttribValue"; // <a foo=
const S_ATTRIB_VALUE_QUOTED = "sAttribValueQuoted"; // <a foo="bar
const S_ATTRIB_VALUE_CLOSED = "sAttribValueClosed"; // <a foo="bar"
const S_ATTRIB_VALUE_UNQUOTED = "sAttribValueUnquoted"; // <a foo=bar
const S_CLOSE_TAG = "sCloseTag"; // </a
const S_CLOSE_TAG_SAW_WHITE = "sCloseTagSawWhite"; // </a   >

// These states are internal to sPIBody
const S_XML_DECL_NAME_START = 1; // <?xml
const S_XML_DECL_NAME = 2; // <?xml foo
const S_XML_DECL_EQ = 3; // <?xml foo=
const S_XML_DECL_VALUE_START = 4; // <?xml foo=
const S_XML_DECL_VALUE = 5; // <?xml foo="bar"

/**
 * The list of supported events.
 */
exports.EVENTS = [
  "text",
  "processinginstruction",
  "doctype",
  "comment",
  "opentagstart",
  "opentag",
  "closetag",
  "cdata",
  "error",
  "end",
  "ready",
];

const NL = 0xA;
const CR = 0xD;
const SPACE = 0x20;
const BANG = 0x21;
const DQUOTE = 0x22;
const AMP = 0x26;
const SQUOTE = 0x27;
const MINUS = 0x2D;
const FORWARD_SLASH = 0x2F;
const SEMICOLON = 0x3B;
const LESS = 0x3C;
const EQUAL = 0x3D;
const GREATER = 0x3E;
const QUESTION = 0x3F;
const OPEN_BRACKET = 0x5B;
const CLOSE_BRACKET = 0x5D;

function isQuote(c) {
  return c === DQUOTE || c === SQUOTE;
}

const QUOTES = [DQUOTE, SQUOTE];

const DOCTYPE_TERMINATOR = [...QUOTES, OPEN_BRACKET, GREATER];
const DTD_TERMINATOR = [...QUOTES, LESS, CLOSE_BRACKET];
const XML_DECL_NAME_TERMINATOR = [EQUAL, QUESTION, ...S_LIST];
const ATTRIB_VALUE_UNQUOTED_TERMINATOR = [...S_LIST, GREATER, AMP, LESS];

function nsPairCheck(parser, prefix, uri) {
  switch (prefix) {
  case "xml":
    if (uri !== XML_NAMESPACE) {
      parser.fail(`xml prefix must be bound to ${XML_NAMESPACE}.`);
    }
    break;
  case "xmlns":
    if (uri !== XMLNS_NAMESPACE) {
      parser.fail(`xmlns prefix must be bound to ${XMLNS_NAMESPACE}.`);
    }
    break;
  default:
  }

  switch (uri) {
  case XMLNS_NAMESPACE:
    parser.fail(prefix === "" ?
                `the default namespace may not be set to ${uri}.` :
                `may not assign a prefix (even "xmlns") to the URI \
${XMLNS_NAMESPACE}.`);
    break;
  case XML_NAMESPACE:
    switch (prefix) {
    case "xml":
      // Assinging the XML namespace to "xml" is fine.
      break;
    case "":
      parser.fail(`the default namespace may not be set to ${uri}.`);
      break;
    default:
      parser.fail("may not assign the xml namespace to another prefix.");
    }
    break;
  default:
  }
}


function nsMappingCheck(parser, mapping) {
  for (const local of Object.keys(mapping)) {
    nsPairCheck(parser, local, mapping[local]);
  }
}

function isNCName(name) {
  return NC_NAME_RE.test(name);
}

function isName(name) {
  return NAME_RE.test(name);
}

const FORBIDDEN_START = 0;
const FORBIDDEN_BRACKET = 1;
const FORBIDDEN_BRACKET_BRACKET = 2;

/**
 * Data structure for an XML tag.
 *
 * @typedef {object} SaxesTag
 *
 * @property {string} name The tag's name. This is the combination of prefix and
 * global name. For instance ``<a:b>`` would have ``"a:b"`` for ``name``.
 *
 * @property {string} prefix The tag's prefix. For instance ``<a:b>`` would have
 * ``"a"`` for ``prefix``. Undefined if we do not track namespaces.
 *
 * @property {string} local The tag's local name. For instance ``<a:b>`` would
 * have ``"b"`` for ``local``. Undefined if we do not track namespaces.
 *
 * @property {string} uri The namespace URI of this tag. Undefined if we do not
 * track namespaces.
 *
 * @property {Object.<string, SaxesAttribute> | Object.<string, string>}
 * attributes A map of attribute name to attributes. If namespaces are tracked,
 * the values in the map are {@link SaxesAttribute SaxesAttribute}
 * objects. Otherwise, they are strings.
 *
 * @property {Object.<string, string>} ns The namespace bindings in effect.
 *
 * @property {boolean} isSelfClosing Whether the tag is
 * self-closing (e.g. ``<foo/>``).
 *
 */

/**
 * Data structure for an XML attribute
 *
 * @typedef {object} SaxesAttribute
 *
 * @property {string} name The attribute's name. This is the combination of
 * prefix and local name. For instance ``a:b="c"`` would have ``a:b`` for name.
 *
 * @property {string} prefix The attribute's prefix. For instance ``a:b="c"``
 * would have ``"a"`` for ``prefix``.
 *
 * @property {string} local The attribute's local name. For instance ``a:b="c"``
 * would have ``"b"`` for ``local``.
 *
 * @property {string} uri The namespace URI of this attribute.
 *
 * @property {string} value The attribute's value.
 */

/**
 * @typedef XMLDecl
 *
 * @property {string} [version] The version specified by the XML declaration.
 *
 * @property {string} [encoding] The encoding specified by the XML declaration.
 *
 * @property {string} [standalone] The value of the standalone parameter
 * specified by the XML declaration.
 */

/**
 * @callback ResolvePrefix
 *
 * @param {string} prefix The prefix to check.
 *
 * @returns {string|undefined} The URI corresponding to the prefix, if any.
 */

/**
 * @typedef SaxesOptions
 *
 * @property {boolean} [xmlns] Whether to track namespaces. Unset means
 * ``false``.
 *
 * @property {boolean} [fragment] Whether to accept XML fragments. Unset means
 * ``false``.
 *
 * @property {boolean} [additionalNamespaces] A plain object whose key, value
 * pairs define namespaces known before parsing the XML file. It is not legal
 * to pass bindings for the namespaces ``"xml"`` or ``"xmlns"``.
 *
 * @property {ResolvePrefix} [resolvePrefix] A function that will be used if the
 * parser cannot resolve a namespace prefix on its own.
 *
 * @property {boolean} [position] Whether to track positions. Unset means
 * ``true``.
 *
 * @property {string} [fileName] A file name to use for error reporting. Leaving
 * this unset will report a file name of "undefined". "File name" is a loose
 * concept. You could use a URL to some resource, or any descriptive name you
 * like.
 */

class SaxesParser {
  /**
   * @param {SaxesOptions} opt The parser options.
   */
  constructor(opt) {
    this._init(opt);
  }

  /**
   * Reset the parser state.
   *
   * @private
   */
  _init(opt) {
    this.comment = "";
    this.openWakaBang = "";
    this.text = "";
    this.name = "";
    this.doctype = "";
    this.piTarget = "";
    this.piBody = "";
    this.entity = "";
    this.cdata = "";
    this.xmlDeclName = "";
    this.xmlDeclValue = "";

    /**
     * The options passed to the constructor of this parser.
     *
     * @type {SaxesOptions}
     */
    this.opt = opt || {};

    /**
     * Indicates whether or not the parser is closed. If ``true``, wait for
     * the ``ready`` event to write again.
     *
     * @type {boolean}
     */
    this.closed = false;

    /**
     * The XML declaration for this document.
     *
     * @type {XMLDecl}
     */
    this.xmlDecl = {
      version: undefined,
      encoding: undefined,
      standalone: undefined,
    };

    this.q = null;
    this.tags = [];
    this.tag = null;
    this.chunk = "";
    this.chunkPosition = 0;
    this.i = 0;
    this.trailingCR = false;
    this.forbiddenState = FORBIDDEN_START;
    /**
     * A map of entity name to expansion.
     *
     * @type {Object.<string, string>}
     */
    this.ENTITIES = Object.create(XML_ENTITIES);
    this.attribList = [];

    // The logic is organized so as to minimize the need to check
    // this.opt.fragment while parsing.

    const fragmentOpt = this.fragmentOpt = !!this.opt.fragment;
    this.state = fragmentOpt ? S_TEXT : S_INITIAL;
    // We want these to be all true if we are dealing with a fragment.
    this.reportedTextBeforeRoot = this.reportedTextAfterRoot = this.closedRoot =
      this.sawRoot = fragmentOpt;
    // An XML declaration is intially possible only when parsing whole
    // documents.
    this.xmlDeclPossible = !fragmentOpt;

    this.piIsXMLDecl = false;
    this.xmlDeclState = S_XML_DECL_NAME_START;
    this.xmlDeclExpects = ["version"];
    this.requiredSeparator = false;
    this.entityReturnState = undefined;
    const xmlnsOpt = this.xmlnsOpt = !!this.opt.xmlns;

    if (xmlnsOpt) {
      // This is the function we use to perform name checks on PIs and entities.
      // When namespaces are used, colons are not allowed in PI target names or
      // entity names. So the check depends on whether namespaces are used. See:
      //
      // https://www.w3.org/XML/xml-names-19990114-errata.html
      // NE08
      //
      this.nameStartCheck = isNCNameStartChar;
      this.nameCheck = isNCNameChar;
      this.isName = isNCName;
      this.processAttribs = this.processAttribsNS;
      this.pushAttrib = this.pushAttribNS;

      this.ns = Object.assign({ __proto__: null }, rootNS);
      const additional = this.opt.additionalNamespaces;
      if (additional) {
        nsMappingCheck(this, additional);
        Object.assign(this.ns, additional);
      }
    }
    else {
      this.nameStartCheck = isNameStartChar;
      this.nameCheck = isNameChar;
      this.isName = isName;
      this.processAttribs = this.processAttribsPlain;
      this.pushAttrib = this.pushAttribPlain;
    }

    this.trackPosition = this.opt.position !== false;
    /** The line number the parser is  currently looking at. */
    this.line = 1;

    /** The column the parser is currently looking at. */
    this.column = 0;

    this.fileName = this.opt.fileName;
    this.onready();
  }

  /** The stream position the parser is currently looking at. */
  get position() {
    return this.chunkPosition + this.i;
  }

  /* eslint-disable class-methods-use-this */
  /**
   * Event handler for text data. The default implementation is a no-op.
   *
   * @param {string} text The text data encountered by the parser.
   *
   */
  ontext() {}

  /**
   * Event handler for processing instructions. The default implementation is a
   * no-op.
   *
   * @param {{target: string, body: string}} data The target and body of
   * the processing instruction.
   */
  onprocessinginstruction() {}

  /**
   * Event handler for doctype. The default implementation is a no-op.
   *
   * @param {string} doctype The doctype contents.
   */
  ondoctype() {}

  /**
   * Event handler for comments. The default implementation is a no-op.
   *
   * @param {string} comment The comment contents.
   */
  oncomment() {}

  /**
   * Event handler for the start of an open tag. This is called as soon as we
   * have a tag name. The default implementation is a no-op.
   *
   * @param {SaxesTag} tag The tag.
   */
  onopentagstart() {}

  /**
   * Event handler for an open tag. This is called when the open tag is
   * complete. (We've encountered the ">" that ends the open tag.) The default
   * implementation is a no-op.
   *
   * @param {SaxesTag} tag The tag.
   */
  onopentag() {}

  /**
   * Event handler for a close tag. Note that for self-closing tags, this is
   * called right after ``onopentag``. The default implementation is a no-op.
   *
   * @param {SaxesTag} tag The tag.
   */
  onclosetag() {}

  /**
   * Event handler for a CDATA section. This is called when ending the
   * CDATA section. The default implementation is a no-op.
   *
   * @param {string} cdata The contents of the CDATA section.
   */
  oncdata() {}

  /**
   * Event handler for the stream end. This is called when the stream has been
   * closed with ``close`` or by passing ``null`` to ``write``. The default
   * implementation is a no-op.
   */
  onend() {}

  /**
   * Event handler indicating parser readiness . This is called when the parser
   * is ready to parse a new document.  The default implementation is a no-op.
   */
  onready() {}

  /**
   * Event handler indicating an error. The default implementation throws the
   * error. Override with a no-op handler if you don't want this.
   *
   * @param {Error} err The error that occurred.
   */
  onerror(err) {
    throw new Error(err);
  }
  /* eslint-enable class-methods-use-this */

  /**
   * Report a parsing error. This method is made public so that client code may
   * check for issues that are outside the scope of this project and can report
   * errors.
   *
   * @param {Error} er The error to report.
   *
   * @returns this
   */
  fail(er) {
    const message = (this.trackPosition) ?
          `${this.fileName}:${this.line}:${this.column}: ${er}` : er;

    this.onerror(new Error(message));
    return this;
  }

  /**
   * Write a XML data to the parser.
   *
   * @param {string} chunk The XML data to write.
   *
   * @returns this
   */
  write(chunk) {
    if (this.closed) {
      return this.fail("cannot write after close; assign an onready handler.");
    }

    let end = false;
    if (chunk === null) {
      end = true;
      chunk = "";
    }

    if (typeof chunk === "object") {
      chunk = chunk.toString();
    }

    // We checked if performing a pre-decomposition of the string into an array
    // of single complete characters (``Array.from(chunk)``) would be faster
    // than the current repeated calls to ``codePointAt``. As of August 2018, it
    // isn't. (There may be Node-specific code that would perform faster than
    // ``Array.from`` but don't want to be dependent on Node.)

    let limit = chunk.length;

    if (this.trailingCR) {
      // The previous chunk had a trailing cr. We need to handle it now.
      chunk = `\r${chunk}`;
    }

    if (!end && chunk[limit - 1] === CR) {
      // The chunk ends with a trailing CR. We cannot know how to handle it
      // until we get the next chunk or the end of the stream. So save it for
      // later.
      limit--;
      this.trailingCR = true;
    }
    this.limit = limit;

    this.chunk = chunk;
    this.i = 0;
    while (this.i < limit) {
      this[this.state]();
    }
    this.chunkPosition += limit;

    return end ? this.end() : this;
  }

  /**
   * Close the current stream. Perform final well-formedness checks and reset
   * the parser tstate.
   *
   * @returns this
   */
  close() {
    return this.write(null);
  }

  /**
   * Get a single code point out of the current chunk. This updates the current
   * position if we do position tracking.
   *
   * @private
   *
   * @returns {number} The character read.
   */
  getCode() {
    const { chunk, i } = this;
    // Using charCodeAt and handling the surrogates ourselves is faster
    // than using codePointAt.
    let code = chunk.charCodeAt(i);

    let skip = 1;
    switch (code) {
    case CR:
      // We may get NaN if we read past the end of the chunk, which is
      // fine.
      if (chunk.charCodeAt(i + 1) === NL) {
        // A \r\n sequence is converted to \n so we have to skip over the next
        // character. We already know it has a size of 1 so ++ is fine here.
        skip++;
      }
      // Otherwise, a \r is just converted to \n, so we don't have to skip
      // ahead.

      // In either case, \r becomes \n.
      code = NL;
      /* yes, fall through */
    case NL:
      this.line++;
      this.column = 0;
      break;
    default:
      this.column++;
      if (code >= 0xD800 && code <= 0xDBFF) {
        code = 0x10000 + ((code - 0xD800) * 0x400) +
          (chunk.charCodeAt(i + 1) - 0xDC00);
        this.column++;
        skip++;
      }

      if (!isChar(code)) {
        this.fail("disallowed character.");
      }
    }

    this.i += skip;

    return code;
  }

  /**
   * @callback CharacterTest
   *
   * @private
   *
   * @param {string} c The character to test.
   *
   * @returns {boolean} ``true`` if the method should continue capturing text,
   * ``false`` otherwise.
   */

  /**
   * Capture characters into a buffer until encountering one of a set of
   * characters.
   *
   * @private
   *
   * @param {number[]} chars An array of codepoints. Encountering a character in
   * the array ends the capture.
   *
   * @param {string} buffer The name of the buffer to save into.
   *
   * @return {number|undefined} The character code that made the capture end, or
   * ``undefined`` if we hit the end of the chunk.
   */
  captureTo(chars, buffer) {
    const { chunk, limit, i: start } = this;
    while (this.i < limit) {
      const c = this.getCode();
      if (chars.includes(c)) {
        // This is faster than adding codepoints one by one.
        this[buffer] += chunk.substring(start,
                                        this.i - (c <= 0xFFFF ? 1 : 2));
        return c;
      }
    }

    // This is faster than adding codepoints one by one.
    this[buffer] += chunk.substring(start);
    return undefined;
  }

  /**
   * Capture characters into a buffer until encountering a character.
   *
   * @private
   *
   * @param {number} char The codepoint that ends the capture.
   *
   * @param {string} buffer The name of the buffer to save into.
   *
   * @return {boolean} ``true`` if we ran into the character. Otherwise, we ran
   * into the end of the current chunk.
   */
  captureToChar(char, buffer) {
    const { chunk, limit, i: start } = this;
    while (this.i < limit) {
      const c = this.getCode();
      if (c === char) {
        // This is faster than adding codepoints one by one.
        this[buffer] += chunk.substring(start,
                                        this.i - (c <= 0xFFFF ? 1 : 2));
        return true;
      }
    }

    // This is faster than adding codepoints one by one.
    this[buffer] += chunk.substring(start);
    return false;
  }

  /**
   * Capture characters that satisfy ``isNameChar`` into the ``name`` field of
   * this parser.
   *
   * @private
   *
   * @return {number|undefined} The character code that made the test fail, or
   * ``undefined`` if we hit the end of the chunk.
   */
  captureNameChars() {
    const { chunk, limit, i: start } = this;
    while (this.i < limit) {
      const c = this.getCode();
      if (!isNameChar(c)) {
        // This is faster than adding codepoints one by one.
        this.name += chunk.substring(start,
                                     this.i - (c <= 0xFFFF ? 1 : 2));
        return c;
      }
    }

    // This is faster than adding codepoints one by one.
    this.name += chunk.substring(start);
    return undefined;
  }

  /**
   * Capture characters into a buffer while ``this.nameCheck`` run on the
   * character read returns true.
   *
   * @private
   *
   * @param {string} buffer The name of the buffer to save into.
   *
   * @return {number|undefined} The character code that made the test fail, or
   * ``undefined`` if we hit the end of the chunk.
   */
  captureWhileNameCheck(buffer) {
    const { chunk, limit, i: start } = this;
    while (this.i < limit) {
      const c = this.getCode();
      if (!this.nameCheck(c)) {
        // This is faster than adding codepoints one by one.
        this[buffer] += chunk.substring(start,
                                        this.i - (c <= 0xFFFF ? 1 : 2));
        return c;
      }
    }

    // This is faster than adding codepoints one by one.
    this[buffer] += chunk.substring(start);
    return undefined;
  }

  /**
   * Skip white spaces.
   *
   * @private
   *
   * @return {string|undefined} The character that ended the skip, or
   * ``undefined`` if we hit the end of the chunk.
   */
  skipSpaces() {
    const { limit } = this;
    while (this.i < limit) {
      const c = this.getCode();
      if (!isS(c)) {
        return c;
      }
    }

    return undefined;
  }

  // STATE HANDLERS

  /** @private */
  sInitial() {
    // We are essentially peeking at the first character of the chunk. Since
    // S_INITIAL can be in effect only when we start working on the first chunk,
    // the index at which we must look is necessarily 0. Note also that the
    // following tests do not depend on decoding surrogates.
    const c = this.chunk.charCodeAt(0);
    // If the initial character is 0xFEFF, ignore it.
    if (c === 0xFEFF) {
      this.i++;
      this.column++;
    }
    else if (isS(c)) {
      this.i++;
      this.column++;
      // An XML declaration cannot appear after initial spaces.
      this.xmlDeclPossible = false;
    }

    this.state = S_BEGIN_WHITESPACE;
  }

  /** @private */
  sBeginWhitespace() {
    const c = this.skipSpaces();
    if (c === LESS) {
      this.state = S_OPEN_WAKA;
    }
    else if (c) {
      // have to process this as a text node.
      // weird, but happens.
      if (!this.reportedTextBeforeRoot) {
        this.fail("text data outside of root node.");
        this.reportedTextBeforeRoot = true;
      }
      this.text = String.fromCodePoint(c);
      this.state = S_TEXT;
      this.xmlDeclPossible = false;
    }
  }

  /** @private */
  sText() {
    //
    // We did try a version of saxes where the S_TEXT state was split in two
    // states: one for text inside the root element, and one for text
    // outside. This was avoiding having to test this.tags.length to decide what
    // implementation to actually use.
    //
    // Peformance testing on gigabyte-size files did not show any advantage to
    // using the two states solution instead of the current one. Conversely, it
    // made the code a bit more complicated elsewhere. For instance, a comment
    // can appear before the root element so when a comment ended it was
    // necessary to determine whether to return to the S_TEXT state or to the
    // new text-outside-root state.
    //
    if (this.tags.length !== 0) {
      this.handleTextInRoot();
    }
    else {
      this.handleTextOutsideRoot();
    }
  }

  /** @private */
  handleTextInRoot() {
    // This is essentially a specialized version of captureTo which is optimized
    // for performing the ]]> check. A previous version of this code, checked
    // ``this.text`` for the presence of ]]>. It simplified the code but was
    // very costly when character data contained a lot of entities to be parsed.
    //
    // Since we are using a specialized loop, we also keep track of the presence
    // of ]]> in text data. The sequence ]]> is forbidden to appear as-is.
    //
    const { chunk, limit, i: start } = this;
    let { forbiddenState } = this;
    let c;
    // eslint-disable-next-line no-labels, no-restricted-syntax
    scanLoop:
    while (this.i < limit) {
      const code = this.getCode();
      switch (code) {
      case LESS:
        this.state = S_OPEN_WAKA;
        c = code;
        forbiddenState = FORBIDDEN_START;
        // eslint-disable-next-line no-labels
        break scanLoop;
      case AMP:
        this.state = S_ENTITY;
        this.entityReturnState = S_TEXT;
        c = code;
        forbiddenState = FORBIDDEN_START;
        // eslint-disable-next-line no-labels
        break scanLoop;
      case CLOSE_BRACKET:
        switch (forbiddenState) {
        case FORBIDDEN_START:
          forbiddenState = FORBIDDEN_BRACKET;
          break;
        case FORBIDDEN_BRACKET:
          forbiddenState = FORBIDDEN_BRACKET_BRACKET;
          break;
        case FORBIDDEN_BRACKET_BRACKET:
          break;
        default:
          throw new Error("impossible state");
        }
        break;
      case GREATER:
        if (forbiddenState === FORBIDDEN_BRACKET_BRACKET) {
          this.fail("the string \"]]>\" is disallowed in char data.");
        }
        forbiddenState = FORBIDDEN_START;
        break;
      default:
        forbiddenState = FORBIDDEN_START;
      }
    }
    this.forbiddenState = forbiddenState;

    // This is faster than adding codepoints one by one.
    this.text += chunk.substring(start,
                                 c === undefined ? undefined :
                                 (this.i - (c <= 0xFFFF ? 1 : 2)));
  }

  /** @private */
  handleTextOutsideRoot() {
    // This is essentially a specialized version of captureTo which is optimized
    // for performing the ]]> check. A previous version of this code, checked
    // ``this.text`` for the presence of ]]>. It simplified the code but was
    // very costly when character data contained a lot of entities to be parsed.
    //
    // Since we are using a specialized loop, we also keep track of the presence
    // of non-space characters in the text since these are errors when appearing
    // outside the document root element.
    //
    const { chunk, limit, i: start } = this;
    let nonSpace = false;
    let c;
    // eslint-disable-next-line no-labels, no-restricted-syntax
    outRootLoop:
    while (this.i < limit) {
      const code = this.getCode();
      switch (code) {
      case LESS:
        this.state = S_OPEN_WAKA;
        c = code;
        // eslint-disable-next-line no-labels
        break outRootLoop;
      case AMP:
        this.state = S_ENTITY;
        this.entityReturnState = S_TEXT;
        c = code;
        nonSpace = true;
        // eslint-disable-next-line no-labels
        break outRootLoop;
      default:
        if (!isS(code)) {
          nonSpace = true;
        }
      }
    }

    // This is faster than adding codepoints one by one.
    this.text += chunk.substring(start,
                                 c === undefined ? undefined :
                                 (this.i - (c <= 0xFFFF ? 1 : 2)));

    if (!nonSpace) {
      return;
    }

    // We use the reportedTextBeforeRoot and reportedTextAfterRoot flags
    // to avoid reporting errors for every single character that is out of
    // place.
    if (!this.sawRoot && !this.reportedTextBeforeRoot) {
      this.fail("text data outside of root node.");
      this.reportedTextBeforeRoot = true;
    }

    if (this.closedRoot && !this.reportedTextAfterRoot) {
      this.fail("text data outside of root node.");
      this.reportedTextAfterRoot = true;
    }
  }

  /** @private */
  sOpenWaka() {
    const c = this.getCode();
    // either a /, ?, !, or text is coming next.
    if (isNameStartChar(c)) {
      this.state = S_OPEN_TAG;
      this.name = String.fromCodePoint(c);
      this.xmlDeclPossible = false;
    }
    else {
      switch (c) {
      case FORWARD_SLASH:
        this.state = S_CLOSE_TAG;
        this.xmlDeclPossible = false;
        break;
      case BANG:
        this.state = S_OPEN_WAKA_BANG;
        this.openWakaBang = "";
        this.xmlDeclPossible = false;
        break;
      case QUESTION:
        this.state = S_PI_FIRST_CHAR;
        break;
      default:
        this.fail("disallowed character in tag name.");
        this.state = S_TEXT;
        this.xmlDeclPossible = false;
      }
    }
  }

  /** @private */
  sOpenWakaBang() {
    this.openWakaBang += String.fromCodePoint(this.getCode());
    switch (this.openWakaBang) {
    case "[CDATA[":
      if (!this.sawRoot && !this.reportedTextBeforeRoot) {
        this.fail("text data outside of root node.");
        this.reportedTextBeforeRoot = true;
      }

      if (this.closedRoot && !this.reportedTextAfterRoot) {
        this.fail("text data outside of root node.");
        this.reportedTextAfterRoot = true;
      }
      this.state = S_CDATA;
      this.openWakaBang = "";
      break;
    case "--":
      this.state = S_COMMENT;
      this.openWakaBang = "";
      break;
    case "DOCTYPE":
      this.state = S_DOCTYPE;
      if (this.doctype || this.sawRoot) {
        this.fail("inappropriately located doctype declaration.");
      }
      this.openWakaBang = "";
      break;
    default:
      // 7 happens to be the maximum length of the string that can possibly
      // match one of the cases above.
      if (this.openWakaBang.length >= 7) {
        this.fail("incorrect syntax.");
      }
    }
  }

  /** @private */
  sDoctype() {
    const c = this.captureTo(DOCTYPE_TERMINATOR, "doctype");
    if (c === GREATER) {
      this.state = S_TEXT;
      if (this.text.length !== 0) {
        this.closeText();
      }
      this.ondoctype(this.doctype);
      this.doctype = true; // just remember that we saw it.
    }
    else if (c) {
      this.doctype += String.fromCodePoint(c);
      if (c === OPEN_BRACKET) {
        this.state = S_DTD;
      }
      else if (isQuote(c)) {
        this.state = S_DOCTYPE_QUOTE;
        this.q = c;
      }
    }
  }

  /** @private */
  sDoctypeQuote() {
    const { q } = this;
    if (this.captureToChar(q, "doctype")) {
      this.doctype += String.fromCodePoint(q);
      this.q = null;
      this.state = S_DOCTYPE;
    }
  }

  /** @private */
  sDTD() {
    const c = this.captureTo(DTD_TERMINATOR, "doctype");
    if (!c) {
      return;
    }

    this.doctype += String.fromCodePoint(c);
    if (c === CLOSE_BRACKET) {
      this.state = S_DOCTYPE;
    }
    else if (c === LESS) {
      this.state = S_DTD_OPEN_WAKA;
    }
    else if (isQuote(c)) {
      this.state = S_DTD_QUOTED;
      this.q = c;
    }
  }

  /** @private */
  sDTDQuoted() {
    const { q } = this;
    if (this.captureToChar(q, "doctype")) {
      this.doctype += String.fromCodePoint(q);
      this.state = S_DTD;
      this.q = null;
    }
  }

  /** @private */
  sDTDOpenWaka() {
    const c = this.getCode();
    this.doctype += String.fromCodePoint(c);
    switch (c) {
    case BANG:
      this.state = S_DTD_OPEN_WAKA_BANG;
      this.openWakaBang = "";
      break;
    case QUESTION:
      this.state = S_DTD_PI;
      break;
    default:
      this.state = S_DTD;
    }
  }

  /** @private */
  sDTDOpenWakaBang() {
    const char = String.fromCodePoint(this.getCode());
    const owb = this.openWakaBang += char;
    this.doctype += char;
    if (owb !== "-") {
      this.state = owb === "--" ? S_DTD_COMMENT : S_DTD;
      this.openWakaBang = "";
    }
  }

  /** @private */
  sDTDComment() {
    if (this.captureToChar(MINUS, "doctype")) {
      this.doctype += "-";
      this.state = S_DTD_COMMENT_ENDING;
    }
  }

  /** @private */
  sDTDCommentEnding() {
    const c = this.getCode();
    this.doctype += String.fromCodePoint(c);
    this.state = c === MINUS ? S_DTD_COMMENT_ENDED : S_DTD_COMMENT;
  }

  /** @private */
  sDTDCommentEnded() {
    const c = this.getCode();
    this.doctype += String.fromCodePoint(c);
    if (c === GREATER) {
      this.state = S_DTD;
    }
    else {
      this.fail("malformed comment.");
      // <!-- blah -- bloo --> will be recorded as
      // a comment of " blah -- bloo "
      this.state = S_DTD_COMMENT;
    }
  }

  /** @private */
  sDTDPI() {
    if (this.captureToChar(QUESTION, "doctype")) {
      this.doctype += "?";
      this.state = S_DTD_PI_ENDING;
    }
  }

  /** @private */
  sDTDPIEnding() {
    const c = this.getCode();
    this.doctype += String.fromCodePoint(c);
    if (c === GREATER) {
      this.state = S_DTD;
    }
  }

  /** @private */
  sComment() {
    if (this.captureToChar(MINUS, "comment")) {
      this.state = S_COMMENT_ENDING;
    }
  }

  /** @private */
  sCommentEnding() {
    const c = this.getCode();
    if (c === MINUS) {
      this.state = S_COMMENT_ENDED;
      if (this.text.length !== 0) {
        this.closeText();
      }
      this.oncomment(this.comment);
      this.comment = "";
    }
    else {
      this.comment += `-${String.fromCodePoint(c)}`;
      this.state = S_COMMENT;
    }
  }

  /** @private */
  sCommentEnded() {
    const c = this.getCode();
    if (c !== GREATER) {
      this.fail("malformed comment.");
      // <!-- blah -- bloo --> will be recorded as
      // a comment of " blah -- bloo "
      this.comment += `--${String.fromCodePoint(c)}`;
      this.state = S_COMMENT;
    }
    else {
      this.state = S_TEXT;
    }
  }

  /** @private */
  sCData() {
    if (this.captureToChar(CLOSE_BRACKET, "cdata")) {
      this.state = S_CDATA_ENDING;
    }
  }

  /** @private */
  sCDataEnding() {
    const c = this.getCode();
    if (c === CLOSE_BRACKET) {
      this.state = S_CDATA_ENDING_2;
    }
    else {
      this.cdata += `]${String.fromCodePoint(c)}`;
      this.state = S_CDATA;
    }
  }

  /** @private */
  sCDataEnding2() {
    const c = this.getCode();
    switch (c) {
    case GREATER:
      if (this.text.length !== 0) {
        this.closeText();
      }
      this.oncdata(this.cdata);
      this.cdata = "";
      this.state = S_TEXT;
      break;
    case CLOSE_BRACKET:
      this.cdata += "]";
      break;
    default:
      this.cdata += `]]${String.fromCodePoint(c)}`;
      this.state = S_CDATA;
    }
  }

  /** @private */
  sPIFirstChar() {
    const c = this.getCode();
    if (this.nameStartCheck(c)) {
      this.piTarget += String.fromCodePoint(c);
      this.state = S_PI_REST;
    }
    else if (c === QUESTION || isS(c)) {
      this.fail("processing instruction without a target.");
      this.state = c === QUESTION ? S_PI_ENDING : S_PI_BODY;
    }
    else {
      this.fail("disallowed character in processing instruction name.");
      this.piTarget += String.fromCodePoint(c);
      this.state = S_PI_REST;
    }
  }

  /** @private */
  sPIRest() {
    const c = this.captureWhileNameCheck("piTarget");
    if ((c === QUESTION || isS(c))) {
      this.piIsXMLDecl = this.piTarget === "xml";
      if (this.piIsXMLDecl && !this.xmlDeclPossible) {
        this.fail("an XML declaration must be at the start of the document.");
      }
      this.state = c === QUESTION ? S_PI_ENDING : S_PI_BODY;
    }
    else if (c) {
      this.fail("disallowed character in processing instruction name.");
      this.piTarget += String.fromCodePoint(c);
    }
  }

  /** @private */
  sPIBody() {
    let c;
    if (this.piIsXMLDecl) {
      switch (this.xmlDeclState) {
      case S_XML_DECL_NAME_START: {
        c = this.getCode();
        if (isS(c)) {
          c = this.skipSpaces();
        }
        else if (this.requiredSeparator && c !== QUESTION) {
          this.fail("whitespace required.");
        }
        this.requiredSeparator = false;

        // The question mark character is not valid inside any of the XML
        // declaration name/value pairs.
        if (c === QUESTION) {
          this.state = S_PI_ENDING;
          return;
        }

        if (c) {
          this.xmlDeclState = S_XML_DECL_NAME;
          this.xmlDeclName = String.fromCodePoint(c);
        }
        break;
      }
      case S_XML_DECL_NAME:
        c = this.captureTo(XML_DECL_NAME_TERMINATOR, "xmlDeclName");
        // The question mark character is not valid inside any of the XML
        // declaration name/value pairs.
        if (c === QUESTION) {
          this.state = S_PI_ENDING;
          return;
        }
        if (isS(c) || c === EQUAL) {
          if (!this.xmlDeclExpects.includes(this.xmlDeclName)) {
            switch (this.xmlDeclName.length) {
            case 0:
              this.fail("did not expect any more name/value pairs.");
              break;
            case 1:
              this.fail(`expected the name ${this.xmlDeclExpects[0]}.`);
              break;
            default:
              this.fail(`expected one of ${this.xmlDeclExpects.join(", ")}`);
            }
          }

          this.xmlDeclState = (c === EQUAL) ? S_XML_DECL_VALUE_START :
            S_XML_DECL_EQ;
        }
        break;
      case S_XML_DECL_EQ:
        c = this.getCode();
        // The question mark character is not valid inside any of the XML
        // declaration name/value pairs.
        if (c === QUESTION) {
          this.state = S_PI_ENDING;
          return;
        }

        if (!isS(c)) {
          if (c !== EQUAL) {
            this.fail("value required.");
          }
          this.xmlDeclState = S_XML_DECL_VALUE_START;
        }
        break;
      case S_XML_DECL_VALUE_START:
        c = this.getCode();
        // The question mark character is not valid inside any of the XML
        // declaration name/value pairs.
        if (c === QUESTION) {
          this.state = S_PI_ENDING;
          return;
        }

        if (!isS(c)) {
          if (!isQuote(c)) {
            this.fail("value must be quoted.");
            this.q = SPACE;
          }
          else {
            this.q = c;
          }
          this.xmlDeclState = S_XML_DECL_VALUE;
        }
        break;
      case S_XML_DECL_VALUE:
        c = this.captureTo([this.q, QUESTION], "xmlDeclValue");

        // The question mark character is not valid inside any of the XML
        // declaration name/value pairs.
        if (c === QUESTION) {
          this.state = S_PI_ENDING;
          return;
        }

        if (c) {
          switch (this.xmlDeclName) {
          case "version":
            if (!/^1\.[0-9]+$/.test(this.xmlDeclValue)) {
              this.fail("version number must match /^1\\.[0-9]+$/.");
            }
            this.xmlDeclExpects = ["encoding", "standalone"];
            this.xmlDecl.version = this.xmlDeclValue;
            break;
          case "encoding":
            if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(this.xmlDeclValue)) {
              this.fail("encoding value must match \
/^[A-Za-z0-9][A-Za-z0-9._-]*$/.");
            }
            this.xmlDeclExpects = ["standalone"];
            this.xmlDecl.encoding = this.xmlDeclValue;
            break;
          case "standalone":
            if (this.xmlDeclValue !== "yes" && this.xmlDeclValue !== "no") {
              this.fail("standalone value must match \"yes\" or \"no\".");
            }
            this.xmlDeclExpects = [];
            this.xmlDecl.standalone = this.xmlDeclValue;
            break;
          default:
            // We don't need to raise an error here since we've already
            // raised one when checking what name was expected.
          }
          this.xmlDeclName = this.xmlDeclValue = "";
          this.xmlDeclState = S_XML_DECL_NAME_START;
          this.requiredSeparator = true;
        }
        break;
      default:
        throw new Error(this,
                        `Unknown XML declaration state: ${this.xmlDeclState}`);
      }
    }
    else if (this.piBody.length === 0) {
      c = this.getCode();
      if (c === QUESTION) {
        this.state = S_PI_ENDING;
      }
      else if (!isS(c)) {
        this.piBody = String.fromCodePoint(c);
      }
    }
    // The question mark character is not valid inside any of the XML
    // declaration name/value pairs.
    else if (this.captureToChar(QUESTION, "piBody")) {
      this.state = S_PI_ENDING;
    }
  }

  /** @private */
  sPIEnding() {
    const c = this.getCode();
    if (this.piIsXMLDecl) {
      if (c === GREATER) {
        if (this.piTarget !== "xml") {
          this.fail("processing instructions are not allowed before root.");
        }
        else if (this.xmlDeclState !== S_XML_DECL_NAME_START) {
          this.fail("XML declaration is incomplete.");
        }
        else if (this.xmlDeclExpects.includes("version")) {
          this.fail("XML declaration must contain a version.");
        }
        this.xmlDeclName = this.xmlDeclValue = "";
        this.requiredSeparator = false;
        this.piTarget = this.piBody = "";
        this.state = S_TEXT;
      }
      else {
        // We got here because the previous character was a ?, but the
        // question mark character is not valid inside any of the XML
        // declaration name/value pairs.
        this.fail(
          "The character ? is disallowed anywhere in XML declarations.");
      }
    }
    else if (c === GREATER) {
      if (this.piTarget.trim().toLowerCase() === "xml") {
        this.fail("the XML declaration must appear at the start of the document.");
      }
      if (this.text.length !== 0) {
        this.closeText();
      }
      this.onprocessinginstruction({
        target: this.piTarget,
        body: this.piBody,
      });
      this.piTarget = this.piBody = "";
      this.state = S_TEXT;
    }
    else if (c === QUESTION) {
      // We ran into ?? as part of a processing instruction. We initially
      // took the first ? as a sign that the PI was ending, but it is
      // not. So we have to add it to the body but we take the new ? as a
      // sign that the PI is ending.
      this.piBody += "?";
    }
    else {
      this.piBody += `?${String.fromCodePoint(c)}`;
      this.state = S_PI_BODY;
    }
    this.xmlDeclPossible = false;
  }

  /** @private */
  sOpenTag() {
    const c = this.captureNameChars();
    if (!c) {
      return;
    }

    const tag = this.tag = {
      name: this.name,
      attributes: Object.create(null),
    };

    if (this.xmlnsOpt) {
      tag.ns = Object.create(null);
    }

    if (this.text.length !== 0) {
      this.closeText();
    }
    this.onopentagstart(tag);
    this.sawRoot = true;
    if (!this.fragmentOpt && this.closedRoot) {
      this.fail("documents may contain only one root.");
    }

    switch (c) {
    case GREATER:
      this.openTag();
      break;
    case FORWARD_SLASH:
      this.state = S_OPEN_TAG_SLASH;
      break;
    default:
      if (!isS(c)) {
        this.fail("disallowed character in tag name.");
      }
      this.state = S_ATTRIB;
    }
  }

  /** @private */
  sOpenTagSlash() {
    const c = this.getCode();
    if (c === GREATER) {
      this.openSelfClosingTag();
    }
    else {
      this.fail("forward-slash in opening tag not followed by >.");
      this.state = S_ATTRIB;
    }
  }

  /** @private */
  sAttrib() {
    const c = this.skipSpaces();
    if (!c) {
      return;
    }
    if (isNameStartChar(c)) {
      this.name = String.fromCodePoint(c);
      this.state = S_ATTRIB_NAME;
    }
    else if (c === GREATER) {
      this.openTag();
    }
    else if (c === FORWARD_SLASH) {
      this.state = S_OPEN_TAG_SLASH;
    }
    else {
      this.fail("disallowed character in attribute name.");
    }
  }

  /** @private */
  pushAttribNS(name, value) {
    const { prefix, local } = this.qname(name);
    this.attribList.push({ name, prefix, local, value, uri: undefined });
    if (prefix === "xmlns") {
      const trimmed = value.trim();
      this.tag.ns[local] = trimmed;
      nsPairCheck(this, local, trimmed);
    }
    else if (name === "xmlns") {
      const trimmed = value.trim();
      this.tag.ns[""] = trimmed;
      nsPairCheck(this, "", trimmed);
    }
  }

  /** @private */
  pushAttribPlain(name, value) {
    this.attribList.push({ name, value });
  }

  /** @private */
  sAttribName() {
    const c = this.captureNameChars();
    if (c === EQUAL) {
      this.state = S_ATTRIB_VALUE;
    }
    else if (isS(c)) {
      this.state = S_ATTRIB_NAME_SAW_WHITE;
    }
    else if (c === GREATER) {
      this.fail("attribute without value.");
      this.pushAttrib(this.name, this.name);
      this.name = this.text = "";
      this.openTag();
    }
    else if (c) {
      this.fail("disallowed character in attribute name.");
    }
  }

  /** @private */
  sAttribNameSawWhite() {
    const c = this.skipSpaces();
    if (!c) {
      return;
    }

    if (c === EQUAL) {
      this.state = S_ATTRIB_VALUE;
    }
    else {
      this.fail("attribute without value.");
      this.tag.attributes[this.name] = "";
      this.text = "";
      this.name = "";
      if (c === GREATER) {
        this.openTag();
      }
      else if (isNameStartChar(c)) {
        this.name = String.fromCodePoint(c);
        this.state = S_ATTRIB_NAME;
      }
      else {
        this.fail("disallowed character in attribute name.");
        this.state = S_ATTRIB;
      }
    }
  }

  /** @private */
  sAttribValue() {
    const c = this.getCode();
    if (isQuote(c)) {
      this.q = c;
      this.state = S_ATTRIB_VALUE_QUOTED;
    }
    else if (!isS(c)) {
      this.fail("unquoted attribute value.");
      this.state = S_ATTRIB_VALUE_UNQUOTED;
      this.text = String.fromCodePoint(c);
    }
  }

  /** @private */
  sAttribValueQuoted() {
    // We deliberately do not use captureTo here. The specialized code we use
    // here is faster than using captureTo.
    const { q } = this;
    const { chunk, limit, i: start } = this;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.i >= limit) {
        // This is faster than adding codepoints one by one.
        this.text += chunk.substring(start);
        return;
      }
      const code = this.getCode();
      if (code === q || code === AMP || code === LESS) {
        // This is faster than adding codepoints one by one.
        const slice = chunk.substring(start,
                                      this.i - (code <= 0xFFFF ? 1 : 2));
        switch (code) {
        case q:
          this.pushAttrib(this.name, this.text + slice);
          this.name = this.text = "";
          this.q = null;
          this.state = S_ATTRIB_VALUE_CLOSED;
          return;
        case AMP:
          this.text += slice;
          this.state = S_ENTITY;
          this.entityReturnState = S_ATTRIB_VALUE_QUOTED;
          return;
        default:
          this.text += slice;
          this.fail("disallowed character.");
          return;
        }
      }
    }
  }

  /** @private */
  sAttribValueClosed() {
    const c = this.getCode();
    if (isS(c)) {
      this.state = S_ATTRIB;
    }
    else if (c === GREATER) {
      this.openTag();
    }
    else if (c === FORWARD_SLASH) {
      this.state = S_OPEN_TAG_SLASH;
    }
    else if (isNameStartChar(c)) {
      this.fail("no whitespace between attributes.");
      this.name = String.fromCodePoint(c);
      this.state = S_ATTRIB_NAME;
    }
    else {
      this.fail("disallowed character in attribute name.");
    }
  }

  /** @private */
  sAttribValueUnquoted() {
    const c = this.captureTo(ATTRIB_VALUE_UNQUOTED_TERMINATOR, "text");
    if (c === AMP) {
      this.state = S_ENTITY;
      this.entityReturnState = S_ATTRIB_VALUE_UNQUOTED;
    }
    else if (c === LESS) {
      this.fail("disallowed character.");
    }
    else if (c) {
      if (this.text.includes("]]>")) {
        this.fail("the string \"]]>\" is disallowed in char data.");
      }
      this.pushAttrib(this.name, this.text);
      this.name = this.text = "";
      if (c === GREATER) {
        this.openTag();
      }
      else {
        this.state = S_ATTRIB;
      }
    }
  }

  /** @private */
  sCloseTag() {
    const c = this.captureNameChars();
    if (c === GREATER) {
      this.closeTag();
    }
    else if (isS(c)) {
      this.state = S_CLOSE_TAG_SAW_WHITE;
    }
    else if (c) {
      this.fail("disallowed character in closing tag.");
    }
  }

  /** @private */
  sCloseTagSawWhite() {
    const c = this.skipSpaces();
    if (c === GREATER) {
      this.closeTag();
    }
    else if (c) {
      this.fail("disallowed character in closing tag.");
    }
  }

  /** @private */
  sEntity() {
    if (this.captureToChar(SEMICOLON, "entity")) {
      this.state = this.entityReturnState;
      if (this.entity === "") {
        this.fail("empty entity name.");
        this.text += "&;";
        return;
      }
      this.text += this.parseEntity(this.entity);
      this.entity = "";
    }
  }

  // END OF STATE HANDLERS

  /**
   * End parsing. This performs final well-formedness checks and resets the
   * parser to a clean state.
   *
   * @private
   *
   * @returns this
   */
  end() {
    if (!this.sawRoot) {
      this.fail("document must contain a root element.");
    }
    const { tags } = this;
    while (tags.length > 0) {
      const tag = tags.pop();
      this.fail(`unclosed tag: ${tag.name}`);
    }
    if ((this.state !== S_INITIAL) &&
        (this.state !== S_TEXT)) {
      this.fail("unexpected end.");
    }
    if (this.text.length !== 0) {
      this.closeText();
    }
    this.closed = true;
    this.onend();
    this._init(this.opt);
    return this;
  }

  /**
   * If there's text to emit ``ontext``, emit it.
   *
   * @private
   */
  closeText() {
    this.ontext(this.text);
    this.text = "";
  }

  /**
   * Resolve a namespace prefix.
   *
   * @param {string} prefix The prefix to resolve.
   *
   * @returns {string|undefined} The namespace URI or ``undefined`` if the
   * prefix is not defined.
   */
  resolve(prefix) {
    let uri = this.tag.ns[prefix];
    if (uri !== undefined) {
      return uri;
    }

    const { tags } = this;
    for (let index = tags.length - 1; index >= 0; index--) {
      uri = tags[index].ns[prefix];
      if (uri !== undefined) {
        return uri;
      }
    }

    uri = this.ns[prefix];
    if (uri) {
      return uri;
    }

    const { resolvePrefix } = this.opt;
    return resolvePrefix ? resolvePrefix(prefix) : undefined;
  }

  /**
   * Parse a qname into its prefix and local name parts.
   *
   * @private
   *
   * @param {string} name The name to parse
   *
   * @returns {{prefix: string, local: string}}
   */
  qname(name) {
    const colon = name.indexOf(":");
    if (colon === -1) {
      return { prefix: "", local: name };
    }

    const local = name.substring(colon + 1);
    const prefix = name.substring(0, colon);
    if (prefix === "" || local === "" || local.includes(":")) {
      this.fail(`malformed name: ${name}.`);
    }

    return { prefix, local };
  }

  /** @private */
  processAttribsNS() {
    const { tag, attribList } = this;
    const { name: tagName, attributes } = tag;

    {
      // add namespace info to tag
      const { prefix, local } = this.qname(tagName);
      tag.prefix = prefix;
      tag.local = local;
      const uri = tag.uri = this.resolve(prefix) || "";

      if (prefix) {
        if (prefix === "xmlns") {
          this.fail("tags may not have \"xmlns\" as prefix.");
        }

        if (!uri) {
          this.fail(`unbound namespace prefix: ${JSON.stringify(prefix)}.`);
          tag.uri = prefix;
        }
      }
    }

    if (attribList.length === 0) {
      return;
    }

    const seen = new Set();
    // Note: do not apply default ns to attributes:
    //   http://www.w3.org/TR/REC-xml-names/#defaulting
    for (const attr of attribList) {
      const { name, prefix, local } = attr;
      let uri;
      let eqname;
      if (prefix === "") {
        uri = (name === "xmlns") ? XMLNS_NAMESPACE : "";
        eqname = name;
      }
      else {
        uri = this.resolve(prefix);
        // if there's any attributes with an undefined namespace,
        // then fail on them now.
        if (!uri) {
          this.fail(`unbound namespace prefix: ${JSON.stringify(prefix)}.`);
          uri = prefix;
        }
        eqname = `{${uri}}${local}`;
      }

      if (seen.has(eqname)) {
        this.fail(`duplicate attribute: ${eqname}.`);
      }
      seen.add(eqname);

      attr.uri = uri;
      attributes[name] = attr;
    }

    this.attribList = [];
  }

  /** @private */
  processAttribsPlain() {
    const { attribList, tag: { attributes } } = this;
    for (const { name, value } of attribList) {
      if (attributes[name]) {
        this.fail(`duplicate attribute: ${name}.`);
      }
      attributes[name] = value;
    }

    this.attribList = [];
  }

  /**
   * Handle a complete open tag. This parser code calls this once it has seen
   * the whole tag. This method checks for well-formeness and then emits
   * ``onopentag``.
   *
   * @private
   */
  openTag() {
    this.processAttribs();

    const { tag, tags } = this;
    tag.isSelfClosing = false;

    // There cannot be any pending text here due to the onopentagstart that was
    // necessarily emitted before we get here. So we do not check text.
    this.onopentag(tag);
    tags.push(tag);
    this.state = S_TEXT;
    this.name = "";
  }

  /**
   * Handle a complete self-closing tag. This parser code calls this once it has
   * seen the whole tag. This method checks for well-formeness and then emits
   * ``onopentag`` and ``onclosetag``.
   *
   * @private
   */
  openSelfClosingTag() {
    this.processAttribs();

    const { tag, tags } = this;
    tag.isSelfClosing = true;

    // There cannot be any pending text here due to the onopentagstart that was
    // necessarily emitted before we get here. So we do not check text.
    this.onopentag(tag);
    this.onclosetag(tag);
    const top = this.tag = tags[tags.length - 1];
    if (!top) {
      this.closedRoot = true;
    }
    this.state = S_TEXT;
    this.name = "";
  }

  /**
   * Handle a complete close tag. This parser code calls this once it has seen
   * the whole tag. This method checks for well-formeness and then emits
   * ``onclosetag``.
   *
   * @private
   */
  closeTag() {
    const { tags, name } = this;

    // Our state after this will be S_TEXT, no matter what, and we can clear
    // tagName now.
    this.state = S_TEXT;
    this.name = "";

    if (!name) {
      this.fail("weird empty close tag.");
      this.text += "</>";
      return;
    }

    let l = tags.length;
    while (l-- > 0) {
      const tag = this.tag = tags.pop();
      if (this.text.length !== 0) {
        this.closeText();
      }
      this.onclosetag(tag);
      if (tag.name === name) {
        break;
      }
      this.fail("unexpected close tag.");
    }

    if (l === 0) {
      this.closedRoot = true;
    }
    else if (l < 0) {
      this.fail(`unmatched closing tag: ${name}.`);
      this.text += `</${name}>`;
    }
  }

  /**
   * Resolves an entity. Makes any necessary well-formedness checks.
   *
   * @private
   *
   * @param {string} entity The entity to resolve.
   *
   * @returns {string} The parsed entity.
   */
  parseEntity(entity) {
    if (entity[0] !== "#") {
      const defined = this.ENTITIES[entity];
      if (defined) {
        return defined;
      }

      this.fail(this.isName(entity) ? "undefined entity." :
               "disallowed character in entity name.");
      return `&${entity};`;
    }

    let num = NaN;
    if (entity[1] === "x" && /^#x[0-9a-f]+$/i.test(entity)) {
      num = parseInt(entity.slice(2), 16);
    }
    else if (/^#[0-9]+$/.test(entity)) {
      num = parseInt(entity.slice(1), 10);
    }

    // The character reference is required to match the CHAR production.
    if (!isChar(num)) {
      this.fail("malformed character entity.");
      return `&${entity};`;
    }

    return String.fromCodePoint(num);
  }
}

exports.SaxesParser = SaxesParser;

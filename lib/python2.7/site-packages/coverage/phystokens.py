# Licensed under the Apache License: http://www.apache.org/licenses/LICENSE-2.0
# For details: https://bitbucket.org/ned/coveragepy/src/default/NOTICE.txt

"""Better tokenizing for coverage.py."""

import codecs
import keyword
import re
import sys
import token
import tokenize

from coverage import env
from coverage.backward import iternext, unicode_class
from coverage.misc import contract


def phys_tokens(toks):
    """Return all physical tokens, even line continuations.

    tokenize.generate_tokens() doesn't return a token for the backslash that
    continues lines.  This wrapper provides those tokens so that we can
    re-create a faithful representation of the original source.

    Returns the same values as generate_tokens()

    """
    last_line = None
    last_lineno = -1
    last_ttype = None
    for ttype, ttext, (slineno, scol), (elineno, ecol), ltext in toks:
        if last_lineno != elineno:
            if last_line and last_line.endswith("\\\n"):
                # We are at the beginning of a new line, and the last line
                # ended with a backslash.  We probably have to inject a
                # backslash token into the stream. Unfortunately, there's more
                # to figure out.  This code::
                #
                #   usage = """\
                #   HEY THERE
                #   """
                #
                # triggers this condition, but the token text is::
                #
                #   '"""\\\nHEY THERE\n"""'
                #
                # so we need to figure out if the backslash is already in the
                # string token or not.
                inject_backslash = True
                if last_ttype == tokenize.COMMENT:
                    # Comments like this \
                    # should never result in a new token.
                    inject_backslash = False
                elif ttype == token.STRING:
                    if "\n" in ttext and ttext.split('\n', 1)[0][-1] == '\\':
                        # It's a multi-line string and the first line ends with
                        # a backslash, so we don't need to inject another.
                        inject_backslash = False
                if inject_backslash:
                    # Figure out what column the backslash is in.
                    ccol = len(last_line.split("\n")[-2]) - 1
                    # Yield the token, with a fake token type.
                    yield (
                        99999, "\\\n",
                        (slineno, ccol), (slineno, ccol+2),
                        last_line
                        )
            last_line = ltext
            last_ttype = ttype
        yield ttype, ttext, (slineno, scol), (elineno, ecol), ltext
        last_lineno = elineno


@contract(source='unicode')
def source_token_lines(source):
    """Generate a series of lines, one for each line in `source`.

    Each line is a list of pairs, each pair is a token::

        [('key', 'def'), ('ws', ' '), ('nam', 'hello'), ('op', '('), ... ]

    Each pair has a token class, and the token text.

    If you concatenate all the token texts, and then join them with newlines,
    you should have your original `source` back, with two differences:
    trailing whitespace is not preserved, and a final line with no newline
    is indistinguishable from a final line with a newline.

    """

    ws_tokens = set([token.INDENT, token.DEDENT, token.NEWLINE, tokenize.NL])
    line = []
    col = 0

    source = source.expandtabs(8).replace('\r\n', '\n')
    tokgen = generate_tokens(source)

    for ttype, ttext, (_, scol), (_, ecol), _ in phys_tokens(tokgen):
        mark_start = True
        for part in re.split('(\n)', ttext):
            if part == '\n':
                yield line
                line = []
                col = 0
                mark_end = False
            elif part == '':
                mark_end = False
            elif ttype in ws_tokens:
                mark_end = False
            else:
                if mark_start and scol > col:
                    line.append(("ws", u" " * (scol - col)))
                    mark_start = False
                tok_class = tokenize.tok_name.get(ttype, 'xx').lower()[:3]
                if ttype == token.NAME and keyword.iskeyword(ttext):
                    tok_class = "key"
                line.append((tok_class, part))
                mark_end = True
            scol = 0
        if mark_end:
            col = ecol

    if line:
        yield line


class CachedTokenizer(object):
    """A one-element cache around tokenize.generate_tokens.

    When reporting, coverage.py tokenizes files twice, once to find the
    structure of the file, and once to syntax-color it.  Tokenizing is
    expensive, and easily cached.

    This is a one-element cache so that our twice-in-a-row tokenizing doesn't
    actually tokenize twice.

    """
    def __init__(self):
        self.last_text = None
        self.last_tokens = None

    @contract(text='unicode')
    def generate_tokens(self, text):
        """A stand-in for `tokenize.generate_tokens`."""
        if text != self.last_text:
            self.last_text = text
            readline = iternext(text.splitlines(True))
            self.last_tokens = list(tokenize.generate_tokens(readline))
        return self.last_tokens

# Create our generate_tokens cache as a callable replacement function.
generate_tokens = CachedTokenizer().generate_tokens


COOKIE_RE = re.compile(r"^[ \t]*#.*coding[:=][ \t]*([-\w.]+)", flags=re.MULTILINE)

@contract(source='bytes')
def _source_encoding_py2(source):
    """Determine the encoding for `source`, according to PEP 263.

    `source` is a byte string, the text of the program.

    Returns a string, the name of the encoding.

    """
    assert isinstance(source, bytes)

    # Do this so the detect_encode code we copied will work.
    readline = iternext(source.splitlines(True))

    # This is mostly code adapted from Py3.2's tokenize module.

    def _get_normal_name(orig_enc):
        """Imitates get_normal_name in tokenizer.c."""
        # Only care about the first 12 characters.
        enc = orig_enc[:12].lower().replace("_", "-")
        if re.match(r"^utf-8($|-)", enc):
            return "utf-8"
        if re.match(r"^(latin-1|iso-8859-1|iso-latin-1)($|-)", enc):
            return "iso-8859-1"
        return orig_enc

    # From detect_encode():
    # It detects the encoding from the presence of a UTF-8 BOM or an encoding
    # cookie as specified in PEP-0263.  If both a BOM and a cookie are present,
    # but disagree, a SyntaxError will be raised.  If the encoding cookie is an
    # invalid charset, raise a SyntaxError.  Note that if a UTF-8 BOM is found,
    # 'utf-8-sig' is returned.

    # If no encoding is specified, then the default will be returned.
    default = 'ascii'

    bom_found = False
    encoding = None

    def read_or_stop():
        """Get the next source line, or ''."""
        try:
            return readline()
        except StopIteration:
            return ''

    def find_cookie(line):
        """Find an encoding cookie in `line`."""
        try:
            line_string = line.decode('ascii')
        except UnicodeDecodeError:
            return None

        matches = COOKIE_RE.findall(line_string)
        if not matches:
            return None
        encoding = _get_normal_name(matches[0])
        try:
            codec = codecs.lookup(encoding)
        except LookupError:
            # This behavior mimics the Python interpreter
            raise SyntaxError("unknown encoding: " + encoding)

        if bom_found:
            # codecs in 2.3 were raw tuples of functions, assume the best.
            codec_name = getattr(codec, 'name', encoding)
            if codec_name != 'utf-8':
                # This behavior mimics the Python interpreter
                raise SyntaxError('encoding problem: utf-8')
            encoding += '-sig'
        return encoding

    first = read_or_stop()
    if first.startswith(codecs.BOM_UTF8):
        bom_found = True
        first = first[3:]
        default = 'utf-8-sig'
    if not first:
        return default

    encoding = find_cookie(first)
    if encoding:
        return encoding

    second = read_or_stop()
    if not second:
        return default

    encoding = find_cookie(second)
    if encoding:
        return encoding

    return default


@contract(source='bytes')
def _source_encoding_py3(source):
    """Determine the encoding for `source`, according to PEP 263.

    `source` is a byte string: the text of the program.

    Returns a string, the name of the encoding.

    """
    readline = iternext(source.splitlines(True))
    return tokenize.detect_encoding(readline)[0]


if env.PY3:
    source_encoding = _source_encoding_py3
else:
    source_encoding = _source_encoding_py2


@contract(source='unicode')
def compile_unicode(source, filename, mode):
    """Just like the `compile` builtin, but works on any Unicode string.

    Python 2's compile() builtin has a stupid restriction: if the source string
    is Unicode, then it may not have a encoding declaration in it.  Why not?
    Who knows!  It also decodes to utf8, and then tries to interpret those utf8
    bytes according to the encoding declaration.  Why? Who knows!

    This function neuters the coding declaration, and compiles it.

    """
    source = neuter_encoding_declaration(source)
    if env.PY2 and isinstance(filename, unicode_class):
        filename = filename.encode(sys.getfilesystemencoding(), "replace")
    code = compile(source, filename, mode)
    return code


@contract(source='unicode', returns='unicode')
def neuter_encoding_declaration(source):
    """Return `source`, with any encoding declaration neutered."""
    if COOKIE_RE.search(source):
        source_lines = source.splitlines(True)
        for lineno in range(min(2, len(source_lines))):
            source_lines[lineno] = COOKIE_RE.sub("# (deleted declaration)", source_lines[lineno])
        source = "".join(source_lines)
    return source

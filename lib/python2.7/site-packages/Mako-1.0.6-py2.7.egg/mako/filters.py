# mako/filters.py
# Copyright (C) 2006-2016 the Mako authors and contributors <see AUTHORS file>
#
# This module is part of Mako and is released under
# the MIT License: http://www.opensource.org/licenses/mit-license.php


import re
import codecs

from mako.compat import quote_plus, unquote_plus, codepoint2name, \
    name2codepoint

from mako import compat

xml_escapes = {
    '&': '&amp;',
    '>': '&gt;',
    '<': '&lt;',
    '"': '&#34;',   # also &quot; in html-only
    "'": '&#39;'    # also &apos; in html-only
}

# XXX: &quot; is valid in HTML and XML
#      &apos; is not valid HTML, but is valid XML


def legacy_html_escape(s):
    """legacy HTML escape for non-unicode mode."""
    s = s.replace("&", "&amp;")
    s = s.replace(">", "&gt;")
    s = s.replace("<", "&lt;")
    s = s.replace('"', "&#34;")
    s = s.replace("'", "&#39;")
    return s


try:
    import markupsafe
    html_escape = markupsafe.escape
except ImportError:
    html_escape = legacy_html_escape


def xml_escape(string):
    return re.sub(r'([&<"\'>])', lambda m: xml_escapes[m.group()], string)


def url_escape(string):
    # convert into a list of octets
    string = string.encode("utf8")
    return quote_plus(string)


def legacy_url_escape(string):
    # convert into a list of octets
    return quote_plus(string)


def url_unescape(string):
    text = unquote_plus(string)
    if not is_ascii_str(text):
        text = text.decode("utf8")
    return text


def trim(string):
    return string.strip()


class Decode(object):

    def __getattr__(self, key):
        def decode(x):
            if isinstance(x, compat.text_type):
                return x
            elif not isinstance(x, compat.binary_type):
                return decode(str(x))
            else:
                return compat.text_type(x, encoding=key)
        return decode
decode = Decode()


_ASCII_re = re.compile(r'\A[\x00-\x7f]*\Z')


def is_ascii_str(text):
    return isinstance(text, str) and _ASCII_re.match(text)

################################################################


class XMLEntityEscaper(object):

    def __init__(self, codepoint2name, name2codepoint):
        self.codepoint2entity = dict([(c, compat.text_type('&%s;' % n))
                                      for c, n in codepoint2name.items()])
        self.name2codepoint = name2codepoint

    def escape_entities(self, text):
        """Replace characters with their character entity references.

        Only characters corresponding to a named entity are replaced.
        """
        return compat.text_type(text).translate(self.codepoint2entity)

    def __escape(self, m):
        codepoint = ord(m.group())
        try:
            return self.codepoint2entity[codepoint]
        except (KeyError, IndexError):
            return '&#x%X;' % codepoint

    __escapable = re.compile(r'["&<>]|[^\x00-\x7f]')

    def escape(self, text):
        """Replace characters with their character references.

        Replace characters by their named entity references.
        Non-ASCII characters, if they do not have a named entity reference,
        are replaced by numerical character references.

        The return value is guaranteed to be ASCII.
        """
        return self.__escapable.sub(self.__escape, compat.text_type(text)
                                    ).encode('ascii')

    # XXX: This regexp will not match all valid XML entity names__.
    # (It punts on details involving involving CombiningChars and Extenders.)
    #
    # .. __: http://www.w3.org/TR/2000/REC-xml-20001006#NT-EntityRef
    __characterrefs = re.compile(r'''& (?:
                                          \#(\d+)
                                          | \#x([\da-f]+)
                                          | ( (?!\d) [:\w] [-.:\w]+ )
                                          ) ;''',
                                 re.X | re.UNICODE)

    def __unescape(self, m):
        dval, hval, name = m.groups()
        if dval:
            codepoint = int(dval)
        elif hval:
            codepoint = int(hval, 16)
        else:
            codepoint = self.name2codepoint.get(name, 0xfffd)
            # U+FFFD = "REPLACEMENT CHARACTER"
        if codepoint < 128:
            return chr(codepoint)
        return chr(codepoint)

    def unescape(self, text):
        """Unescape character references.

        All character references (both entity references and numerical
        character references) are unescaped.
        """
        return self.__characterrefs.sub(self.__unescape, text)


_html_entities_escaper = XMLEntityEscaper(codepoint2name, name2codepoint)

html_entities_escape = _html_entities_escaper.escape_entities
html_entities_unescape = _html_entities_escaper.unescape


def htmlentityreplace_errors(ex):
    """An encoding error handler.

    This python `codecs`_ error handler replaces unencodable
    characters with HTML entities, or, if no HTML entity exists for
    the character, XML character references.

    >>> u'The cost was \u20ac12.'.encode('latin1', 'htmlentityreplace')
    'The cost was &euro;12.'
    """
    if isinstance(ex, UnicodeEncodeError):
        # Handle encoding errors
        bad_text = ex.object[ex.start:ex.end]
        text = _html_entities_escaper.escape(bad_text)
        return (compat.text_type(text), ex.end)
    raise ex

codecs.register_error('htmlentityreplace', htmlentityreplace_errors)


# TODO: options to make this dynamic per-compilation will be added in a later
# release
DEFAULT_ESCAPES = {
    'x': 'filters.xml_escape',
    'h': 'filters.html_escape',
    'u': 'filters.url_escape',
    'trim': 'filters.trim',
    'entity': 'filters.html_entities_escape',
    'unicode': 'unicode',
    'decode': 'decode',
    'str': 'str',
    'n': 'n'
}

if compat.py3k:
    DEFAULT_ESCAPES.update({
        'unicode': 'str'
    })

NON_UNICODE_ESCAPES = DEFAULT_ESCAPES.copy()
NON_UNICODE_ESCAPES['h'] = 'filters.legacy_html_escape'
NON_UNICODE_ESCAPES['u'] = 'filters.legacy_url_escape'

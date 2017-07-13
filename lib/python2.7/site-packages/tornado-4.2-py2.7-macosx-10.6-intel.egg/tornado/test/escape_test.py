#!/usr/bin/env python


from __future__ import absolute_import, division, print_function, with_statement
import tornado.escape

from tornado.escape import utf8, xhtml_escape, xhtml_unescape, url_escape, url_unescape, to_unicode, json_decode, json_encode, squeeze, recursive_unicode
from tornado.util import u, unicode_type
from tornado.test.util import unittest

linkify_tests = [
    # (input, linkify_kwargs, expected_output)

    ("hello http://world.com/!", {},
     u('hello <a href="http://world.com/">http://world.com/</a>!')),

    ("hello http://world.com/with?param=true&stuff=yes", {},
     u('hello <a href="http://world.com/with?param=true&amp;stuff=yes">http://world.com/with?param=true&amp;stuff=yes</a>')),

    # an opened paren followed by many chars killed Gruber's regex
    ("http://url.com/w(aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", {},
     u('<a href="http://url.com/w">http://url.com/w</a>(aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')),

    # as did too many dots at the end
    ("http://url.com/withmany.......................................", {},
     u('<a href="http://url.com/withmany">http://url.com/withmany</a>.......................................')),

    ("http://url.com/withmany((((((((((((((((((((((((((((((((((a)", {},
     u('<a href="http://url.com/withmany">http://url.com/withmany</a>((((((((((((((((((((((((((((((((((a)')),

    # some examples from http://daringfireball.net/2009/11/liberal_regex_for_matching_urls
    # plus a fex extras (such as multiple parentheses).
    ("http://foo.com/blah_blah", {},
     u('<a href="http://foo.com/blah_blah">http://foo.com/blah_blah</a>')),

    ("http://foo.com/blah_blah/", {},
     u('<a href="http://foo.com/blah_blah/">http://foo.com/blah_blah/</a>')),

    ("(Something like http://foo.com/blah_blah)", {},
     u('(Something like <a href="http://foo.com/blah_blah">http://foo.com/blah_blah</a>)')),

    ("http://foo.com/blah_blah_(wikipedia)", {},
     u('<a href="http://foo.com/blah_blah_(wikipedia)">http://foo.com/blah_blah_(wikipedia)</a>')),

    ("http://foo.com/blah_(blah)_(wikipedia)_blah", {},
     u('<a href="http://foo.com/blah_(blah)_(wikipedia)_blah">http://foo.com/blah_(blah)_(wikipedia)_blah</a>')),

    ("(Something like http://foo.com/blah_blah_(wikipedia))", {},
     u('(Something like <a href="http://foo.com/blah_blah_(wikipedia)">http://foo.com/blah_blah_(wikipedia)</a>)')),

    ("http://foo.com/blah_blah.", {},
     u('<a href="http://foo.com/blah_blah">http://foo.com/blah_blah</a>.')),

    ("http://foo.com/blah_blah/.", {},
     u('<a href="http://foo.com/blah_blah/">http://foo.com/blah_blah/</a>.')),

    ("<http://foo.com/blah_blah>", {},
     u('&lt;<a href="http://foo.com/blah_blah">http://foo.com/blah_blah</a>&gt;')),

    ("<http://foo.com/blah_blah/>", {},
     u('&lt;<a href="http://foo.com/blah_blah/">http://foo.com/blah_blah/</a>&gt;')),

    ("http://foo.com/blah_blah,", {},
     u('<a href="http://foo.com/blah_blah">http://foo.com/blah_blah</a>,')),

    ("http://www.example.com/wpstyle/?p=364.", {},
     u('<a href="http://www.example.com/wpstyle/?p=364">http://www.example.com/wpstyle/?p=364</a>.')),

    ("rdar://1234",
     {"permitted_protocols": ["http", "rdar"]},
     u('<a href="rdar://1234">rdar://1234</a>')),

    ("rdar:/1234",
     {"permitted_protocols": ["rdar"]},
     u('<a href="rdar:/1234">rdar:/1234</a>')),

    ("http://userid:password@example.com:8080", {},
     u('<a href="http://userid:password@example.com:8080">http://userid:password@example.com:8080</a>')),

    ("http://userid@example.com", {},
     u('<a href="http://userid@example.com">http://userid@example.com</a>')),

    ("http://userid@example.com:8080", {},
     u('<a href="http://userid@example.com:8080">http://userid@example.com:8080</a>')),

    ("http://userid:password@example.com", {},
     u('<a href="http://userid:password@example.com">http://userid:password@example.com</a>')),

    ("message://%3c330e7f8409726r6a4ba78dkf1fd71420c1bf6ff@mail.gmail.com%3e",
     {"permitted_protocols": ["http", "message"]},
     u('<a href="message://%3c330e7f8409726r6a4ba78dkf1fd71420c1bf6ff@mail.gmail.com%3e">message://%3c330e7f8409726r6a4ba78dkf1fd71420c1bf6ff@mail.gmail.com%3e</a>')),

    (u("http://\u27a1.ws/\u4a39"), {},
     u('<a href="http://\u27a1.ws/\u4a39">http://\u27a1.ws/\u4a39</a>')),

    ("<tag>http://example.com</tag>", {},
     u('&lt;tag&gt;<a href="http://example.com">http://example.com</a>&lt;/tag&gt;')),

    ("Just a www.example.com link.", {},
     u('Just a <a href="http://www.example.com">www.example.com</a> link.')),

    ("Just a www.example.com link.",
     {"require_protocol": True},
     u('Just a www.example.com link.')),

    ("A http://reallylong.com/link/that/exceedsthelenglimit.html",
     {"require_protocol": True, "shorten": True},
     u('A <a href="http://reallylong.com/link/that/exceedsthelenglimit.html" title="http://reallylong.com/link/that/exceedsthelenglimit.html">http://reallylong.com/link...</a>')),

    ("A http://reallylongdomainnamethatwillbetoolong.com/hi!",
     {"shorten": True},
     u('A <a href="http://reallylongdomainnamethatwillbetoolong.com/hi" title="http://reallylongdomainnamethatwillbetoolong.com/hi">http://reallylongdomainnametha...</a>!')),

    ("A file:///passwords.txt and http://web.com link", {},
     u('A file:///passwords.txt and <a href="http://web.com">http://web.com</a> link')),

    ("A file:///passwords.txt and http://web.com link",
     {"permitted_protocols": ["file"]},
     u('A <a href="file:///passwords.txt">file:///passwords.txt</a> and http://web.com link')),

    ("www.external-link.com",
     {"extra_params": 'rel="nofollow" class="external"'},
     u('<a href="http://www.external-link.com" rel="nofollow" class="external">www.external-link.com</a>')),

    ("www.external-link.com and www.internal-link.com/blogs extra",
     {"extra_params": lambda href: 'class="internal"' if href.startswith("http://www.internal-link.com") else 'rel="nofollow" class="external"'},
     u('<a href="http://www.external-link.com" rel="nofollow" class="external">www.external-link.com</a> and <a href="http://www.internal-link.com/blogs" class="internal">www.internal-link.com/blogs</a> extra')),

    ("www.external-link.com",
     {"extra_params": lambda href: '    rel="nofollow" class="external"  '},
     u('<a href="http://www.external-link.com" rel="nofollow" class="external">www.external-link.com</a>')),
]


class EscapeTestCase(unittest.TestCase):
    def test_linkify(self):
        for text, kwargs, html in linkify_tests:
            linked = tornado.escape.linkify(text, **kwargs)
            self.assertEqual(linked, html)

    def test_xhtml_escape(self):
        tests = [
            ("<foo>", "&lt;foo&gt;"),
            (u("<foo>"), u("&lt;foo&gt;")),
            (b"<foo>", b"&lt;foo&gt;"),

            ("<>&\"'", "&lt;&gt;&amp;&quot;&#39;"),
            ("&amp;", "&amp;amp;"),

            (u("<\u00e9>"), u("&lt;\u00e9&gt;")),
            (b"<\xc3\xa9>", b"&lt;\xc3\xa9&gt;"),
        ]
        for unescaped, escaped in tests:
            self.assertEqual(utf8(xhtml_escape(unescaped)), utf8(escaped))
            self.assertEqual(utf8(unescaped), utf8(xhtml_unescape(escaped)))

    def test_xhtml_unescape_numeric(self):
        tests = [
            ('foo&#32;bar', 'foo bar'),
            ('foo&#x20;bar', 'foo bar'),
            ('foo&#X20;bar', 'foo bar'),
            ('foo&#xabc;bar', u('foo\u0abcbar')),
            ('foo&#xyz;bar', 'foo&#xyz;bar'),  # invalid encoding
            ('foo&#;bar', 'foo&#;bar'),        # invalid encoding
            ('foo&#x;bar', 'foo&#x;bar'),      # invalid encoding
        ]
        for escaped, unescaped in tests:
            self.assertEqual(unescaped, xhtml_unescape(escaped))

    def test_url_escape_unicode(self):
        tests = [
            # byte strings are passed through as-is
            (u('\u00e9').encode('utf8'), '%C3%A9'),
            (u('\u00e9').encode('latin1'), '%E9'),

            # unicode strings become utf8
            (u('\u00e9'), '%C3%A9'),
        ]
        for unescaped, escaped in tests:
            self.assertEqual(url_escape(unescaped), escaped)

    def test_url_unescape_unicode(self):
        tests = [
            ('%C3%A9', u('\u00e9'), 'utf8'),
            ('%C3%A9', u('\u00c3\u00a9'), 'latin1'),
            ('%C3%A9', utf8(u('\u00e9')), None),
        ]
        for escaped, unescaped, encoding in tests:
            # input strings to url_unescape should only contain ascii
            # characters, but make sure the function accepts both byte
            # and unicode strings.
            self.assertEqual(url_unescape(to_unicode(escaped), encoding), unescaped)
            self.assertEqual(url_unescape(utf8(escaped), encoding), unescaped)

    def test_url_escape_quote_plus(self):
        unescaped = '+ #%'
        plus_escaped = '%2B+%23%25'
        escaped = '%2B%20%23%25'
        self.assertEqual(url_escape(unescaped), plus_escaped)
        self.assertEqual(url_escape(unescaped, plus=False), escaped)
        self.assertEqual(url_unescape(plus_escaped), unescaped)
        self.assertEqual(url_unescape(escaped, plus=False), unescaped)
        self.assertEqual(url_unescape(plus_escaped, encoding=None),
                         utf8(unescaped))
        self.assertEqual(url_unescape(escaped, encoding=None, plus=False),
                         utf8(unescaped))

    def test_escape_return_types(self):
        # On python2 the escape methods should generally return the same
        # type as their argument
        self.assertEqual(type(xhtml_escape("foo")), str)
        self.assertEqual(type(xhtml_escape(u("foo"))), unicode_type)

    def test_json_decode(self):
        # json_decode accepts both bytes and unicode, but strings it returns
        # are always unicode.
        self.assertEqual(json_decode(b'"foo"'), u("foo"))
        self.assertEqual(json_decode(u('"foo"')), u("foo"))

        # Non-ascii bytes are interpreted as utf8
        self.assertEqual(json_decode(utf8(u('"\u00e9"'))), u("\u00e9"))

    def test_json_encode(self):
        # json deals with strings, not bytes.  On python 2 byte strings will
        # convert automatically if they are utf8; on python 3 byte strings
        # are not allowed.
        self.assertEqual(json_decode(json_encode(u("\u00e9"))), u("\u00e9"))
        if bytes is str:
            self.assertEqual(json_decode(json_encode(utf8(u("\u00e9")))), u("\u00e9"))
            self.assertRaises(UnicodeDecodeError, json_encode, b"\xe9")

    def test_squeeze(self):
        self.assertEqual(squeeze(u('sequences     of    whitespace   chars')), u('sequences of whitespace chars'))

    def test_recursive_unicode(self):
        tests = {
            'dict': {b"foo": b"bar"},
            'list': [b"foo", b"bar"],
            'tuple': (b"foo", b"bar"),
            'bytes': b"foo"
        }
        self.assertEqual(recursive_unicode(tests['dict']), {u("foo"): u("bar")})
        self.assertEqual(recursive_unicode(tests['list']), [u("foo"), u("bar")])
        self.assertEqual(recursive_unicode(tests['tuple']), (u("foo"), u("bar")))
        self.assertEqual(recursive_unicode(tests['bytes']), u("foo"))

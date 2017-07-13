#!/usr/bin/env python


from __future__ import absolute_import, division, print_function, with_statement
from tornado.httputil import url_concat, parse_multipart_form_data, HTTPHeaders, format_timestamp, HTTPServerRequest, parse_request_start_line
from tornado.escape import utf8, native_str
from tornado.log import gen_log
from tornado.testing import ExpectLog
from tornado.test.util import unittest
from tornado.util import u

import copy
import datetime
import logging
import time


class TestUrlConcat(unittest.TestCase):

    def test_url_concat_no_query_params(self):
        url = url_concat(
            "https://localhost/path",
            [('y', 'y'), ('z', 'z')],
        )
        self.assertEqual(url, "https://localhost/path?y=y&z=z")

    def test_url_concat_encode_args(self):
        url = url_concat(
            "https://localhost/path",
            [('y', '/y'), ('z', 'z')],
        )
        self.assertEqual(url, "https://localhost/path?y=%2Fy&z=z")

    def test_url_concat_trailing_q(self):
        url = url_concat(
            "https://localhost/path?",
            [('y', 'y'), ('z', 'z')],
        )
        self.assertEqual(url, "https://localhost/path?y=y&z=z")

    def test_url_concat_q_with_no_trailing_amp(self):
        url = url_concat(
            "https://localhost/path?x",
            [('y', 'y'), ('z', 'z')],
        )
        self.assertEqual(url, "https://localhost/path?x&y=y&z=z")

    def test_url_concat_trailing_amp(self):
        url = url_concat(
            "https://localhost/path?x&",
            [('y', 'y'), ('z', 'z')],
        )
        self.assertEqual(url, "https://localhost/path?x&y=y&z=z")

    def test_url_concat_mult_params(self):
        url = url_concat(
            "https://localhost/path?a=1&b=2",
            [('y', 'y'), ('z', 'z')],
        )
        self.assertEqual(url, "https://localhost/path?a=1&b=2&y=y&z=z")

    def test_url_concat_no_params(self):
        url = url_concat(
            "https://localhost/path?r=1&t=2",
            [],
        )
        self.assertEqual(url, "https://localhost/path?r=1&t=2")


class MultipartFormDataTest(unittest.TestCase):
    def test_file_upload(self):
        data = b"""\
--1234
Content-Disposition: form-data; name="files"; filename="ab.txt"

Foo
--1234--""".replace(b"\n", b"\r\n")
        args = {}
        files = {}
        parse_multipart_form_data(b"1234", data, args, files)
        file = files["files"][0]
        self.assertEqual(file["filename"], "ab.txt")
        self.assertEqual(file["body"], b"Foo")

    def test_unquoted_names(self):
        # quotes are optional unless special characters are present
        data = b"""\
--1234
Content-Disposition: form-data; name=files; filename=ab.txt

Foo
--1234--""".replace(b"\n", b"\r\n")
        args = {}
        files = {}
        parse_multipart_form_data(b"1234", data, args, files)
        file = files["files"][0]
        self.assertEqual(file["filename"], "ab.txt")
        self.assertEqual(file["body"], b"Foo")

    def test_special_filenames(self):
        filenames = ['a;b.txt',
                     'a"b.txt',
                     'a";b.txt',
                     'a;"b.txt',
                     'a";";.txt',
                     'a\\"b.txt',
                     'a\\b.txt',
                     ]
        for filename in filenames:
            logging.debug("trying filename %r", filename)
            data = """\
--1234
Content-Disposition: form-data; name="files"; filename="%s"

Foo
--1234--""" % filename.replace('\\', '\\\\').replace('"', '\\"')
            data = utf8(data.replace("\n", "\r\n"))
            args = {}
            files = {}
            parse_multipart_form_data(b"1234", data, args, files)
            file = files["files"][0]
            self.assertEqual(file["filename"], filename)
            self.assertEqual(file["body"], b"Foo")

    def test_boundary_starts_and_ends_with_quotes(self):
        data = b'''\
--1234
Content-Disposition: form-data; name="files"; filename="ab.txt"

Foo
--1234--'''.replace(b"\n", b"\r\n")
        args = {}
        files = {}
        parse_multipart_form_data(b'"1234"', data, args, files)
        file = files["files"][0]
        self.assertEqual(file["filename"], "ab.txt")
        self.assertEqual(file["body"], b"Foo")

    def test_missing_headers(self):
        data = b'''\
--1234

Foo
--1234--'''.replace(b"\n", b"\r\n")
        args = {}
        files = {}
        with ExpectLog(gen_log, "multipart/form-data missing headers"):
            parse_multipart_form_data(b"1234", data, args, files)
        self.assertEqual(files, {})

    def test_invalid_content_disposition(self):
        data = b'''\
--1234
Content-Disposition: invalid; name="files"; filename="ab.txt"

Foo
--1234--'''.replace(b"\n", b"\r\n")
        args = {}
        files = {}
        with ExpectLog(gen_log, "Invalid multipart/form-data"):
            parse_multipart_form_data(b"1234", data, args, files)
        self.assertEqual(files, {})

    def test_line_does_not_end_with_correct_line_break(self):
        data = b'''\
--1234
Content-Disposition: form-data; name="files"; filename="ab.txt"

Foo--1234--'''.replace(b"\n", b"\r\n")
        args = {}
        files = {}
        with ExpectLog(gen_log, "Invalid multipart/form-data"):
            parse_multipart_form_data(b"1234", data, args, files)
        self.assertEqual(files, {})

    def test_content_disposition_header_without_name_parameter(self):
        data = b"""\
--1234
Content-Disposition: form-data; filename="ab.txt"

Foo
--1234--""".replace(b"\n", b"\r\n")
        args = {}
        files = {}
        with ExpectLog(gen_log, "multipart/form-data value missing name"):
            parse_multipart_form_data(b"1234", data, args, files)
        self.assertEqual(files, {})

    def test_data_after_final_boundary(self):
        # The spec requires that data after the final boundary be ignored.
        # http://www.w3.org/Protocols/rfc1341/7_2_Multipart.html
        # In practice, some libraries include an extra CRLF after the boundary.
        data = b"""\
--1234
Content-Disposition: form-data; name="files"; filename="ab.txt"

Foo
--1234--
""".replace(b"\n", b"\r\n")
        args = {}
        files = {}
        parse_multipart_form_data(b"1234", data, args, files)
        file = files["files"][0]
        self.assertEqual(file["filename"], "ab.txt")
        self.assertEqual(file["body"], b"Foo")


class HTTPHeadersTest(unittest.TestCase):
    def test_multi_line(self):
        # Lines beginning with whitespace are appended to the previous line
        # with any leading whitespace replaced by a single space.
        # Note that while multi-line headers are a part of the HTTP spec,
        # their use is strongly discouraged.
        data = """\
Foo: bar
 baz
Asdf: qwer
\tzxcv
Foo: even
     more
     lines
""".replace("\n", "\r\n")
        headers = HTTPHeaders.parse(data)
        self.assertEqual(headers["asdf"], "qwer zxcv")
        self.assertEqual(headers.get_list("asdf"), ["qwer zxcv"])
        self.assertEqual(headers["Foo"], "bar baz,even more lines")
        self.assertEqual(headers.get_list("foo"), ["bar baz", "even more lines"])
        self.assertEqual(sorted(list(headers.get_all())),
                         [("Asdf", "qwer zxcv"),
                          ("Foo", "bar baz"),
                          ("Foo", "even more lines")])

    def test_unicode_newlines(self):
        # Ensure that only \r\n is recognized as a header separator, and not
        # the other newline-like unicode characters.
        # Characters that are likely to be problematic can be found in
        # http://unicode.org/standard/reports/tr13/tr13-5.html
        # and cpython's unicodeobject.c (which defines the implementation
        # of unicode_type.splitlines(), and uses a different list than TR13).
        newlines = [
            u('\u001b'),  # VERTICAL TAB
            u('\u001c'),  # FILE SEPARATOR
            u('\u001d'),  # GROUP SEPARATOR
            u('\u001e'),  # RECORD SEPARATOR
            u('\u0085'),  # NEXT LINE
            u('\u2028'),  # LINE SEPARATOR
            u('\u2029'),  # PARAGRAPH SEPARATOR
        ]
        for newline in newlines:
            # Try the utf8 and latin1 representations of each newline
            for encoding in ['utf8', 'latin1']:
                try:
                    try:
                        encoded = newline.encode(encoding)
                    except UnicodeEncodeError:
                        # Some chars cannot be represented in latin1
                        continue
                    data = b'Cookie: foo=' + encoded + b'bar'
                    # parse() wants a native_str, so decode through latin1
                    # in the same way the real parser does.
                    headers = HTTPHeaders.parse(
                        native_str(data.decode('latin1')))
                    expected = [('Cookie', 'foo=' +
                                 native_str(encoded.decode('latin1')) + 'bar')]
                    self.assertEqual(
                        expected, list(headers.get_all()))
                except Exception:
                    gen_log.warning("failed while trying %r in %s",
                                    newline, encoding)
                    raise

    def test_optional_cr(self):
        # Both CRLF and LF should be accepted as separators. CR should not be
        # part of the data when followed by LF, but it is a normal char
        # otherwise (or should bare CR be an error?)
        headers = HTTPHeaders.parse(
            'CRLF: crlf\r\nLF: lf\nCR: cr\rMore: more\r\n')
        self.assertEqual(sorted(headers.get_all()),
                         [('Cr', 'cr\rMore: more'),
                          ('Crlf', 'crlf'),
                          ('Lf', 'lf'),
                          ])

    def test_copy(self):
        all_pairs = [('A', '1'), ('A', '2'), ('B', 'c')]
        h1 = HTTPHeaders()
        for k, v in all_pairs:
            h1.add(k, v)
        h2 = h1.copy()
        h3 = copy.copy(h1)
        h4 = copy.deepcopy(h1)
        for headers in [h1, h2, h3, h4]:
            # All the copies are identical, no matter how they were
            # constructed.
            self.assertEqual(list(sorted(headers.get_all())), all_pairs)
        for headers in [h2, h3, h4]:
            # Neither the dict or its member lists are reused.
            self.assertIsNot(headers, h1)
            self.assertIsNot(headers.get_list('A'), h1.get_list('A'))



class FormatTimestampTest(unittest.TestCase):
    # Make sure that all the input types are supported.
    TIMESTAMP = 1359312200.503611
    EXPECTED = 'Sun, 27 Jan 2013 18:43:20 GMT'

    def check(self, value):
        self.assertEqual(format_timestamp(value), self.EXPECTED)

    def test_unix_time_float(self):
        self.check(self.TIMESTAMP)

    def test_unix_time_int(self):
        self.check(int(self.TIMESTAMP))

    def test_struct_time(self):
        self.check(time.gmtime(self.TIMESTAMP))

    def test_time_tuple(self):
        tup = tuple(time.gmtime(self.TIMESTAMP))
        self.assertEqual(9, len(tup))
        self.check(tup)

    def test_datetime(self):
        self.check(datetime.datetime.utcfromtimestamp(self.TIMESTAMP))


# HTTPServerRequest is mainly tested incidentally to the server itself,
# but this tests the parts of the class that can be tested in isolation.
class HTTPServerRequestTest(unittest.TestCase):
    def test_default_constructor(self):
        # All parameters are formally optional, but uri is required
        # (and has been for some time).  This test ensures that no
        # more required parameters slip in.
        HTTPServerRequest(uri='/')

    def test_body_is_a_byte_string(self):
        requets = HTTPServerRequest(uri='/')
        self.assertIsInstance(requets.body, bytes)


class ParseRequestStartLineTest(unittest.TestCase):
    METHOD = "GET"
    PATH = "/foo"
    VERSION = "HTTP/1.1"

    def test_parse_request_start_line(self):
        start_line = " ".join([self.METHOD, self.PATH, self.VERSION])
        parsed_start_line = parse_request_start_line(start_line)
        self.assertEqual(parsed_start_line.method, self.METHOD)
        self.assertEqual(parsed_start_line.path, self.PATH)
        self.assertEqual(parsed_start_line.version, self.VERSION)

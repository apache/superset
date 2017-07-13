from __future__ import absolute_import, division, print_function, with_statement

import os
import sys
import traceback

from tornado.escape import utf8, native_str, to_unicode
from tornado.template import Template, DictLoader, ParseError, Loader
from tornado.test.util import unittest
from tornado.util import u, ObjectDict, unicode_type


class TemplateTest(unittest.TestCase):
    def test_simple(self):
        template = Template("Hello {{ name }}!")
        self.assertEqual(template.generate(name="Ben"),
                         b"Hello Ben!")

    def test_bytes(self):
        template = Template("Hello {{ name }}!")
        self.assertEqual(template.generate(name=utf8("Ben")),
                         b"Hello Ben!")

    def test_expressions(self):
        template = Template("2 + 2 = {{ 2 + 2 }}")
        self.assertEqual(template.generate(), b"2 + 2 = 4")

    def test_comment(self):
        template = Template("Hello{# TODO i18n #} {{ name }}!")
        self.assertEqual(template.generate(name=utf8("Ben")),
                         b"Hello Ben!")

    def test_include(self):
        loader = DictLoader({
            "index.html": '{% include "header.html" %}\nbody text',
            "header.html": "header text",
        })
        self.assertEqual(loader.load("index.html").generate(),
                         b"header text\nbody text")

    def test_extends(self):
        loader = DictLoader({
            "base.html": """\
<title>{% block title %}default title{% end %}</title>
<body>{% block body %}default body{% end %}</body>
""",
            "page.html": """\
{% extends "base.html" %}
{% block title %}page title{% end %}
{% block body %}page body{% end %}
""",
        })
        self.assertEqual(loader.load("page.html").generate(),
                         b"<title>page title</title>\n<body>page body</body>\n")

    def test_relative_load(self):
        loader = DictLoader({
            "a/1.html": "{% include '2.html' %}",
            "a/2.html": "{% include '../b/3.html' %}",
            "b/3.html": "ok",
        })
        self.assertEqual(loader.load("a/1.html").generate(),
                         b"ok")

    def test_escaping(self):
        self.assertRaises(ParseError, lambda: Template("{{"))
        self.assertRaises(ParseError, lambda: Template("{%"))
        self.assertEqual(Template("{{!").generate(), b"{{")
        self.assertEqual(Template("{%!").generate(), b"{%")
        self.assertEqual(Template("{{ 'expr' }} {{!jquery expr}}").generate(),
                         b"expr {{jquery expr}}")

    def test_unicode_template(self):
        template = Template(utf8(u("\u00e9")))
        self.assertEqual(template.generate(), utf8(u("\u00e9")))

    def test_unicode_literal_expression(self):
        # Unicode literals should be usable in templates.  Note that this
        # test simulates unicode characters appearing directly in the
        # template file (with utf8 encoding), i.e. \u escapes would not
        # be used in the template file itself.
        if str is unicode_type:
            # python 3 needs a different version of this test since
            # 2to3 doesn't run on template internals
            template = Template(utf8(u('{{ "\u00e9" }}')))
        else:
            template = Template(utf8(u('{{ u"\u00e9" }}')))
        self.assertEqual(template.generate(), utf8(u("\u00e9")))

    def test_custom_namespace(self):
        loader = DictLoader({"test.html": "{{ inc(5) }}"}, namespace={"inc": lambda x: x + 1})
        self.assertEqual(loader.load("test.html").generate(), b"6")

    def test_apply(self):
        def upper(s):
            return s.upper()
        template = Template(utf8("{% apply upper %}foo{% end %}"))
        self.assertEqual(template.generate(upper=upper), b"FOO")

    def test_unicode_apply(self):
        def upper(s):
            return to_unicode(s).upper()
        template = Template(utf8(u("{% apply upper %}foo \u00e9{% end %}")))
        self.assertEqual(template.generate(upper=upper), utf8(u("FOO \u00c9")))

    def test_bytes_apply(self):
        def upper(s):
            return utf8(to_unicode(s).upper())
        template = Template(utf8(u("{% apply upper %}foo \u00e9{% end %}")))
        self.assertEqual(template.generate(upper=upper), utf8(u("FOO \u00c9")))

    def test_if(self):
        template = Template(utf8("{% if x > 4 %}yes{% else %}no{% end %}"))
        self.assertEqual(template.generate(x=5), b"yes")
        self.assertEqual(template.generate(x=3), b"no")

    def test_if_empty_body(self):
        template = Template(utf8("{% if True %}{% else %}{% end %}"))
        self.assertEqual(template.generate(), b"")

    def test_try(self):
        template = Template(utf8("""{% try %}
try{% set y = 1/x %}
{% except %}-except
{% else %}-else
{% finally %}-finally
{% end %}"""))
        self.assertEqual(template.generate(x=1), b"\ntry\n-else\n-finally\n")
        self.assertEqual(template.generate(x=0), b"\ntry-except\n-finally\n")

    def test_comment_directive(self):
        template = Template(utf8("{% comment blah blah %}foo"))
        self.assertEqual(template.generate(), b"foo")

    def test_break_continue(self):
        template = Template(utf8("""\
{% for i in range(10) %}
    {% if i == 2 %}
        {% continue %}
    {% end %}
    {{ i }}
    {% if i == 6 %}
        {% break %}
    {% end %}
{% end %}"""))
        result = template.generate()
        # remove extraneous whitespace
        result = b''.join(result.split())
        self.assertEqual(result, b"013456")

    def test_break_outside_loop(self):
        try:
            Template(utf8("{% break %}"))
            raise Exception("Did not get expected exception")
        except ParseError:
            pass

    def test_break_in_apply(self):
        # This test verifies current behavior, although of course it would
        # be nice if apply didn't cause seemingly unrelated breakage
        try:
            Template(utf8("{% for i in [] %}{% apply foo %}{% break %}{% end %}{% end %}"))
            raise Exception("Did not get expected exception")
        except ParseError:
            pass

    @unittest.skipIf(sys.version_info >= division.getMandatoryRelease(),
                     'no testable future imports')
    def test_no_inherit_future(self):
        # This file has from __future__ import division...
        self.assertEqual(1 / 2, 0.5)
        # ...but the template doesn't
        template = Template('{{ 1 / 2 }}')
        self.assertEqual(template.generate(), '0')


class StackTraceTest(unittest.TestCase):
    def test_error_line_number_expression(self):
        loader = DictLoader({"test.html": """one
two{{1/0}}
three
        """})
        try:
            loader.load("test.html").generate()
            self.fail("did not get expected exception")
        except ZeroDivisionError:
            self.assertTrue("# test.html:2" in traceback.format_exc())

    def test_error_line_number_directive(self):
        loader = DictLoader({"test.html": """one
two{%if 1/0%}
three{%end%}
        """})
        try:
            loader.load("test.html").generate()
            self.fail("did not get expected exception")
        except ZeroDivisionError:
            self.assertTrue("# test.html:2" in traceback.format_exc())

    def test_error_line_number_module(self):
        loader = DictLoader({
            "base.html": "{% module Template('sub.html') %}",
            "sub.html": "{{1/0}}",
        }, namespace={"_tt_modules": ObjectDict({"Template": lambda path, **kwargs: loader.load(path).generate(**kwargs)})})
        try:
            loader.load("base.html").generate()
            self.fail("did not get expected exception")
        except ZeroDivisionError:
            exc_stack = traceback.format_exc()
            self.assertTrue('# base.html:1' in exc_stack)
            self.assertTrue('# sub.html:1' in exc_stack)

    def test_error_line_number_include(self):
        loader = DictLoader({
            "base.html": "{% include 'sub.html' %}",
            "sub.html": "{{1/0}}",
        })
        try:
            loader.load("base.html").generate()
            self.fail("did not get expected exception")
        except ZeroDivisionError:
            self.assertTrue("# sub.html:1 (via base.html:1)" in
                            traceback.format_exc())

    def test_error_line_number_extends_base_error(self):
        loader = DictLoader({
            "base.html": "{{1/0}}",
            "sub.html": "{% extends 'base.html' %}",
        })
        try:
            loader.load("sub.html").generate()
            self.fail("did not get expected exception")
        except ZeroDivisionError:
            exc_stack = traceback.format_exc()
        self.assertTrue("# base.html:1" in exc_stack)

    def test_error_line_number_extends_sub_error(self):
        loader = DictLoader({
            "base.html": "{% block 'block' %}{% end %}",
            "sub.html": """
{% extends 'base.html' %}
{% block 'block' %}
{{1/0}}
{% end %}
            """})
        try:
            loader.load("sub.html").generate()
            self.fail("did not get expected exception")
        except ZeroDivisionError:
            self.assertTrue("# sub.html:4 (via base.html:1)" in
                            traceback.format_exc())

    def test_multi_includes(self):
        loader = DictLoader({
            "a.html": "{% include 'b.html' %}",
            "b.html": "{% include 'c.html' %}",
            "c.html": "{{1/0}}",
        })
        try:
            loader.load("a.html").generate()
            self.fail("did not get expected exception")
        except ZeroDivisionError:
            self.assertTrue("# c.html:1 (via b.html:1, a.html:1)" in
                            traceback.format_exc())


class AutoEscapeTest(unittest.TestCase):
    def setUp(self):
        self.templates = {
            "escaped.html": "{% autoescape xhtml_escape %}{{ name }}",
            "unescaped.html": "{% autoescape None %}{{ name }}",
            "default.html": "{{ name }}",

            "include.html": """\
escaped: {% include 'escaped.html' %}
unescaped: {% include 'unescaped.html' %}
default: {% include 'default.html' %}
""",

            "escaped_block.html": """\
{% autoescape xhtml_escape %}\
{% block name %}base: {{ name }}{% end %}""",
            "unescaped_block.html": """\
{% autoescape None %}\
{% block name %}base: {{ name }}{% end %}""",

            # Extend a base template with different autoescape policy,
            # with and without overriding the base's blocks
            "escaped_extends_unescaped.html": """\
{% autoescape xhtml_escape %}\
{% extends "unescaped_block.html" %}""",
            "escaped_overrides_unescaped.html": """\
{% autoescape xhtml_escape %}\
{% extends "unescaped_block.html" %}\
{% block name %}extended: {{ name }}{% end %}""",
            "unescaped_extends_escaped.html": """\
{% autoescape None %}\
{% extends "escaped_block.html" %}""",
            "unescaped_overrides_escaped.html": """\
{% autoescape None %}\
{% extends "escaped_block.html" %}\
{% block name %}extended: {{ name }}{% end %}""",

            "raw_expression.html": """\
{% autoescape xhtml_escape %}\
expr: {{ name }}
raw: {% raw name %}""",
        }

    def test_default_off(self):
        loader = DictLoader(self.templates, autoescape=None)
        name = "Bobby <table>s"
        self.assertEqual(loader.load("escaped.html").generate(name=name),
                         b"Bobby &lt;table&gt;s")
        self.assertEqual(loader.load("unescaped.html").generate(name=name),
                         b"Bobby <table>s")
        self.assertEqual(loader.load("default.html").generate(name=name),
                         b"Bobby <table>s")

        self.assertEqual(loader.load("include.html").generate(name=name),
                         b"escaped: Bobby &lt;table&gt;s\n"
                         b"unescaped: Bobby <table>s\n"
                         b"default: Bobby <table>s\n")

    def test_default_on(self):
        loader = DictLoader(self.templates, autoescape="xhtml_escape")
        name = "Bobby <table>s"
        self.assertEqual(loader.load("escaped.html").generate(name=name),
                         b"Bobby &lt;table&gt;s")
        self.assertEqual(loader.load("unescaped.html").generate(name=name),
                         b"Bobby <table>s")
        self.assertEqual(loader.load("default.html").generate(name=name),
                         b"Bobby &lt;table&gt;s")

        self.assertEqual(loader.load("include.html").generate(name=name),
                         b"escaped: Bobby &lt;table&gt;s\n"
                         b"unescaped: Bobby <table>s\n"
                         b"default: Bobby &lt;table&gt;s\n")

    def test_unextended_block(self):
        loader = DictLoader(self.templates)
        name = "<script>"
        self.assertEqual(loader.load("escaped_block.html").generate(name=name),
                         b"base: &lt;script&gt;")
        self.assertEqual(loader.load("unescaped_block.html").generate(name=name),
                         b"base: <script>")

    def test_extended_block(self):
        loader = DictLoader(self.templates)

        def render(name):
            return loader.load(name).generate(name="<script>")
        self.assertEqual(render("escaped_extends_unescaped.html"),
                         b"base: <script>")
        self.assertEqual(render("escaped_overrides_unescaped.html"),
                         b"extended: &lt;script&gt;")

        self.assertEqual(render("unescaped_extends_escaped.html"),
                         b"base: &lt;script&gt;")
        self.assertEqual(render("unescaped_overrides_escaped.html"),
                         b"extended: <script>")

    def test_raw_expression(self):
        loader = DictLoader(self.templates)

        def render(name):
            return loader.load(name).generate(name='<>&"')
        self.assertEqual(render("raw_expression.html"),
                         b"expr: &lt;&gt;&amp;&quot;\n"
                         b"raw: <>&\"")

    def test_custom_escape(self):
        loader = DictLoader({"foo.py":
                             "{% autoescape py_escape %}s = {{ name }}\n"})

        def py_escape(s):
            self.assertEqual(type(s), bytes)
            return repr(native_str(s))

        def render(template, name):
            return loader.load(template).generate(py_escape=py_escape,
                                                  name=name)
        self.assertEqual(render("foo.py", "<html>"),
                         b"s = '<html>'\n")
        self.assertEqual(render("foo.py", "';sys.exit()"),
                         b"""s = "';sys.exit()"\n""")
        self.assertEqual(render("foo.py", ["not a string"]),
                         b"""s = "['not a string']"\n""")

    def test_minimize_whitespace(self):
        # Whitespace including newlines is allowed within template tags
        # and directives, and this is one way to avoid long lines while
        # keeping extra whitespace out of the rendered output.
        loader = DictLoader({'foo.txt': """\
{% for i in items
  %}{% if i > 0 %}, {% end %}{#
  #}{{i
  }}{% end
%}""",
                             })
        self.assertEqual(loader.load("foo.txt").generate(items=range(5)),
                         b"0, 1, 2, 3, 4")


class TemplateLoaderTest(unittest.TestCase):
    def setUp(self):
        self.loader = Loader(os.path.join(os.path.dirname(__file__), "templates"))

    def test_utf8_in_file(self):
        tmpl = self.loader.load("utf8.html")
        result = tmpl.generate()
        self.assertEqual(to_unicode(result).strip(), u("H\u00e9llo"))

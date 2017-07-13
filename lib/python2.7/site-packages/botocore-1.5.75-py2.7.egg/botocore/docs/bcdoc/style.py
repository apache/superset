# Copyright 2012-2013 Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"). You
# may not use this file except in compliance with the License. A copy of
# the License is located at
#
#     http://aws.amazon.com/apache2.0/
#
# or in the "license" file accompanying this file. This file is
# distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
# ANY KIND, either express or implied. See the License for the specific
# language governing permissions and limitations under the License.

import logging

logger = logging.getLogger('bcdocs')


class BaseStyle(object):

    def __init__(self, doc, indent_width=2):
        self.doc = doc
        self.indent_width = indent_width
        self._indent = 0
        self.keep_data = True

    @property
    def indentation(self):
        return self._indent

    @indentation.setter
    def indentation(self, value):
        self._indent = value

    def new_paragraph(self):
        return '\n%s' % self.spaces()

    def indent(self):
        self._indent += 1

    def dedent(self):
        if self._indent > 0:
            self._indent -= 1

    def spaces(self):
        return ' ' * (self._indent * self.indent_width)

    def bold(self, s):
        return s

    def ref(self, link, title=None):
        return link

    def h2(self, s):
        return s

    def h3(self, s):
        return s

    def underline(self, s):
        return s

    def italics(self, s):
        return s


class ReSTStyle(BaseStyle):

    def __init__(self, doc, indent_width=2):
        BaseStyle.__init__(self, doc, indent_width)
        self.do_p = True
        self.a_href = None
        self.list_depth = 0

    def new_paragraph(self):
        self.doc.write('\n\n%s' % self.spaces())

    def new_line(self):
        self.doc.write('\n%s' % self.spaces())

    def _start_inline(self, markup):
        self.doc.write(markup)

    def _end_inline(self, markup):
        # Sometimes the HTML markup has whitespace between the end
        # of the text inside the inline markup and the closing element
        # (e.g. <b>foobar </b>).  This trailing space will cause
        # problems in the ReST inline markup so we remove it here
        # by popping the last item written off the stack, striping
        # the whitespace and then pushing it back on the stack.
        last_write = self.doc.pop_write()
        self.doc.push_write(last_write.rstrip(' '))
        self.doc.write(markup + ' ')

    def start_bold(self, attrs=None):
        self._start_inline('**')

    def end_bold(self):
        self._end_inline('**')

    def start_b(self, attrs=None):
        self.doc.do_translation = True
        self.start_bold(attrs)

    def end_b(self):
        self.doc.do_translation = False
        self.end_bold()

    def bold(self, s):
        if s:
            self.start_bold()
            self.doc.write(s)
            self.end_bold()

    def ref(self, title, link=None):
        if link is None:
            link = title
        self.doc.write(':doc:`%s <%s>`' % (title, link))

    def _heading(self, s, border_char):
        border = border_char * len(s)
        self.new_paragraph()
        self.doc.write('%s\n%s\n%s' % (border, s, border))
        self.new_paragraph()

    def h1(self, s):
        self._heading(s, '*')

    def h2(self, s):
        self._heading(s, '=')

    def h3(self, s):
        self._heading(s, '-')

    def start_italics(self, attrs=None):
        self._start_inline('*')

    def end_italics(self):
        self._end_inline('*')

    def italics(self, s):
        if s:
            self.start_italics()
            self.doc.write(s)
            self.end_italics()

    def start_p(self, attrs=None):
        if self.do_p:
            self.doc.write('\n\n%s' % self.spaces())

    def end_p(self):
        if self.do_p:
            self.doc.write('\n\n%s' % self.spaces())

    def start_code(self, attrs=None):
        self.doc.do_translation = True
        self._start_inline('``')

    def end_code(self):
        self.doc.do_translation = False
        self._end_inline('``')

    def code(self, s):
        if s:
            self.start_code()
            self.doc.write(s)
            self.end_code()

    def start_note(self, attrs=None):
        self.new_paragraph()
        self.doc.write('.. note::')
        self.indent()
        self.new_paragraph()

    def end_note(self):
        self.dedent()
        self.new_paragraph()

    def start_important(self, attrs=None):
        self.new_paragraph()
        self.doc.write('.. warning::')
        self.indent()
        self.new_paragraph()

    def end_important(self):
        self.dedent()
        self.new_paragraph()

    def start_a(self, attrs=None):
        if attrs:
            for attr_key, attr_value in attrs:
                if attr_key == 'href':
                    self.a_href = attr_value
                    self.doc.write('`')
        else:
            # There are some model documentation that
            # looks like this: <a>DescribeInstances</a>.
            # In this case we just write out an empty
            # string.
            self.doc.write(' ')
        self.doc.do_translation = True

    def link_target_definition(self, refname, link):
        self.doc.writeln('.. _%s: %s' % (refname, link))

    def sphinx_reference_label(self, label, text=None):
        if text is None:
            text = label
        if self.doc.target == 'html':
            self.doc.write(':ref:`%s <%s>`' % (text, label))
        else:
            self.doc.write(text)

    def end_a(self):
        self.doc.do_translation = False
        if self.a_href:
            last_write = self.doc.pop_write()
            last_write = last_write.rstrip(' ')
            if last_write and last_write != '`':
                if ':' in last_write:
                    last_write = last_write.replace(':', r'\:')
                self.doc.push_write(last_write)
                self.doc.hrefs[last_write] = self.a_href
                self.doc.write('`_')
            elif last_write == '`':
                # Look at start_a().  It will do a self.doc.write('`')
                # which is the start of the link title.  If that is the
                # case then there was no link text.  We should just
                # use an inline link.  The syntax of this is
                # `<http://url>`_
                self.doc.push_write('`<%s>`_' % self.a_href)
            else:
                self.doc.push_write(self.a_href)
                self.doc.hrefs[self.a_href] = self.a_href
                self.doc.write('`_')
            self.a_href = None
        self.doc.write(' ')

    def start_i(self, attrs=None):
        self.doc.do_translation = True
        self.start_italics()

    def end_i(self):
        self.doc.do_translation = False
        self.end_italics()

    def start_li(self, attrs=None):
        self.new_line()
        self.do_p = False
        self.doc.write('* ')

    def end_li(self):
        self.do_p = True
        self.new_line()

    def li(self, s):
        if s:
            self.start_li()
            self.doc.writeln(s)
            self.end_li()

    def start_ul(self, attrs=None):
        if self.list_depth != 0:
            self.indent()
        self.list_depth += 1
        self.new_paragraph()

    def end_ul(self):
        self.list_depth -= 1
        if self.list_depth != 0:
            self.dedent()
        self.new_paragraph()

    def start_ol(self, attrs=None):
        # TODO: Need to control the bullets used for LI items
        if self.list_depth != 0:
            self.indent()
        self.list_depth += 1
        self.new_paragraph()

    def end_ol(self):
        self.list_depth -= 1
        if self.list_depth != 0:
            self.dedent()
        self.new_paragraph()

    def start_examples(self, attrs=None):
        self.doc.keep_data = False

    def end_examples(self):
        self.doc.keep_data = True

    def start_fullname(self, attrs=None):
        self.doc.keep_data = False

    def end_fullname(self):
        self.doc.keep_data = True

    def start_codeblock(self, attrs=None):
        self.doc.write('::')
        self.indent()
        self.new_paragraph()

    def end_codeblock(self):
        self.dedent()
        self.new_paragraph()

    def codeblock(self, code):
        """
        Literal code blocks are introduced by ending a paragraph with
        the special marker ::.  The literal block must be indented
        (and, like all paragraphs, separated from the surrounding
        ones by blank lines).
        """
        self.start_codeblock()
        self.doc.writeln(code)
        self.end_codeblock()

    def toctree(self):
        if self.doc.target == 'html':
            self.doc.write('\n.. toctree::\n')
            self.doc.write('  :maxdepth: 1\n')
            self.doc.write('  :titlesonly:\n\n')
        else:
            self.start_ul()

    def tocitem(self, item, file_name=None):
        if self.doc.target == 'man':
            self.li(item)
        else:
            if file_name:
                self.doc.writeln('  %s' % file_name)
            else:
                self.doc.writeln('  %s' % item)

    def hidden_toctree(self):
        if self.doc.target == 'html':
            self.doc.write('\n.. toctree::\n')
            self.doc.write('  :maxdepth: 1\n')
            self.doc.write('  :hidden:\n\n')

    def hidden_tocitem(self, item):
        if self.doc.target == 'html':
            self.tocitem(item)

    def table_of_contents(self, title=None, depth=None):
        self.doc.write('.. contents:: ')
        if title is not None:
            self.doc.writeln(title)
        if depth is not None:
            self.doc.writeln('   :depth: %s' % depth)

    def start_sphinx_py_class(self, class_name):
        self.new_paragraph()
        self.doc.write('.. py:class:: %s' % class_name)
        self.indent()
        self.new_paragraph()

    def end_sphinx_py_class(self):
        self.dedent()
        self.new_paragraph()

    def start_sphinx_py_method(self, method_name, parameters=None):
        self.new_paragraph()
        content = '.. py:method:: %s' % method_name
        if parameters is not None:
            content += '(%s)' % parameters
        self.doc.write(content)
        self.indent()
        self.new_paragraph()

    def end_sphinx_py_method(self):
        self.dedent()
        self.new_paragraph()

    def start_sphinx_py_attr(self, attr_name):
        self.new_paragraph()
        self.doc.write('.. py:attribute:: %s' % attr_name)
        self.indent()
        self.new_paragraph()

    def end_sphinx_py_attr(self):
        self.dedent()
        self.new_paragraph()

    def write_py_doc_string(self, docstring):
        docstring_lines = docstring.splitlines()
        for docstring_line in docstring_lines:
            self.doc.writeln(docstring_line)

    def external_link(self, title, link):
        if self.doc.target == 'html':
            self.doc.write('`%s <%s>`_' % (title, link))
        else:
            self.doc.write(title)

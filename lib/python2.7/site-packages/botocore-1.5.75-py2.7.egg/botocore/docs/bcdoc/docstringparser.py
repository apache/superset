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
from botocore.compat import six


class DocStringParser(six.moves.html_parser.HTMLParser):
    """
    A simple HTML parser.  Focused on converting the subset of HTML
    that appears in the documentation strings of the JSON models into
    simple ReST format.
    """

    def __init__(self, doc):
        self.tree = None
        self.doc = doc
        six.moves.html_parser.HTMLParser.__init__(self)

    def reset(self):
        six.moves.html_parser.HTMLParser.reset(self)
        self.tree = HTMLTree(self.doc)

    def feed(self, data):
        # HTMLParser is an old style class, so the super() method will not work.
        six.moves.html_parser.HTMLParser.feed(self, data)
        self.tree.write()
        self.tree = HTMLTree(self.doc)

    def close(self):
        six.moves.html_parser.HTMLParser.close(self)
        # Write if there is anything remaining.
        self.tree.write()
        self.tree = HTMLTree(self.doc)

    def handle_starttag(self, tag, attrs):
        self.tree.add_tag(tag, attrs=attrs)

    def handle_endtag(self, tag):
        self.tree.add_tag(tag, is_start=False)

    def handle_data(self, data):
        self.tree.add_data(data)


class HTMLTree(object):
    """
    A tree which handles HTML nodes. Designed to work with a python HTML parser,
    meaning that the current_node will be the most recently opened tag. When
    a tag is closed, the current_node moves up to the parent node.
    """
    def __init__(self, doc):
        self.doc = doc
        self.head = StemNode()
        self.current_node = self.head
        self.unhandled_tags = []

    def add_tag(self, tag, attrs=None, is_start=True):
        if not self._doc_has_handler(tag, is_start):
            self.unhandled_tags.append(tag)
            return

        if is_start:
            if tag == 'li':
                node = LineItemNode(attrs)
            else:
                node = TagNode(tag, attrs)
            self.current_node.add_child(node)
            self.current_node = node
        else:
            self.current_node = self.current_node.parent

    def _doc_has_handler(self, tag, is_start):
        if is_start:
            handler_name = 'start_%s' % tag
        else:
            handler_name = 'end_%s' % tag

        return hasattr(self.doc.style, handler_name)

    def add_data(self, data):
        self.current_node.add_child(DataNode(data))

    def write(self):
        self.head.write(self.doc)


class Node(object):
    def __init__(self, parent=None):
        self.parent = parent

    def write(self, doc):
        raise NotImplementedError


class StemNode(Node):
    def __init__(self, parent=None):
        super(StemNode, self).__init__(parent)
        self.children = []

    def add_child(self, child):
        child.parent = self
        self.children.append(child)

    def write(self, doc):
        self._write_children(doc)

    def _write_children(self, doc):
        for child in self.children:
            child.write(doc)


class TagNode(StemNode):
    """
    A generic Tag node. It will verify that handlers exist before writing.
    """
    def __init__(self, tag, attrs=None, parent=None):
        super(TagNode, self).__init__(parent)
        self.attrs = attrs
        self.tag = tag

    def write(self, doc):
        self._write_start(doc)
        self._write_children(doc)
        self._write_end(doc)

    def _write_start(self, doc):
        handler_name = 'start_%s' % self.tag
        if hasattr(doc.style, handler_name):
            getattr(doc.style, handler_name)(self.attrs)

    def _write_end(self, doc):
        handler_name = 'end_%s' % self.tag
        if hasattr(doc.style, handler_name):
            getattr(doc.style, handler_name)()


class LineItemNode(TagNode):
    def __init__(self, attrs=None, parent=None):
        super(LineItemNode, self).__init__('li', attrs, parent)

    def write(self, doc):
        self._lstrip(self)
        super(LineItemNode, self).write(doc)

    def _lstrip(self, node):
        """
        Traverses the tree, stripping out whitespace until text data is found
        :param node: The node to strip
        :return: True if non-whitespace data was found, False otherwise
        """
        for child in node.children:
            if isinstance(child, DataNode):
                child.lstrip()
                if child.data:
                    return True
            else:
                found = self._lstrip(child)
                if found:
                    return True

        return False


class DataNode(Node):
    """
    A Node that contains only string data.
    """
    def __init__(self, data, parent=None):
        super(DataNode, self).__init__(parent)
        if not isinstance(data, six.string_types):
            raise ValueError("Expecting string type, %s given." % type(data))
        self.data = data

    def lstrip(self):
        self.data = self.data.lstrip()

    def write(self, doc):
        if not self.data:
            return

        if self.data.isspace():
            str_data = ' '
        else:
            end_space = self.data[-1].isspace()
            words = self.data.split()
            words = doc.translate_words(words)
            str_data = ' '.join(words)
            if end_space:
                str_data += ' '

        doc.handle_data(str_data)

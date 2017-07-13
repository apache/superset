# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Micro reports objects.

A micro report is a tree of layout and content objects.
"""

from six import string_types


class VNode(object):

    def __init__(self, nid=None):
        self.id = nid
        # navigation
        self.parent = None
        self.children = []

    def __iter__(self):
        return iter(self.children)

    def append(self, child):
        """add a node to children"""
        self.children.append(child)
        child.parent = self

    def insert(self, index, child):
        """insert a child node"""
        self.children.insert(index, child)
        child.parent = self

    def _get_visit_name(self):
        """
        return the visit name for the mixed class. When calling 'accept', the
        method <'visit_' + name returned by this method> will be called on the
        visitor
        """
        try:
            return self.TYPE.replace('-', '_')
        except Exception:
            return self.__class__.__name__.lower()

    def accept(self, visitor, *args, **kwargs):
        func = getattr(visitor, 'visit_%s' % self._get_visit_name())
        return func(self, *args, **kwargs)

    def leave(self, visitor, *args, **kwargs):
        func = getattr(visitor, 'leave_%s' % self._get_visit_name())
        return func(self, *args, **kwargs)


class BaseLayout(VNode):
    """base container node

    attributes
    * children : components in this table (i.e. the table's cells)
    """
    def __init__(self, children=(), **kwargs):
        super(BaseLayout, self).__init__(**kwargs)
        for child in children:
            if isinstance(child, VNode):
                self.append(child)
            else:
                self.add_text(child)

    def append(self, child):
        """overridden to detect problems easily"""
        assert child not in self.parents()
        VNode.append(self, child)

    def parents(self):
        """return the ancestor nodes"""
        assert self.parent is not self
        if self.parent is None:
            return []
        return [self.parent] + self.parent.parents()

    def add_text(self, text):
        """shortcut to add text data"""
        self.children.append(Text(text))


# non container nodes #########################################################

class Text(VNode):
    """a text portion

    attributes :
    * data : the text value as an encoded or unicode string
    """
    def __init__(self, data, escaped=True, **kwargs):
        super(Text, self).__init__(**kwargs)
        #if isinstance(data, unicode):
        #    data = data.encode('ascii')
        assert isinstance(data, string_types), data.__class__
        self.escaped = escaped
        self.data = data


class VerbatimText(Text):
    """a verbatim text, display the raw data

    attributes :
    * data : the text value as an encoded or unicode string
    """

# container nodes #############################################################

class Section(BaseLayout):
    """a section

    attributes :
    * BaseLayout attributes

    a title may also be given to the constructor, it'll be added
    as a first element
    a description may also be given to the constructor, it'll be added
    as a first paragraph
    """
    def __init__(self, title=None, description=None, **kwargs):
        super(Section, self).__init__(**kwargs)
        if description:
            self.insert(0, Paragraph([Text(description)]))
        if title:
            self.insert(0, Title(children=(title,)))


class EvaluationSection(Section):

    def __init__(self, message, **kwargs):
        super(EvaluationSection, self).__init__(**kwargs)
        title = Paragraph()
        title.append(Text("-" * len(message)))
        self.append(title)

        message_body = Paragraph()
        message_body.append(Text(message))
        self.append(message_body)


class Title(BaseLayout):
    """a title

    attributes :
    * BaseLayout attributes

    A title must not contains a section nor a paragraph!
    """


class Paragraph(BaseLayout):
    """a simple text paragraph

    attributes :
    * BaseLayout attributes

    A paragraph must not contains a section !
    """


class Table(BaseLayout):
    """some tabular data

    attributes :
    * BaseLayout attributes
    * cols : the number of columns of the table (REQUIRED)
    * rheaders : the first row's elements are table's header
    * cheaders : the first col's elements are table's header
    * title : the table's optional title
    """
    def __init__(self, cols, title=None,
                 rheaders=0, cheaders=0,
                 **kwargs):
        super(Table, self).__init__(**kwargs)
        assert isinstance(cols, int)
        self.cols = cols
        self.title = title
        self.rheaders = rheaders
        self.cheaders = cheaders

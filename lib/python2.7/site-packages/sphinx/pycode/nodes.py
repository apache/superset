# -*- coding: utf-8 -*-
"""
    sphinx.pycode.nodes
    ~~~~~~~~~~~~~~~~~~~

    Parse tree node implementations.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

if False:
    # For type annotation
    from typing import Callable  # NOQA


class BaseNode(object):
    """
    Node superclass for both terminal and nonterminal nodes.
    """
    parent = None  # type: BaseNode

    def _eq(self, other):
        raise NotImplementedError

    def __eq__(self, other):
        if self.__class__ is not other.__class__:
            return NotImplemented
        return self._eq(other)

    def __ne__(self, other):
        if self.__class__ is not other.__class__:
            return NotImplemented
        return not self._eq(other)

    __hash__ = None  # type: Callable[[object], int]

    def get_prev_sibling(self):
        """Return previous child in parent's children, or None."""
        if self.parent is None:
            return None
        for i, child in enumerate(self.parent.children):
            if child is self:
                if i == 0:
                    return None
                return self.parent.children[i - 1]

    def get_next_sibling(self):
        """Return next child in parent's children, or None."""
        if self.parent is None:
            return None
        for i, child in enumerate(self.parent.children):
            if child is self:
                try:
                    return self.parent.children[i + 1]
                except IndexError:
                    return None

    def get_prev_leaf(self):
        """Return the leaf node that precedes this node in the parse tree."""
        def last_child(node):
            if isinstance(node, Leaf):
                return node
            elif not node.children:
                return None
            else:
                return last_child(node.children[-1])
        if self.parent is None:
            return None
        prev = self.get_prev_sibling()
        if isinstance(prev, Leaf):
            return prev
        elif prev is not None:
            return last_child(prev)
        return self.parent.get_prev_leaf()

    def get_next_leaf(self):
        """Return self if leaf, otherwise the leaf node that succeeds this
        node in the parse tree.
        """
        node = self
        while not isinstance(node, Leaf):
            assert node.children
            node = node.children[0]
        return node

    def get_lineno(self):
        """Return the line number which generated the invocant node."""
        return self.get_next_leaf().lineno

    def get_prefix(self):
        """Return the prefix of the next leaf node."""
        # only leaves carry a prefix
        return self.get_next_leaf().prefix


class Node(BaseNode):
    """
    Node implementation for nonterminals.
    """

    def __init__(self, type, children, context=None):
        # type of nonterminals is >= 256
        # assert type >= 256, type
        self.type = type
        self.children = list(children)
        for ch in self.children:
            # assert ch.parent is None, repr(ch)
            ch.parent = self

    def __repr__(self):
        return '%s(%s, %r)' % (self.__class__.__name__,
                               self.type, self.children)

    def __str__(self):
        """This reproduces the input source exactly."""
        return ''.join(map(str, self.children))

    def _eq(self, other):
        return (self.type, self.children) == (other.type, other.children)

    # support indexing the node directly instead of .children

    def __getitem__(self, index):
        return self.children[index]

    def __iter__(self):
        return iter(self.children)

    def __len__(self):
        return len(self.children)


class Leaf(BaseNode):
    """
    Node implementation for leaf nodes (terminals).
    """
    prefix = ''  # Whitespace and comments preceding this token in the input
    lineno = 0   # Line where this token starts in the input
    column = 0   # Column where this token tarts in the input

    def __init__(self, type, value, context=None):
        # type of terminals is below 256
        # assert 0 <= type < 256, type
        self.type = type
        self.value = value
        if context is not None:
            self.prefix, (self.lineno, self.column) = context

    def __repr__(self):
        return '%s(%r, %r, %r)' % (self.__class__.__name__,
                                   self.type, self.value, self.prefix)

    def __str__(self):
        """This reproduces the input source exactly."""
        return self.prefix + str(self.value)

    def _eq(self, other):
        """Compares two nodes for equality."""
        return (self.type, self.value) == (other.type, other.value)


def convert(grammar, raw_node):
    """Convert raw node to a Node or Leaf instance."""
    type, value, context, children = raw_node
    if children or type in grammar.number2symbol:
        # If there's exactly one child, return that child instead of
        # creating a new node.
        if len(children) == 1:
            return children[0]
        return Node(type, children, context=context)
    else:
        return Leaf(type, value, context=context)


def nice_repr(node, number2name, prefix=False):
    def _repr(node):
        if isinstance(node, Leaf):
            return "%s(%r)" % (number2name[node.type], node.value)
        else:
            return "%s(%s)" % (number2name[node.type],
                               ', '.join(map(_repr, node.children)))

    def _prepr(node):
        if isinstance(node, Leaf):
            return "%s(%r, %r)" % (number2name[node.type],
                                   node.prefix, node.value)
        else:
            return "%s(%s)" % (number2name[node.type],
                               ', '.join(map(_prepr, node.children)))
    return (prefix and _prepr or _repr)(node)


class NodeVisitor(object):
    def __init__(self, number2name, *args):
        self.number2name = number2name
        self.init(*args)

    def init(self, *args):
        pass

    def visit(self, node):
        """Visit a node."""
        method = 'visit_' + self.number2name[node.type]
        visitor = getattr(self, method, self.generic_visit)
        return visitor(node)

    def generic_visit(self, node):
        """Called if no explicit visitor function exists for a node."""
        if isinstance(node, Node):
            for child in node:  # type: ignore
                self.visit(child)

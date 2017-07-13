# -*- coding: utf-8 -*-
"""
    sphinx.pycode
    ~~~~~~~~~~~~~

    Utilities parsing and analyzing Python code.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""
from __future__ import print_function

import re
import sys
from os import path

from six import iteritems, text_type, BytesIO, StringIO

from sphinx import package_dir
from sphinx.errors import PycodeError
from sphinx.pycode import nodes
from sphinx.pycode.pgen2 import driver, token, tokenize, parse, literals
from sphinx.util import get_module_source, detect_encoding
from sphinx.util.pycompat import TextIOWrapper
from sphinx.util.docstrings import prepare_docstring, prepare_commentdoc

if False:
    # For type annotation
    from typing import Any, Dict, List, Tuple  # NOQA


# load the Python grammar
_grammarfile = path.join(package_dir, 'pycode',
                         'Grammar-py%d.txt' % sys.version_info[0])
pygrammar = driver.load_grammar(_grammarfile)
pydriver = driver.Driver(pygrammar, convert=nodes.convert)


# an object with attributes corresponding to token and symbol names
class sym(object):
    pass


for k, v in iteritems(pygrammar.symbol2number):
    setattr(sym, k, v)
for k, v in iteritems(token.tok_name):
    setattr(sym, v, k)

# a dict mapping terminal and nonterminal numbers to their names
number2name = pygrammar.number2symbol.copy()
number2name.update(token.tok_name)

_eq = nodes.Leaf(token.EQUAL, '=')

emptyline_re = re.compile(r'^\s*(#.*)?$')


class AttrDocVisitor(nodes.NodeVisitor):
    """
    Visitor that collects docstrings for attribute assignments on toplevel and
    in classes (class attributes and attributes set in __init__).

    The docstrings can either be in special '#:' comments before the assignment
    or in a docstring after it.
    """
    def init(self, scope, encoding):
        self.scope = scope
        self.in_init = 0
        self.encoding = encoding
        self.namespace = []  # type: List[unicode]
        self.collected = {}  # type: Dict[Tuple[unicode, unicode], unicode]
        self.tagnumber = 0
        self.tagorder = {}   # type: Dict[unicode, int]

    def add_tag(self, name):
        name = '.'.join(self.namespace + [name])
        self.tagorder[name] = self.tagnumber
        self.tagnumber += 1

    def visit_classdef(self, node):
        """Visit a class."""
        self.add_tag(node[1].value)
        self.namespace.append(node[1].value)
        self.generic_visit(node)
        self.namespace.pop()

    def visit_funcdef(self, node):
        """Visit a function (or method)."""
        # usually, don't descend into functions -- nothing interesting there
        self.add_tag(node[1].value)
        if node[1].value == '__init__':
            # however, collect attributes set in __init__ methods
            self.in_init += 1
            self.generic_visit(node)
            self.in_init -= 1

    def visit_expr_stmt(self, node):
        """Visit an assignment which may have a special comment before (or
        after) it.
        """
        if _eq not in node.children:
            # not an assignment (we don't care for augmented assignments)
            return
        # look *after* the node; there may be a comment prefixing the NEWLINE
        # of the simple_stmt
        parent = node.parent
        idx = parent.children.index(node) + 1
        while idx < len(parent):
            if parent[idx].type == sym.SEMI:  # type: ignore
                idx += 1
                continue  # skip over semicolon
            if parent[idx].type == sym.NEWLINE:  # type: ignore
                prefix = parent[idx].get_prefix()
                if not isinstance(prefix, text_type):
                    prefix = prefix.decode(self.encoding)
                docstring = prepare_commentdoc(prefix)
                if docstring:
                    self.add_docstring(node, docstring)
                    return  # don't allow docstrings both before and after
            break
        # now look *before* the node
        pnode = node[0]
        prefix = pnode.get_prefix()
        # if the assignment is the first statement on a new indentation
        # level, its preceding whitespace and comments are not assigned
        # to that token, but the first INDENT or DEDENT token
        while not prefix:
            pnode = pnode.get_prev_leaf()
            if not pnode or pnode.type not in (token.INDENT, token.DEDENT):
                break
            prefix = pnode.get_prefix()
        if not isinstance(prefix, text_type):
            prefix = prefix.decode(self.encoding)
        docstring = prepare_commentdoc(prefix)
        self.add_docstring(node, docstring)

    def visit_simple_stmt(self, node):
        """Visit a docstring statement which may have an assignment before."""
        if node[0].type != token.STRING:
            # not a docstring; but still need to visit children
            return self.generic_visit(node)
        prev = node.get_prev_sibling()
        if not prev:
            return
        if (prev.type == sym.simple_stmt and  # type: ignore
           prev[0].type == sym.expr_stmt and _eq in prev[0].children):  # type: ignore
            # need to "eval" the string because it's returned in its
            # original form
            docstring = literals.evalString(node[0].value, self.encoding)
            docstring = prepare_docstring(docstring)
            self.add_docstring(prev[0], docstring)

    def add_docstring(self, node, docstring):
        # add an item for each assignment target
        for i in range(0, len(node) - 1, 2):
            target = node[i]
            if self.in_init and self.number2name[target.type] == 'power':
                # maybe an attribute assignment -- check necessary conditions
                if (  # node must have two children
                        len(target) != 2 or
                        # first child must be "self"
                        target[0].type != token.NAME or target[0].value != 'self' or
                        # second child must be a "trailer" with two children
                        self.number2name[target[1].type] != 'trailer' or
                        len(target[1]) != 2 or
                        # first child must be a dot, second child a name
                        target[1][0].type != token.DOT or
                        target[1][1].type != token.NAME):
                    continue
                name = target[1][1].value
            elif target.type != token.NAME:
                # don't care about other complex targets
                continue
            else:
                name = target.value
            self.add_tag(name)
            if docstring:
                namespace = '.'.join(self.namespace)
                if namespace.startswith(self.scope):
                    self.collected[namespace, name] = docstring


class ModuleAnalyzer(object):
    # cache for analyzer objects -- caches both by module and file name
    cache = {}  # type: Dict[Tuple[unicode, unicode], Any]

    @classmethod
    def for_string(cls, string, modname, srcname='<string>'):
        if isinstance(string, bytes):
            return cls(BytesIO(string), modname, srcname)
        return cls(StringIO(string), modname, srcname, decoded=True)

    @classmethod
    def for_file(cls, filename, modname):
        if ('file', filename) in cls.cache:
            return cls.cache['file', filename]
        try:
            fileobj = open(filename, 'rb')
        except Exception as err:
            raise PycodeError('error opening %r' % filename, err)
        obj = cls(fileobj, modname, filename)
        cls.cache['file', filename] = obj
        return obj

    @classmethod
    def for_module(cls, modname):
        if ('module', modname) in cls.cache:
            entry = cls.cache['module', modname]
            if isinstance(entry, PycodeError):
                raise entry
            return entry

        try:
            type, source = get_module_source(modname)
            if type == 'string':
                obj = cls.for_string(source, modname)
            else:
                obj = cls.for_file(source, modname)
        except PycodeError as err:
            cls.cache['module', modname] = err
            raise
        cls.cache['module', modname] = obj
        return obj

    def __init__(self, source, modname, srcname, decoded=False):
        # name of the module
        self.modname = modname
        # name of the source file
        self.srcname = srcname
        # file-like object yielding source lines
        self.source = source

        # cache the source code as well
        pos = self.source.tell()
        if not decoded:
            self.encoding = detect_encoding(self.source.readline)
            self.source.seek(pos)
            self.code = self.source.read().decode(self.encoding)
            self.source.seek(pos)
            self.source = TextIOWrapper(self.source, self.encoding)
        else:
            self.encoding = None
            self.code = self.source.read()
            self.source.seek(pos)

        # will be filled by tokenize()
        self.tokens = None      # type: List[unicode]
        # will be filled by parse()
        self.parsetree = None   # type: Any
        # will be filled by find_attr_docs()
        self.attr_docs = None   # type: List[unicode]
        self.tagorder = None    # type: Dict[unicode, int]
        # will be filled by find_tags()
        self.tags = None        # type: List[unicode]

    def tokenize(self):
        """Generate tokens from the source."""
        if self.tokens is not None:
            return
        try:
            self.tokens = list(tokenize.generate_tokens(self.source.readline))
        except tokenize.TokenError as err:
            raise PycodeError('tokenizing failed', err)
        self.source.close()

    def parse(self):
        """Parse the generated source tokens."""
        if self.parsetree is not None:
            return
        self.tokenize()
        try:
            self.parsetree = pydriver.parse_tokens(self.tokens)
        except parse.ParseError as err:
            raise PycodeError('parsing failed', err)

    def find_attr_docs(self, scope=''):
        """Find class and module-level attributes and their documentation."""
        if self.attr_docs is not None:
            return self.attr_docs
        self.parse()
        attr_visitor = AttrDocVisitor(number2name, scope, self.encoding)
        attr_visitor.visit(self.parsetree)
        self.attr_docs = attr_visitor.collected
        self.tagorder = attr_visitor.tagorder
        # now that we found everything we could in the tree, throw it away
        # (it takes quite a bit of memory for large modules)
        self.parsetree = None
        return attr_visitor.collected

    def find_tags(self):
        """Find class, function and method definitions and their location."""
        if self.tags is not None:
            return self.tags
        self.tokenize()
        result = {}
        namespace = []  # type: List[unicode]
        stack = []      # type: List[Tuple[unicode, unicode, unicode, int]]
        indent = 0
        decopos = None
        defline = False
        expect_indent = False
        emptylines = 0

        def tokeniter(ignore = (token.COMMENT,)):
            for tokentup in self.tokens:
                if tokentup[0] not in ignore:
                    yield tokentup
        tokeniter = tokeniter()
        for type, tok, spos, epos, line in tokeniter:  # type: ignore
            if expect_indent and type != token.NL:
                if type != token.INDENT:
                    # no suite -- one-line definition
                    assert stack
                    dtype, fullname, startline, _ = stack.pop()
                    endline = epos[0]
                    namespace.pop()
                    result[fullname] = (dtype, startline, endline - emptylines)
                expect_indent = False
            if tok in ('def', 'class'):
                name = next(tokeniter)[1]  # type: ignore
                namespace.append(name)
                fullname = '.'.join(namespace)
                stack.append((tok, fullname, decopos or spos[0], indent))
                defline = True
                decopos = None
            elif type == token.OP and tok == '@':
                if decopos is None:
                    decopos = spos[0]
            elif type == token.INDENT:
                expect_indent = False
                indent += 1
            elif type == token.DEDENT:
                indent -= 1
                # if the stacklevel is the same as it was before the last
                # def/class block, this dedent closes that block
                if stack and indent == stack[-1][3]:
                    dtype, fullname, startline, _ = stack.pop()
                    endline = spos[0]
                    namespace.pop()
                    result[fullname] = (dtype, startline, endline - emptylines)
            elif type == token.NEWLINE:
                # if this line contained a definition, expect an INDENT
                # to start the suite; if there is no such INDENT
                # it's a one-line definition
                if defline:
                    defline = False
                    expect_indent = True
                emptylines = 0
            elif type == token.NL:
                # count up if line is empty or comment only
                if emptyline_re.match(line):
                    emptylines += 1
                else:
                    emptylines = 0
        self.tags = result
        return result


if __name__ == '__main__':
    import time
    import pprint
    x0 = time.time()
    # ma = ModuleAnalyzer.for_file(__file__.rstrip('c'), 'sphinx.builders.html')
    ma = ModuleAnalyzer.for_file('sphinx/environment.py',
                                 'sphinx.environment')
    ma.tokenize()
    x1 = time.time()
    ma.parse()
    x2 = time.time()
    # for (ns, name), doc in iteritems(ma.find_attr_docs()):
    #     print '>>', ns, name
    #     print '\n'.join(doc)
    pprint.pprint(ma.find_tags())
    x3 = time.time()
    # print nodes.nice_repr(ma.parsetree, number2name)
    print("tokenizing %.4f, parsing %.4f, finding %.4f" % (x1 - x0, x2 - x1, x3 - x2))

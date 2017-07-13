# Copyright (c) 2006, 2008, 2010, 2013-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""
generic classes/functions for pyreverse core/extensions
"""
from __future__ import print_function

import os
import re
import sys

########### pyreverse option utils ##############################


RCFILE = '.pyreverserc'

def get_default_options():
    """
    Read config file and return list of options
    """
    options = []
    home = os.environ.get('HOME', '')
    if home:
        rcfile = os.path.join(home, RCFILE)
        try:
            options = open(rcfile).read().split()
        except IOError:
            pass # ignore if no config file found
    return options

def insert_default_options():
    """insert default options to sys.argv
    """
    options = get_default_options()
    options.reverse()
    for arg in options:
        sys.argv.insert(1, arg)



# astroid utilities ###########################################################

SPECIAL = re.compile('^__[A-Za-z0-9]+[A-Za-z0-9_]*__$')
PRIVATE = re.compile('^__[_A-Za-z0-9]*[A-Za-z0-9]+_?$')
PROTECTED = re.compile('^_[_A-Za-z0-9]*$')

def get_visibility(name):
    """return the visibility from a name: public, protected, private or special
    """
    if SPECIAL.match(name):
        visibility = 'special'
    elif PRIVATE.match(name):
        visibility = 'private'
    elif PROTECTED.match(name):
        visibility = 'protected'

    else:
        visibility = 'public'
    return visibility

ABSTRACT = re.compile('^.*Abstract.*')
FINAL = re.compile('^[A-Z_]*$')

def is_abstract(node):
    """return true if the given class node correspond to an abstract class
    definition
    """
    return ABSTRACT.match(node.name)

def is_final(node):
    """return true if the given class/function node correspond to final
    definition
    """
    return FINAL.match(node.name)

def is_interface(node):
    # bw compat
    return node.type == 'interface'

def is_exception(node):
    # bw compat
    return node.type == 'exception'


# Helpers #####################################################################

_CONSTRUCTOR = 1
_SPECIAL = 2
_PROTECTED = 4
_PRIVATE = 8
MODES = {
    'ALL'       : 0,
    'PUB_ONLY'  : _SPECIAL + _PROTECTED + _PRIVATE,
    'SPECIAL'   : _SPECIAL,
    'OTHER'     : _PROTECTED + _PRIVATE,
}
VIS_MOD = {'special': _SPECIAL, 'protected': _PROTECTED,
           'private': _PRIVATE, 'public': 0}


class FilterMixIn(object):
    """filter nodes according to a mode and nodes' visibility
    """
    def __init__(self, mode):
        "init filter modes"
        __mode = 0
        for nummod in mode.split('+'):
            try:
                __mode += MODES[nummod]
            except KeyError as ex:
                print('Unknown filter mode %s' % ex, file=sys.stderr)
        self.__mode = __mode


    def show_attr(self, node):
        """return true if the node should be treated
        """
        visibility = get_visibility(getattr(node, 'name', node))
        return not self.__mode & VIS_MOD[visibility]


class ASTWalker(object):
    """a walker visiting a tree in preorder, calling on the handler:

    * visit_<class name> on entering a node, where class name is the class of
    the node in lower case

    * leave_<class name> on leaving a node, where class name is the class of
    the node in lower case
    """

    def __init__(self, handler):
        self.handler = handler
        self._cache = {}

    def walk(self, node, _done=None):
        """walk on the tree from <node>, getting callbacks from handler"""
        if _done is None:
            _done = set()
        if node in _done:
            raise AssertionError((id(node), node, node.parent))
        _done.add(node)
        self.visit(node)
        for child_node in node.get_children():
            assert child_node is not node
            self.walk(child_node, _done)
        self.leave(node)
        assert node.parent is not node

    def get_callbacks(self, node):
        """get callbacks from handler for the visited node"""
        klass = node.__class__
        methods = self._cache.get(klass)
        if methods is None:
            handler = self.handler
            kid = klass.__name__.lower()
            e_method = getattr(handler, 'visit_%s' % kid,
                               getattr(handler, 'visit_default', None))
            l_method = getattr(handler, 'leave_%s' % kid,
                               getattr(handler, 'leave_default', None))
            self._cache[klass] = (e_method, l_method)
        else:
            e_method, l_method = methods
        return e_method, l_method

    def visit(self, node):
        """walk on the tree from <node>, getting callbacks from handler"""
        method = self.get_callbacks(node)[0]
        if method is not None:
            method(node)

    def leave(self, node):
        """walk on the tree from <node>, getting callbacks from handler"""
        method = self.get_callbacks(node)[1]
        if method is not None:
            method(node)


class LocalsVisitor(ASTWalker):
    """visit a project by traversing the locals dictionary"""
    def __init__(self):
        ASTWalker.__init__(self, self)
        self._visited = {}

    def visit(self, node):
        """launch the visit starting from the given node"""
        if node in self._visited:
            return
        self._visited[node] = 1 # FIXME: use set ?
        methods = self.get_callbacks(node)
        if methods[0] is not None:
            methods[0](node)
        if hasattr(node, 'locals'): # skip Instance and other proxy
            for local_node in node.values():
                self.visit(local_node)
        if methods[1] is not None:
            return methods[1](node)

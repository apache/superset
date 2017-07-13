# Copyright (c) 2006-2013, 2015 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2014 Google, Inc.
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER

"""Python Abstract Syntax Tree New Generation

The aim of this module is to provide a common base representation of
python source code for projects such as pychecker, pyreverse,
pylint... Well, actually the development of this library is essentially
governed by pylint's needs.

It extends class defined in the python's _ast module with some
additional methods and attributes. Instance attributes are added by a
builder object, which can either generate extended ast (let's call
them astroid ;) by visiting an existent ast tree or by inspecting living
object. Methods are added by monkey patching ast classes.

Main modules are:

* nodes and scoped_nodes for more information about methods and
  attributes added to different node classes

* the manager contains a high level object to get astroid trees from
  source files and living objects. It maintains a cache of previously
  constructed tree for quick access

* builder contains the class responsible to build astroid trees
"""

import os
import sys
import re
from operator import attrgetter

import enum


_Context = enum.Enum('Context', 'Load Store Del')
Load = _Context.Load
Store = _Context.Store
Del = _Context.Del
del _Context


from .__pkginfo__ import version as __version__
# WARNING: internal imports order matters !

# pylint: disable=redefined-builtin, wildcard-import

# make all exception classes accessible from astroid package
from astroid.exceptions import *

# make all node classes accessible from astroid package
from astroid.nodes import *

# trigger extra monkey-patching
from astroid import inference

# more stuff available
from astroid import raw_building
from astroid.bases import BaseInstance, Instance, BoundMethod, UnboundMethod
from astroid.node_classes import are_exclusive, unpack_infer
from astroid.scoped_nodes import builtin_lookup
from astroid.builder import parse, extract_node
from astroid.util import Uninferable, YES

# make a manager instance (borg) accessible from astroid package
from astroid.manager import AstroidManager
MANAGER = AstroidManager()
del AstroidManager

# transform utilities (filters and decorator)

class AsStringRegexpPredicate(object):
    """ClassDef to be used as predicate that may be given to `register_transform`

    First argument is a regular expression that will be searched against the `as_string`
    representation of the node onto which it's applied.

    If specified, the second argument is an `attrgetter` expression that will be
    applied on the node first to get the actual node on which `as_string` should
    be called.

    WARNING: This can be fairly slow, as it has to convert every AST node back
    to Python code; you should consider examining the AST directly instead.
    """
    def __init__(self, regexp, expression=None):
        self.regexp = re.compile(regexp)
        self.expression = expression

    def __call__(self, node):
        if self.expression is not None:
            node = attrgetter(self.expression)(node)
        # pylint: disable=no-member; github.com/pycqa/astroid/126
        return self.regexp.search(node.as_string())

def inference_tip(infer_function):
    """Given an instance specific inference function, return a function to be
    given to MANAGER.register_transform to set this inference function.

    Typical usage

    .. sourcecode:: python

       MANAGER.register_transform(Call, inference_tip(infer_named_tuple),
                                  predicate)
    """
    def transform(node, infer_function=infer_function):
        node._explicit_inference = infer_function
        return node
    return transform


def register_module_extender(manager, module_name, get_extension_mod):
    def transform(node):
        extension_module = get_extension_mod()
        for name, objs in extension_module.locals.items():
            node.locals[name] = objs
            for obj in objs:
                if obj.parent is extension_module:
                    obj.parent = node

    manager.register_transform(Module, transform, lambda n: n.name == module_name)


# load brain plugins
BRAIN_MODULES_DIR = os.path.join(os.path.dirname(__file__), 'brain')
if BRAIN_MODULES_DIR not in sys.path:
    # add it to the end of the list so user path take precedence
    sys.path.append(BRAIN_MODULES_DIR)
# load modules in this directory
for module in os.listdir(BRAIN_MODULES_DIR):
    if module.endswith('.py'):
        __import__(module[:-3])

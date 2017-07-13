"""test unused variable
"""
# pylint: disable=invalid-name, redefined-outer-name, no-absolute-import
from __future__ import print_function
PATH = OS = collections = deque = None

def function(matches):
    """"yo"""
    aaaa = 1
    index = -1
    for match in matches:
        index += 1
        print(match)

def visit_if(self, node):
    """increments the branches counter"""
    branches = 1
    # don't double count If nodes coming from some 'elif'
    if node.orelse and len(node.orelse) > 1:
        branches += 1
    self.inc_branch(branches)
    self.stmts += branches

def test_global():
    """ Test various assignments of global
    variables through imports.
    """
    global PATH, OS, collections, deque
    from os import path as PATH
    import os as OS
    import collections
    from collections import deque
    # make sure that these triggers unused-variable
    from sys import platform
    from sys import version as VERSION
    import this
    import re as RE

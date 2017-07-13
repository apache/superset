# Copyright (c) 2006-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2013-2014 Google, Inc.
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""utilities methods and classes for checkers

Base id of standard checkers (used in msg and report ids):
01: base
02: classes
03: format
04: import
05: misc
06: variables
07: exceptions
08: similar
09: design_analysis
10: newstyle
11: typecheck
12: logging
13: string_format
14: string_constant
15: stdlib
16: python3
17: refactoring
18-50: not yet used: reserved for future internal checkers.
51-99: perhaps used: reserved for external checkers

The raw_metrics checker has no number associated since it doesn't emit any
messages nor reports. XXX not true, emit a 07 report !

"""

import sys
import tokenize
import warnings

from pylint.config import OptionsProviderMixIn
from pylint.reporters import diff_string
from pylint.utils import register_plugins
from pylint.interfaces import UNDEFINED


def table_lines_from_stats(stats, old_stats, columns):
    """get values listed in <columns> from <stats> and <old_stats>,
    and return a formated list of values, designed to be given to a
    ureport.Table object
    """
    lines = []
    for m_type in columns:
        new = stats[m_type]
        format = str # pylint: disable=redefined-builtin
        if isinstance(new, float):
            format = lambda num: '%.3f' % num
        old = old_stats.get(m_type)
        if old is not None:
            diff_str = diff_string(old, new)
            old = format(old)
        else:
            old, diff_str = 'NC', 'NC'
        lines += (m_type.replace('_', ' '), format(new), old, diff_str)
    return lines


class BaseChecker(OptionsProviderMixIn):
    """base class for checkers"""
    # checker name (you may reuse an existing one)
    name = None
    # options level (0 will be displaying in --help, 1 in --long-help)
    level = 1
    # ordered list of options to control the ckecker behaviour
    options = ()
    # messages issued by this checker
    msgs = {}
    # reports issued by this checker
    reports = ()
    # mark this checker as enabled or not.
    enabled = True

    def __init__(self, linter=None):
        """checker instances should have the linter as argument

        linter is an object implementing ILinter
        """
        self.name = self.name.lower()
        OptionsProviderMixIn.__init__(self)
        self.linter = linter

    def add_message(self, msg_id, line=None, node=None, args=None, confidence=UNDEFINED):
        """add a message of a given type"""
        self.linter.add_message(msg_id, line, node, args, confidence)

    # dummy methods implementing the IChecker interface

    def open(self):
        """called before visiting project (i.e set of modules)"""

    def close(self):
        """called after visiting project (i.e set of modules)"""


class BaseTokenChecker(BaseChecker):
    """Base class for checkers that want to have access to the token stream."""

    def process_tokens(self, tokens):
        """Should be overridden by subclasses."""
        raise NotImplementedError()


def initialize(linter):
    """initialize linter with checkers in this package """
    register_plugins(linter, __path__[0])

__all__ = ('BaseChecker', 'initialize')

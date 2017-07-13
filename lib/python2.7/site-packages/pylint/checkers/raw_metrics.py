# Copyright (c) 2007, 2010, 2013, 2015 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

""" Copyright (c) 2003-2010 LOGILAB S.A. (Paris, FRANCE).
 http://www.logilab.fr/ -- mailto:contact@logilab.fr

Raw metrics checker
"""

import tokenize

from pylint.interfaces import ITokenChecker
from pylint.exceptions import EmptyReportError
from pylint.checkers import BaseTokenChecker
from pylint.reporters import diff_string
from pylint.reporters.ureports.nodes import Table


def report_raw_stats(sect, stats, old_stats):
    """calculate percentage of code / doc / comment / empty
    """
    total_lines = stats['total_lines']
    if not total_lines:
        raise EmptyReportError()
    sect.description = '%s lines have been analyzed' % total_lines
    lines = ('type', 'number', '%', 'previous', 'difference')
    for node_type in ('code', 'docstring', 'comment', 'empty'):
        key = node_type + '_lines'
        total = stats[key]
        percent = float(total * 100) / total_lines
        old = old_stats.get(key, None)
        if old is not None:
            diff_str = diff_string(old, total)
        else:
            old, diff_str = 'NC', 'NC'
        lines += (node_type, str(total), '%.2f' % percent,
                  str(old), diff_str)
    sect.append(Table(children=lines, cols=5, rheaders=1))


class RawMetricsChecker(BaseTokenChecker):
    """does not check anything but gives some raw metrics :
    * total number of lines
    * total number of code lines
    * total number of docstring lines
    * total number of comments lines
    * total number of empty lines
    """

    __implements__ = (ITokenChecker,)

    # configuration section name
    name = 'metrics'
    # configuration options
    options = ()
    # messages
    msgs = {}
    # reports
    reports = (('RP0701', 'Raw metrics', report_raw_stats),)

    def __init__(self, linter):
        BaseTokenChecker.__init__(self, linter)
        self.stats = None

    def open(self):
        """init statistics"""
        self.stats = self.linter.add_stats(total_lines=0, code_lines=0,
                                           empty_lines=0, docstring_lines=0,
                                           comment_lines=0)

    def process_tokens(self, tokens):
        """update stats"""
        i = 0
        tokens = list(tokens)
        while i < len(tokens):
            i, lines_number, line_type = get_type(tokens, i)
            self.stats['total_lines'] += lines_number
            self.stats[line_type] += lines_number


JUNK = (tokenize.NL, tokenize.INDENT, tokenize.NEWLINE, tokenize.ENDMARKER)

def get_type(tokens, start_index):
    """return the line type : docstring, comment, code, empty"""
    i = start_index
    tok_type = tokens[i][0]
    start = tokens[i][2]
    pos = start
    line_type = None
    while i < len(tokens) and tokens[i][2][0] == start[0]:
        tok_type = tokens[i][0]
        pos = tokens[i][3]
        if line_type is None:
            if tok_type == tokenize.STRING:
                line_type = 'docstring_lines'
            elif tok_type == tokenize.COMMENT:
                line_type = 'comment_lines'
            elif tok_type in JUNK:
                pass
            else:
                line_type = 'code_lines'
        i += 1
    if line_type is None:
        line_type = 'empty_lines'
    elif i < len(tokens) and tokens[i][0] == tokenize.NEWLINE:
        i += 1
    return i, pos[0] - start[0] + 1, line_type


def register(linter):
    """ required method to auto register this checker """
    linter.register_checker(RawMetricsChecker(linter))

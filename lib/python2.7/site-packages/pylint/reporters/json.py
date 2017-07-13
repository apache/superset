# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""JSON reporter"""
from __future__ import absolute_import, print_function

import cgi
import json
import sys

from pylint.interfaces import IReporter
from pylint.reporters import BaseReporter


class JSONReporter(BaseReporter):
    """Report messages and layouts in JSON."""

    __implements__ = IReporter
    name = 'json'
    extension = 'json'

    def __init__(self, output=sys.stdout):
        BaseReporter.__init__(self, output)
        self.messages = []

    def handle_message(self, msg):
        """Manage message of different type and in the context of path."""
        self.messages.append({
            'type': msg.category,
            'module': msg.module,
            'obj': msg.obj,
            'line': msg.line,
            'column': msg.column,
            'path': msg.path,
            'symbol': msg.symbol,
            # pylint: disable=deprecated-method; deprecated since 3.2.
            'message': cgi.escape(msg.msg or ''),
        })

    def display_messages(self, layout):
        """Launch layouts display"""
        if self.messages:
            print(json.dumps(self.messages, indent=4), file=self.out)

    def display_reports(self, layout): # pylint: disable=arguments-differ
        """Don't do nothing in this reporter."""

    def _display(self, layout):
        """Don't do nothing."""


def register(linter):
    """Register the reporter classes with the linter."""
    linter.register_reporter(JSONReporter)

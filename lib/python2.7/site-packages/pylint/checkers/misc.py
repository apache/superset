# Copyright (c) 2006, 2009-2013 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2013-2014 Google, Inc.
# Copyright (c) 2014 Alexandru Coman <fcoman@bitdefender.com>
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING


"""Check source code is ascii only or has an encoding declaration (PEP 263)"""

# pylint: disable=W0511

import re

import six

from pylint.interfaces import IRawChecker
from pylint.checkers import BaseChecker


MSGS = {
    'W0511': ('%s',
              'fixme',
              'Used when a warning note as FIXME or XXX is detected.'),
    'W0512': ('Cannot decode using encoding "%s", unexpected byte at position %d',
              'invalid-encoded-data',
              'Used when a source line cannot be decoded using the specified '
              'source file encoding.',
              {'maxversion': (3, 0)}),
}


class EncodingChecker(BaseChecker):

    """checks for:
    * warning notes in the code like FIXME, XXX
    * encoding issues.
    """
    __implements__ = IRawChecker

    # configuration section name
    name = 'miscellaneous'
    msgs = MSGS

    options = (('notes',
                {'type': 'csv', 'metavar': '<comma separated values>',
                 'default': ('FIXME', 'XXX', 'TODO'),
                 'help': ('List of note tags to take in consideration, '
                          'separated by a comma.')}),)

    def _check_note(self, notes, lineno, line):
        # First, simply check if the notes are in the line at all. This is an
        # optimisation to prevent using the regular expression on every line,
        # but rather only on lines which may actually contain one of the notes.
        # This prevents a pathological problem with lines that are hundreds
        # of thousands of characters long.
        for note in self.config.notes:
            if note in line:
                break
        else:
            return

        match = notes.search(line)
        if not match:
            return
        self.add_message('fixme', args=line[match.start(1):].rstrip(), line=lineno)

    def _check_encoding(self, lineno, line, file_encoding):
        try:
            return six.text_type(line, file_encoding)
        except UnicodeDecodeError as ex:
            self.add_message('invalid-encoded-data', line=lineno,
                             args=(file_encoding, ex.args[2]))

    def process_module(self, module):
        """inspect the source file to find encoding problem or fixmes like
        notes
        """
        if self.config.notes:
            notes = re.compile(
                r'.*?#\s*(%s)(:*\s*.*)' % "|".join(self.config.notes))
        else:
            notes = None
        if module.file_encoding:
            encoding = module.file_encoding
        else:
            encoding = 'ascii'

        with module.stream() as stream:
            for lineno, line in enumerate(stream):
                line = self._check_encoding(lineno + 1, line, encoding)
                if line is not None and notes:
                    self._check_note(notes, lineno + 1, line)


def register(linter):
    """required method to auto register this checker"""
    linter.register_checker(EncodingChecker(linter))

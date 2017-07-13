# Copyright (c) 2006-2007, 2010-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2013-2014 Google, Inc.
# Copyright (c) 2015 Florian Bruhin <me@the-compiler.org>
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Plain text reporters:

:text: the default one grouping messages by module
:colorized: an ANSI colorized text reporter
"""
from __future__ import print_function

import os
import warnings
import sys

import six

from pylint.interfaces import IReporter
from pylint.reporters import BaseReporter
from pylint import utils
from pylint.reporters.ureports.text_writer import TextWriter


TITLE_UNDERLINES = ['', '=', '-', '.']

ANSI_PREFIX = '\033['
ANSI_END = 'm'
ANSI_RESET = '\033[0m'
ANSI_STYLES = {
    'reset': "0",
    'bold': "1",
    'italic': "3",
    'underline': "4",
    'blink': "5",
    'inverse': "7",
    'strike': "9",
}
ANSI_COLORS = {
    'reset': "0",
    'black': "30",
    'red': "31",
    'green': "32",
    'yellow': "33",
    'blue': "34",
    'magenta': "35",
    'cyan': "36",
    'white': "37",
}

def _get_ansi_code(color=None, style=None):
    """return ansi escape code corresponding to color and style

    :type color: str or None
    :param color:
      the color name (see `ANSI_COLORS` for available values)
      or the color number when 256 colors are available

    :type style: str or None
    :param style:
      style string (see `ANSI_COLORS` for available values). To get
      several style effects at the same time, use a coma as separator.

    :raise KeyError: if an unexistent color or style identifier is given

    :rtype: str
    :return: the built escape code
    """
    ansi_code = []
    if style:
        style_attrs = utils._splitstrip(style)
        for effect in style_attrs:
            ansi_code.append(ANSI_STYLES[effect])
    if color:
        if color.isdigit():
            ansi_code.extend(['38', '5'])
            ansi_code.append(color)
        else:
            ansi_code.append(ANSI_COLORS[color])
    if ansi_code:
        return ANSI_PREFIX + ';'.join(ansi_code) + ANSI_END
    return ''

def colorize_ansi(msg, color=None, style=None):
    """colorize message by wrapping it with ansi escape codes

    :type msg: str or unicode
    :param msg: the message string to colorize

    :type color: str or None
    :param color:
      the color identifier (see `ANSI_COLORS` for available values)

    :type style: str or None
    :param style:
      style string (see `ANSI_COLORS` for available values). To get
      several style effects at the same time, use a coma as separator.

    :raise KeyError: if an unexistent color or style identifier is given

    :rtype: str or unicode
    :return: the ansi escaped string
    """
    # If both color and style are not defined, then leave the text as is
    if color is None and style is None:
        return msg
    escape_code = _get_ansi_code(color, style)
    # If invalid (or unknown) color, don't wrap msg with ansi codes
    if escape_code:
        return '%s%s%s' % (escape_code, msg, ANSI_RESET)
    return msg


class TextReporter(BaseReporter):
    """reports messages and layouts in plain text"""

    __implements__ = IReporter
    name = 'text'
    extension = 'txt'
    line_format = '{C}:{line:3d},{column:2d}: {msg} ({symbol})'

    def __init__(self, output=None):
        BaseReporter.__init__(self, output)
        self._modules = set()
        self._template = None

    def on_set_current_module(self, module, filepath):
        self._template = six.text_type(self.linter.config.msg_template or self.line_format)

    def write_message(self, msg):
        """Convenience method to write a formated message with class default template"""
        self.writeln(msg.format(self._template))

    def handle_message(self, msg):
        """manage message of different type and in the context of path"""
        if msg.module not in self._modules:
            if msg.module:
                self.writeln('************* Module %s' % msg.module)
                self._modules.add(msg.module)
            else:
                self.writeln('************* ')
        self.write_message(msg)

    def _display(self, layout):
        """launch layouts display"""
        print(file=self.out)
        TextWriter().format(layout, self.out)


class ParseableTextReporter(TextReporter):
    """a reporter very similar to TextReporter, but display messages in a form
    recognized by most text editors :

    <filename>:<linenum>:<msg>
    """
    name = 'parseable'
    line_format = '{path}:{line}: [{msg_id}({symbol}), {obj}] {msg}'

    def __init__(self, output=None):
        warnings.warn('%s output format is deprecated. This is equivalent '
                      'to --msg-template=%s' % (self.name, self.line_format),
                      DeprecationWarning)
        TextReporter.__init__(self, output)


class VSTextReporter(ParseableTextReporter):
    """Visual studio text reporter"""
    name = 'msvs'
    line_format = '{path}({line}): [{msg_id}({symbol}){obj}] {msg}'


class ColorizedTextReporter(TextReporter):
    """Simple TextReporter that colorizes text output"""

    name = 'colorized'
    COLOR_MAPPING = {
        "I" : ("green", None),
        'C' : (None, "bold"),
        'R' : ("magenta", "bold, italic"),
        'W' : ("blue", None),
        'E' : ("red", "bold"),
        'F' : ("red", "bold, underline"),
        'S' : ("yellow", "inverse"), # S stands for module Separator
    }

    def __init__(self, output=None, color_mapping=None):
        TextReporter.__init__(self, output)
        self.color_mapping = color_mapping or \
                             dict(ColorizedTextReporter.COLOR_MAPPING)
        ansi_terms = ['xterm-16color', 'xterm-256color']
        if os.environ.get('TERM') not in ansi_terms:
            if sys.platform == 'win32':
                import colorama
                self.out = colorama.AnsiToWin32(self.out)

    def _get_decoration(self, msg_id):
        """Returns the tuple color, style associated with msg_id as defined
        in self.color_mapping
        """
        try:
            return self.color_mapping[msg_id[0]]
        except KeyError:
            return None, None

    def handle_message(self, msg):
        """manage message of different types, and colorize output
        using ansi escape codes
        """
        if msg.module not in self._modules:
            color, style = self._get_decoration('S')
            if msg.module:
                modsep = colorize_ansi('************* Module %s' % msg.module,
                                       color, style)
            else:
                modsep = colorize_ansi('************* %s' % msg.module,
                                       color, style)
            self.writeln(modsep)
            self._modules.add(msg.module)
        color, style = self._get_decoration(msg.C)

        msg = msg._replace(
            **{attr: colorize_ansi(getattr(msg, attr), color, style)
               for attr in ('msg', 'symbol', 'category', 'C')})
        self.write_message(msg)


def register(linter):
    """Register the reporter classes with the linter."""
    linter.register_reporter(TextReporter)
    linter.register_reporter(ParseableTextReporter)
    linter.register_reporter(VSTextReporter)
    linter.register_reporter(ColorizedTextReporter)

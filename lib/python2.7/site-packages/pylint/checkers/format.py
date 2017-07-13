# Copyright (c) 2006-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2013-2015 Google, Inc.
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2014 Michal Nowikowski <godfryd@gmail.com>
# Copyright (c) 2015 Mike Frysinger <vapier@gentoo.org>
# Copyright (c) 2015 Mihai Balint <balint.mihai@gmail.com>
# Copyright (c) 2015 Fabio Natali <me@fabionatali.com>
# Copyright (c) 2015 Harut <yes@harutune.name>
# Copyright (c) 2016 Ashley Whetter <ashley@awhetter.co.uk>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Python code format's checker.

By default try to follow Guido's style guide :

http://www.python.org/doc/essays/styleguide.html

Some parts of the process_token method is based from The Tab Nanny std module.
"""

import keyword
import sys
import tokenize
from functools import reduce # pylint: disable=redefined-builtin

import six
from six.moves import zip, map, filter # pylint: disable=redefined-builtin

from astroid import nodes

from pylint.interfaces import ITokenChecker, IAstroidChecker, IRawChecker
from pylint.checkers import BaseTokenChecker
from pylint.checkers.utils import check_messages
from pylint.utils import WarningScope, OPTION_RGX

_ASYNC_TOKEN = 'async'
_CONTINUATION_BLOCK_OPENERS = ['elif', 'except', 'for', 'if', 'while', 'def', 'class']
_KEYWORD_TOKENS = ['assert', 'del', 'elif', 'except', 'for', 'if', 'in', 'not',
                   'raise', 'return', 'while', 'yield']
if sys.version_info < (3, 0):
    _KEYWORD_TOKENS.append('print')

_SPACED_OPERATORS = ['==', '<', '>', '!=', '<>', '<=', '>=',
                     '+=', '-=', '*=', '**=', '/=', '//=', '&=', '|=', '^=',
                     '%=', '>>=', '<<=']
_OPENING_BRACKETS = ['(', '[', '{']
_CLOSING_BRACKETS = [')', ']', '}']
_TAB_LENGTH = 8

_EOL = frozenset([tokenize.NEWLINE, tokenize.NL, tokenize.COMMENT])
_JUNK_TOKENS = (tokenize.COMMENT, tokenize.NL)

# Whitespace checking policy constants
_MUST = 0
_MUST_NOT = 1
_IGNORE = 2

# Whitespace checking config constants
_DICT_SEPARATOR = 'dict-separator'
_TRAILING_COMMA = 'trailing-comma'
_EMPTY_LINE = 'empty-line'
_NO_SPACE_CHECK_CHOICES = [_TRAILING_COMMA, _DICT_SEPARATOR, _EMPTY_LINE]
_DEFAULT_NO_SPACE_CHECK_CHOICES = [_TRAILING_COMMA, _DICT_SEPARATOR]

MSGS = {
    'C0301': ('Line too long (%s/%s)',
              'line-too-long',
              'Used when a line is longer than a given number of characters.'),
    'C0302': ('Too many lines in module (%s/%s)', # was W0302
              'too-many-lines',
              'Used when a module has too much lines, reducing its readability.'
             ),
    'C0303': ('Trailing whitespace',
              'trailing-whitespace',
              'Used when there is whitespace between the end of a line and the '
              'newline.'),
    'C0304': ('Final newline missing',
              'missing-final-newline',
              'Used when the last line in a file is missing a newline.'),
    'C0305': ('Trailing newlines',
              'trailing-newlines',
              'Used when there are trailing blank lines in a file.'),
    'W0311': ('Bad indentation. Found %s %s, expected %s',
              'bad-indentation',
              'Used when an unexpected number of indentation\'s tabulations or '
              'spaces has been found.'),
    'C0330': ('Wrong %s indentation%s%s.\n%s%s',
              'bad-continuation',
              'TODO'),
    'W0312': ('Found indentation with %ss instead of %ss',
              'mixed-indentation',
              'Used when there are some mixed tabs and spaces in a module.'),
    'W0301': ('Unnecessary semicolon', # was W0106
              'unnecessary-semicolon',
              'Used when a statement is ended by a semi-colon (";"), which \
              isn\'t necessary (that\'s python, not C ;).'),
    'C0321': ('More than one statement on a single line',
              'multiple-statements',
              'Used when more than on statement are found on the same line.',
              {'scope': WarningScope.NODE}),
    'C0325' : ('Unnecessary parens after %r keyword',
               'superfluous-parens',
               'Used when a single item in parentheses follows an if, for, or '
               'other keyword.'),
    'C0326': ('%s space %s %s %s\n%s',
              'bad-whitespace',
              ('Used when a wrong number of spaces is used around an operator, '
               'bracket or block opener.'),
              {'old_names': [('C0323', 'no-space-after-operator'),
                             ('C0324', 'no-space-after-comma'),
                             ('C0322', 'no-space-before-operator')]}),
    'W0332': ('Use of "l" as long integer identifier',
              'lowercase-l-suffix',
              'Used when a lower case "l" is used to mark a long integer. You '
              'should use a upper case "L" since the letter "l" looks too much '
              'like the digit "1"',
              {'maxversion': (3, 0)}),
    'C0327': ('Mixed line endings LF and CRLF',
              'mixed-line-endings',
              'Used when there are mixed (LF and CRLF) newline signs in a file.'),
    'C0328': ('Unexpected line ending format. There is \'%s\' while it should be \'%s\'.',
              'unexpected-line-ending-format',
              'Used when there is different newline than expected.'),
    }


def _underline_token(token):
    length = token[3][1] - token[2][1]
    offset = token[2][1]
    referenced_line = token[4]
    # If the referenced line does not end with a newline char, fix it
    if referenced_line[-1] != '\n':
        referenced_line += '\n'
    return referenced_line + (' ' * offset) + ('^' * length)

def _column_distance(token1, token2):
    if token1 == token2:
        return 0
    if token2[3] < token1[3]:
        token1, token2 = token2, token1
    if token1[3][0] != token2[2][0]:
        return None
    return token2[2][1] - token1[3][1]


def _last_token_on_line_is(tokens, line_end, token):
    return (line_end > 0 and tokens.token(line_end-1) == token or
            line_end > 1 and tokens.token(line_end-2) == token
            and tokens.type(line_end-1) == tokenize.COMMENT)


def _token_followed_by_eol(tokens, position):
    return (tokens.type(position+1) == tokenize.NL or
            tokens.type(position+1) == tokenize.COMMENT and
            tokens.type(position+2) == tokenize.NL)


def _get_indent_length(line):
    """Return the length of the indentation on the given token's line."""
    result = 0
    for char in line:
        if char == ' ':
            result += 1
        elif char == '\t':
            result += _TAB_LENGTH
        else:
            break
    return result


def _get_indent_hint_line(bar_positions, bad_position):
    """Return a line with |s for each of the positions in the given lists."""
    if not bar_positions:
        return ('', '')
    delta_message = ''
    markers = [(pos, '|') for pos in bar_positions]
    if len(markers) == 1:
        # if we have only one marker we'll provide an extra hint on how to fix
        expected_position = markers[0][0]
        delta = abs(expected_position - bad_position)
        direction = 'add' if expected_position > bad_position else 'remove'
        delta_message = _CONTINUATION_HINT_MESSAGE % (
            direction, delta, 's' if delta > 1 else '')
    markers.append((bad_position, '^'))
    markers.sort()
    line = [' '] * (markers[-1][0] + 1)
    for position, marker in markers:
        line[position] = marker
    return (''.join(line), delta_message)


class _ContinuedIndent(object):
    __slots__ = ('valid_outdent_offsets',
                 'valid_continuation_offsets',
                 'context_type',
                 'token',
                 'position')

    def __init__(self,
                 context_type,
                 token,
                 position,
                 valid_outdent_offsets,
                 valid_continuation_offsets):
        self.valid_outdent_offsets = valid_outdent_offsets
        self.valid_continuation_offsets = valid_continuation_offsets
        self.context_type = context_type
        self.position = position
        self.token = token


# The contexts for hanging indents.
# A hanging indented dictionary value after :
HANGING_DICT_VALUE = 'dict-value'
# Hanging indentation in an expression.
HANGING = 'hanging'
# Hanging indentation in a block header.
HANGING_BLOCK = 'hanging-block'
# Continued indentation inside an expression.
CONTINUED = 'continued'
# Continued indentation in a block header.
CONTINUED_BLOCK = 'continued-block'

SINGLE_LINE = 'single'
WITH_BODY = 'multi'

_CONTINUATION_MSG_PARTS = {
    HANGING_DICT_VALUE: ('hanging', ' in dict value'),
    HANGING: ('hanging', ''),
    HANGING_BLOCK: ('hanging', ' before block'),
    CONTINUED: ('continued', ''),
    CONTINUED_BLOCK: ('continued', ' before block'),
}

_CONTINUATION_HINT_MESSAGE = ' (%s %d space%s)'  # Ex: (remove 2 spaces)

def _Offsets(*args):
    """Valid indentation offsets for a continued line."""
    return dict((a, None) for a in args)


def _BeforeBlockOffsets(single, with_body):
    """Valid alternative indent offsets for continued lines before blocks.

    :param int single: Valid offset for statements on a single logical line.
    :param int with_body: Valid offset for statements on several lines.

    :returns: A dictionary mapping indent offsets to a string representing
        whether the indent if for a line or block.
    :rtype: dict
    """
    return {single: SINGLE_LINE, with_body: WITH_BODY}


class TokenWrapper(object):
    """A wrapper for readable access to token information."""

    def __init__(self, tokens):
        self._tokens = tokens

    def token(self, idx):
        return self._tokens[idx][1]

    def type(self, idx):
        return self._tokens[idx][0]

    def start_line(self, idx):
        return self._tokens[idx][2][0]

    def start_col(self, idx):
        return self._tokens[idx][2][1]

    def line(self, idx):
        return self._tokens[idx][4]


class ContinuedLineState(object):
    """Tracker for continued indentation inside a logical line."""

    def __init__(self, tokens, config):
        self._line_start = -1
        self._cont_stack = []
        self._is_block_opener = False
        self.retained_warnings = []
        self._config = config
        self._tokens = TokenWrapper(tokens)

    @property
    def has_content(self):
        return bool(self._cont_stack)

    @property
    def _block_indent_size(self):
        return len(self._config.indent_string.replace('\t', ' ' * _TAB_LENGTH))

    @property
    def _continuation_size(self):
        return self._config.indent_after_paren

    def handle_line_start(self, pos):
        """Record the first non-junk token at the start of a line."""
        if self._line_start > -1:
            return

        check_token_position = pos
        if self._tokens.token(pos) == _ASYNC_TOKEN:
            check_token_position += 1
        self._is_block_opener = self._tokens.token(
            check_token_position
        ) in _CONTINUATION_BLOCK_OPENERS
        self._line_start = pos

    def next_physical_line(self):
        """Prepares the tracker for a new physical line (NL)."""
        self._line_start = -1
        self._is_block_opener = False

    def next_logical_line(self):
        """Prepares the tracker for a new logical line (NEWLINE).

        A new logical line only starts with block indentation.
        """
        self.next_physical_line()
        self.retained_warnings = []
        self._cont_stack = []

    def add_block_warning(self, token_position, state, valid_offsets):
        self.retained_warnings.append((token_position, state, valid_offsets))

    def get_valid_offsets(self, idx):
        """Returns the valid offsets for the token at the given position."""
        # The closing brace on a dict or the 'for' in a dict comprehension may
        # reset two indent levels because the dict value is ended implicitly
        stack_top = -1
        if self._tokens.token(idx) in ('}', 'for') and self._cont_stack[-1].token == ':':
            stack_top = -2
        indent = self._cont_stack[stack_top]
        if self._tokens.token(idx) in _CLOSING_BRACKETS:
            valid_offsets = indent.valid_outdent_offsets
        else:
            valid_offsets = indent.valid_continuation_offsets
        return indent, valid_offsets.copy()

    def _hanging_indent_after_bracket(self, bracket, position):
        """Extracts indentation information for a hanging indent."""
        indentation = _get_indent_length(self._tokens.line(position))
        if self._is_block_opener and self._continuation_size == self._block_indent_size:
            return _ContinuedIndent(
                HANGING_BLOCK,
                bracket,
                position,
                _Offsets(indentation + self._continuation_size, indentation),
                _BeforeBlockOffsets(indentation + self._continuation_size,
                                    indentation + self._continuation_size * 2))
        if bracket == ':':
            # If the dict key was on the same line as the open brace, the new
            # correct indent should be relative to the key instead of the
            # current indent level
            paren_align = self._cont_stack[-1].valid_outdent_offsets
            next_align = self._cont_stack[-1].valid_continuation_offsets.copy()
            next_align_keys = list(next_align.keys())
            next_align[next_align_keys[0] + self._continuation_size] = True
            # Note that the continuation of
            # d = {
            #       'a': 'b'
            #            'c'
            # }
            # is handled by the special-casing for hanging continued string indents.
            return _ContinuedIndent(HANGING_DICT_VALUE, bracket, position, paren_align, next_align)
        return _ContinuedIndent(
            HANGING,
            bracket,
            position,
            _Offsets(indentation, indentation + self._continuation_size),
            _Offsets(indentation + self._continuation_size))

    def _continuation_inside_bracket(self, bracket, pos):
        """Extracts indentation information for a continued indent."""
        indentation = _get_indent_length(self._tokens.line(pos))
        token_start = self._tokens.start_col(pos)
        next_token_start = self._tokens.start_col(pos + 1)
        if self._is_block_opener and next_token_start - indentation == self._block_indent_size:
            return _ContinuedIndent(
                CONTINUED_BLOCK,
                bracket,
                pos,
                _Offsets(token_start),
                _BeforeBlockOffsets(next_token_start, next_token_start + self._continuation_size))
        return _ContinuedIndent(
            CONTINUED,
            bracket,
            pos,
            _Offsets(token_start),
            _Offsets(next_token_start))

    def pop_token(self):
        self._cont_stack.pop()

    def push_token(self, token, position):
        """Pushes a new token for continued indentation on the stack.

        Tokens that can modify continued indentation offsets are:
          * opening brackets
          * 'lambda'
          * : inside dictionaries

        push_token relies on the caller to filter out those
        interesting tokens.

        :param int token: The concrete token
        :param int position: The position of the token in the stream.
        """
        if _token_followed_by_eol(self._tokens, position):
            self._cont_stack.append(
                self._hanging_indent_after_bracket(token, position))
        else:
            self._cont_stack.append(
                self._continuation_inside_bracket(token, position))


class FormatChecker(BaseTokenChecker):
    """checks for :
    * unauthorized constructions
    * strict indentation
    * line length
    """

    __implements__ = (ITokenChecker, IAstroidChecker, IRawChecker)

    # configuration section name
    name = 'format'
    # messages
    msgs = MSGS
    # configuration options
    # for available dict keys/values see the optik parser 'add_option' method
    options = (('max-line-length',
                {'default' : 100, 'type' : "int", 'metavar' : '<int>',
                 'help' : 'Maximum number of characters on a single line.'}),
               ('ignore-long-lines',
                {'type': 'regexp', 'metavar': '<regexp>',
                 'default': r'^\s*(# )?<?https?://\S+>?$',
                 'help': ('Regexp for a line that is allowed to be longer than '
                          'the limit.')}),
               ('single-line-if-stmt',
                {'default': False, 'type' : 'yn', 'metavar' : '<y_or_n>',
                 'help' : ('Allow the body of an if to be on the same '
                           'line as the test if there is no else.')}),
               ('single-line-class-stmt',
                {'default': False, 'type' : 'yn', 'metavar' : '<y_or_n>',
                 'help' : ('Allow the body of a class to be on the same '
                           'line as the declaration if body contains '
                           'single statement.')}),
               ('no-space-check',
                {'default': ','.join(_DEFAULT_NO_SPACE_CHECK_CHOICES),
                 'metavar': ','.join(_NO_SPACE_CHECK_CHOICES),
                 'type': 'multiple_choice',
                 'choices': _NO_SPACE_CHECK_CHOICES,
                 'help': ('List of optional constructs for which whitespace '
                          'checking is disabled. '
                          '`'+ _DICT_SEPARATOR + '` is used to allow tabulation '
                          'in dicts, etc.: {1  : 1,\\n222: 2}. '
                          '`'+ _TRAILING_COMMA + '` allows a space between comma '
                          'and closing bracket: (a, ). '
                          '`'+ _EMPTY_LINE + '` allows space-only lines.')}),
               ('max-module-lines',
                {'default' : 1000, 'type' : 'int', 'metavar' : '<int>',
                 'help': 'Maximum number of lines in a module'}
               ),
               ('indent-string',
                {'default' : '    ', 'type' : "non_empty_string", 'metavar' : '<string>',
                 'help' : 'String used as indentation unit. This is usually '
                          '"    " (4 spaces) or "\\t" (1 tab).'}),
               ('indent-after-paren',
                {'type': 'int', 'metavar': '<int>', 'default': 4,
                 'help': 'Number of spaces of indent required inside a hanging '
                         ' or continued line.'}),
               ('expected-line-ending-format',
                {'type': 'choice', 'metavar': '<empty or LF or CRLF>', 'default': '',
                 'choices': ['', 'LF', 'CRLF'],
                 'help': ('Expected format of line ending, '
                          'e.g. empty (any line ending), LF or CRLF.')}),
              )

    def __init__(self, linter=None):
        BaseTokenChecker.__init__(self, linter)
        self._lines = None
        self._visited_lines = None
        self._bracket_stack = [None]

    def _pop_token(self):
        self._bracket_stack.pop()
        self._current_line.pop_token()

    def _push_token(self, token, idx):
        self._bracket_stack.append(token)
        self._current_line.push_token(token, idx)

    def new_line(self, tokens, line_end, line_start):
        """a new line has been encountered, process it if necessary"""
        if _last_token_on_line_is(tokens, line_end, ';'):
            self.add_message('unnecessary-semicolon', line=tokens.start_line(line_end))

        line_num = tokens.start_line(line_start)
        line = tokens.line(line_start)
        if tokens.type(line_start) not in _JUNK_TOKENS:
            self._lines[line_num] = line.split('\n')[0]
        self.check_lines(line, line_num)

    def process_module(self, module):
        self._keywords_with_parens = set()
        if 'print_function' in module.future_imports:
            self._keywords_with_parens.add('print')

    def _check_keyword_parentheses(self, tokens, start):
        """Check that there are not unnecessary parens after a keyword.

        Parens are unnecessary if there is exactly one balanced outer pair on a
        line, and it is followed by a colon, and contains no commas (i.e. is not a
        tuple).

        Args:
        tokens: list of Tokens; the entire list of Tokens.
        start: int; the position of the keyword in the token list.
        """
        # If the next token is not a paren, we're fine.
        if self._inside_brackets(':') and tokens[start][1] == 'for':
            self._pop_token()
        if tokens[start+1][1] != '(':
            return

        found_and_or = False
        depth = 0
        keyword_token = tokens[start][1]
        line_num = tokens[start][2][0]

        for i in range(start, len(tokens) - 1):
            token = tokens[i]

            # If we hit a newline, then assume any parens were for continuation.
            if token[0] == tokenize.NL:
                return

            if token[1] == '(':
                depth += 1
            elif token[1] == ')':
                depth -= 1
                if depth:
                    continue
                # ')' can't happen after if (foo), since it would be a syntax error.
                if (tokens[i+1][1] in (':', ')', ']', '}', 'in') or
                        tokens[i+1][0] in (tokenize.NEWLINE,
                                           tokenize.ENDMARKER,
                                           tokenize.COMMENT)):
                    # The empty tuple () is always accepted.
                    if i == start + 2:
                        return
                    if keyword_token == 'not':
                        if not found_and_or:
                            self.add_message('superfluous-parens', line=line_num,
                                             args=keyword_token)
                    elif keyword_token in ('return', 'yield'):
                        self.add_message('superfluous-parens', line=line_num,
                                         args=keyword_token)
                    elif keyword_token not in self._keywords_with_parens:
                        if not (tokens[i+1][1] == 'in' and found_and_or):
                            self.add_message('superfluous-parens', line=line_num,
                                             args=keyword_token)
                return
            elif depth == 1:
                # This is a tuple, which is always acceptable.
                if token[1] == ',':
                    return
                # 'and' and 'or' are the only boolean operators with lower precedence
                # than 'not', so parens are only required when they are found.
                elif token[1] in ('and', 'or'):
                    found_and_or = True
                # A yield inside an expression must always be in parentheses,
                # quit early without error.
                elif token[1] == 'yield':
                    return
                # A generator expression always has a 'for' token in it, and
                # the 'for' token is only legal inside parens when it is in a
                # generator expression.  The parens are necessary here, so bail
                # without an error.
                elif token[1] == 'for':
                    return

    def _opening_bracket(self, tokens, i):
        self._push_token(tokens[i][1], i)
        # Special case: ignore slices
        if tokens[i][1] == '[' and tokens[i+1][1] == ':':
            return

        if (i > 0 and (tokens[i-1][0] == tokenize.NAME and
                       not (keyword.iskeyword(tokens[i-1][1]))
                       or tokens[i-1][1] in _CLOSING_BRACKETS)):
            self._check_space(tokens, i, (_MUST_NOT, _MUST_NOT))
        else:
            self._check_space(tokens, i, (_IGNORE, _MUST_NOT))

    def _closing_bracket(self, tokens, i):
        if self._inside_brackets(':'):
            self._pop_token()
        self._pop_token()
        # Special case: ignore slices
        if tokens[i-1][1] == ':' and tokens[i][1] == ']':
            return
        policy_before = _MUST_NOT
        if tokens[i][1] in _CLOSING_BRACKETS and tokens[i-1][1] == ',':
            if _TRAILING_COMMA in self.config.no_space_check:
                policy_before = _IGNORE

        self._check_space(tokens, i, (policy_before, _IGNORE))

    def _has_valid_type_annotation(self, tokens, i):
        """Extended check of PEP-484 type hint presence"""
        if not self._inside_brackets('('):
            return False
        bracket_level = 0
        for token in tokens[i-1::-1]:
            if token[1] == ':':
                return True
            if token[1] == '(':
                return False
            if token[1] == ']':
                bracket_level += 1
            elif token[1] == '[':
                bracket_level -= 1
            elif token[1] == ',':
                if not bracket_level:
                    return False
            elif token[0] not in (tokenize.NAME, tokenize.STRING):
                return False
        return False

    def _check_equals_spacing(self, tokens, i):
        """Check the spacing of a single equals sign."""
        if self._has_valid_type_annotation(tokens, i):
            self._check_space(tokens, i, (_MUST, _MUST))
        elif self._inside_brackets('(') or self._inside_brackets('lambda'):
            self._check_space(tokens, i, (_MUST_NOT, _MUST_NOT))
        else:
            self._check_space(tokens, i, (_MUST, _MUST))

    def _open_lambda(self, tokens, i): # pylint:disable=unused-argument
        self._push_token('lambda', i)

    def _handle_colon(self, tokens, i):
        # Special case: ignore slices
        if self._inside_brackets('['):
            return
        if (self._inside_brackets('{') and
                _DICT_SEPARATOR in self.config.no_space_check):
            policy = (_IGNORE, _IGNORE)
        else:
            policy = (_MUST_NOT, _MUST)
        self._check_space(tokens, i, policy)

        if self._inside_brackets('lambda'):
            self._pop_token()
        elif self._inside_brackets('{'):
            self._push_token(':', i)

    def _handle_comma(self, tokens, i):
        # Only require a following whitespace if this is
        # not a hanging comma before a closing bracket.
        if tokens[i+1][1] in _CLOSING_BRACKETS:
            self._check_space(tokens, i, (_MUST_NOT, _IGNORE))
        else:
            self._check_space(tokens, i, (_MUST_NOT, _MUST))
        if self._inside_brackets(':'):
            self._pop_token()

    def _check_surrounded_by_space(self, tokens, i):
        """Check that a binary operator is surrounded by exactly one space."""
        self._check_space(tokens, i, (_MUST, _MUST))

    def _check_space(self, tokens, i, policies):
        def _policy_string(policy):
            if policy == _MUST:
                return 'Exactly one', 'required'
            return 'No', 'allowed'

        def _name_construct(token):
            if token[1] == ',':
                return 'comma'
            if token[1] == ':':
                return ':'
            if token[1] in '()[]{}':
                return 'bracket'
            if token[1] in ('<', '>', '<=', '>=', '!=', '=='):
                return 'comparison'
            if self._inside_brackets('('):
                return 'keyword argument assignment'
            return 'assignment'

        good_space = [True, True]
        token = tokens[i]
        pairs = [(tokens[i-1], token), (token, tokens[i+1])]

        for other_idx, (policy, token_pair) in enumerate(zip(policies, pairs)):
            if token_pair[other_idx][0] in _EOL or policy == _IGNORE:
                continue

            distance = _column_distance(*token_pair)
            if distance is None:
                continue
            good_space[other_idx] = (
                (policy == _MUST and distance == 1) or
                (policy == _MUST_NOT and distance == 0))

        warnings = []
        if not any(good_space) and policies[0] == policies[1]:
            warnings.append((policies[0], 'around'))
        else:
            for ok, policy, position in zip(good_space, policies, ('before', 'after')):
                if not ok:
                    warnings.append((policy, position))
        for policy, position in warnings:
            construct = _name_construct(token)
            count, state = _policy_string(policy)
            self.add_message('bad-whitespace', line=token[2][0],
                             args=(count, state, position, construct,
                                   _underline_token(token)))

    def _inside_brackets(self, left):
        return self._bracket_stack[-1] == left

    def _prepare_token_dispatcher(self):
        raw = [
            (_KEYWORD_TOKENS,
             self._check_keyword_parentheses),

            (_OPENING_BRACKETS, self._opening_bracket),

            (_CLOSING_BRACKETS, self._closing_bracket),

            (['='], self._check_equals_spacing),

            (_SPACED_OPERATORS, self._check_surrounded_by_space),

            ([','], self._handle_comma),

            ([':'], self._handle_colon),

            (['lambda'], self._open_lambda),

            ]

        dispatch = {}
        for tokens, handler in raw:
            for token in tokens:
                dispatch[token] = handler
        return dispatch

    def process_tokens(self, tokens):
        """process tokens and search for :

         _ non strict indentation (i.e. not always using the <indent> parameter as
           indent unit)
         _ too long lines (i.e. longer than <max_chars>)
         _ optionally bad construct (if given, bad_construct must be a compiled
           regular expression).
        """
        self._bracket_stack = [None]
        indents = [0]
        check_equal = False
        line_num = 0
        self._lines = {}
        self._visited_lines = {}
        token_handlers = self._prepare_token_dispatcher()
        self._last_line_ending = None
        last_blank_line_num = 0

        self._current_line = ContinuedLineState(tokens, self.config)
        for idx, (tok_type, token, start, _, line) in enumerate(tokens):
            if start[0] != line_num:
                line_num = start[0]
                # A tokenizer oddity: if an indented line contains a multi-line
                # docstring, the line member of the INDENT token does not contain
                # the full line; therefore we check the next token on the line.
                if tok_type == tokenize.INDENT:
                    self.new_line(TokenWrapper(tokens), idx-1, idx+1)
                else:
                    self.new_line(TokenWrapper(tokens), idx-1, idx)

            if tok_type == tokenize.NEWLINE:
                # a program statement, or ENDMARKER, will eventually follow,
                # after some (possibly empty) run of tokens of the form
                #     (NL | COMMENT)* (INDENT | DEDENT+)?
                # If an INDENT appears, setting check_equal is wrong, and will
                # be undone when we see the INDENT.
                check_equal = True
                self._process_retained_warnings(TokenWrapper(tokens), idx)
                self._current_line.next_logical_line()
                self._check_line_ending(token, line_num)
            elif tok_type == tokenize.INDENT:
                check_equal = False
                self.check_indent_level(token, indents[-1]+1, line_num)
                indents.append(indents[-1]+1)
            elif tok_type == tokenize.DEDENT:
                # there's nothing we need to check here!  what's important is
                # that when the run of DEDENTs ends, the indentation of the
                # program statement (or ENDMARKER) that triggered the run is
                # equal to what's left at the top of the indents stack
                check_equal = True
                if len(indents) > 1:
                    del indents[-1]
            elif tok_type == tokenize.NL:
                if not line.strip('\r\n'):
                    last_blank_line_num = line_num
                self._check_continued_indentation(TokenWrapper(tokens), idx+1)
                self._current_line.next_physical_line()
            elif tok_type != tokenize.COMMENT:
                self._current_line.handle_line_start(idx)
                # This is the first concrete token following a NEWLINE, so it
                # must be the first token of the next program statement, or an
                # ENDMARKER; the "line" argument exposes the leading whitespace
                # for this statement; in the case of ENDMARKER, line is an empty
                # string, so will properly match the empty string with which the
                # "indents" stack was seeded
                if check_equal:
                    check_equal = False
                    self.check_indent_level(line, indents[-1], line_num)

            if tok_type == tokenize.NUMBER and token.endswith('l'):
                self.add_message('lowercase-l-suffix', line=line_num)

            try:
                handler = token_handlers[token]
            except KeyError:
                pass
            else:
                handler(tokens, idx)

        line_num -= 1 # to be ok with "wc -l"
        if line_num > self.config.max_module_lines:
            # Get the line where the too-many-lines (or its message id)
            # was disabled or default to 1.
            symbol = self.linter.msgs_store.check_message_id('too-many-lines')
            names = (symbol.msgid, 'too-many-lines')
            line = next(filter(None,
                               map(self.linter._pragma_lineno.get, names)), 1)
            self.add_message('too-many-lines',
                             args=(line_num, self.config.max_module_lines),
                             line=line)

        # See if there are any trailing lines.  Do not complain about empty
        # files like __init__.py markers.
        if line_num == last_blank_line_num and line_num > 0:
            self.add_message('trailing-newlines', line=line_num)

    def _check_line_ending(self, line_ending, line_num):
        # check if line endings are mixed
        if self._last_line_ending is not None:
            if line_ending != self._last_line_ending:
                self.add_message('mixed-line-endings', line=line_num)

        self._last_line_ending = line_ending

        # check if line ending is as expected
        expected = self.config.expected_line_ending_format
        if expected:
            # reduce multiple \n\n\n\n to one \n
            line_ending = reduce(lambda x, y: x + y if x != y else x, line_ending, "")
            line_ending = 'LF' if line_ending == '\n' else 'CRLF'
            if line_ending != expected:
                self.add_message('unexpected-line-ending-format', args=(line_ending, expected),
                                 line=line_num)

    def _process_retained_warnings(self, tokens, current_pos):
        single_line_block_stmt = not _last_token_on_line_is(tokens, current_pos, ':')

        for indent_pos, state, offsets in self._current_line.retained_warnings:
            block_type = offsets[tokens.start_col(indent_pos)]
            hints = dict((k, v) for k, v in six.iteritems(offsets)
                         if v != block_type)
            if single_line_block_stmt and block_type == WITH_BODY:
                self._add_continuation_message(state, hints, tokens, indent_pos)
            elif not single_line_block_stmt and block_type == SINGLE_LINE:
                self._add_continuation_message(state, hints, tokens, indent_pos)

    def _check_continued_indentation(self, tokens, next_idx):
        def same_token_around_nl(token_type):
            return (tokens.type(next_idx) == token_type and
                    tokens.type(next_idx-2) == token_type)

        # Do not issue any warnings if the next line is empty.
        if not self._current_line.has_content or tokens.type(next_idx) == tokenize.NL:
            return

        state, valid_offsets = self._current_line.get_valid_offsets(next_idx)
        # Special handling for hanging comments and strings. If the last line ended
        # with a comment (string) and the new line contains only a comment, the line
        # may also be indented to the start of the previous token.
        if same_token_around_nl(tokenize.COMMENT) or same_token_around_nl(tokenize.STRING):
            valid_offsets[tokens.start_col(next_idx-2)] = True

        # We can only decide if the indentation of a continued line before opening
        # a new block is valid once we know of the body of the block is on the
        # same line as the block opener. Since the token processing is single-pass,
        # emitting those warnings is delayed until the block opener is processed.
        if (state.context_type in (HANGING_BLOCK, CONTINUED_BLOCK)
                and tokens.start_col(next_idx) in valid_offsets):
            self._current_line.add_block_warning(next_idx, state, valid_offsets)
        elif tokens.start_col(next_idx) not in valid_offsets:

            self._add_continuation_message(state, valid_offsets, tokens, next_idx)

    def _add_continuation_message(self, state, offsets, tokens, position):
        readable_type, readable_position = _CONTINUATION_MSG_PARTS[state.context_type]
        hint_line, delta_message = _get_indent_hint_line(offsets, tokens.start_col(position))
        self.add_message(
            'bad-continuation',
            line=tokens.start_line(position),
            args=(readable_type, readable_position, delta_message,
                  tokens.line(position), hint_line))

    @check_messages('multiple-statements')
    def visit_default(self, node):
        """check the node line number and check it if not yet done"""
        if not node.is_statement:
            return
        if not node.root().pure_python:
            return # XXX block visit of child nodes
        prev_sibl = node.previous_sibling()
        if prev_sibl is not None:
            prev_line = prev_sibl.fromlineno
        else:
            # The line on which a finally: occurs in a try/finally
            # is not directly represented in the AST. We infer it
            # by taking the last line of the body and adding 1, which
            # should be the line of finally:
            if (isinstance(node.parent, nodes.TryFinally)
                    and node in node.parent.finalbody):
                prev_line = node.parent.body[0].tolineno + 1
            else:
                prev_line = node.parent.statement().fromlineno
        line = node.fromlineno
        assert line, node
        if prev_line == line and self._visited_lines.get(line) != 2:
            self._check_multi_statement_line(node, line)
            return
        if line in self._visited_lines:
            return
        try:
            tolineno = node.blockstart_tolineno
        except AttributeError:
            tolineno = node.tolineno
        assert tolineno, node
        lines = []
        for line in range(line, tolineno + 1):
            self._visited_lines[line] = 1
            try:
                lines.append(self._lines[line].rstrip())
            except KeyError:
                lines.append('')

    def _check_multi_statement_line(self, node, line):
        """Check for lines containing multiple statements."""
        # Do not warn about multiple nested context managers
        # in with statements.
        if isinstance(node, nodes.With):
            return
        # For try... except... finally..., the two nodes
        # appear to be on the same line due to how the AST is built.
        if (isinstance(node, nodes.TryExcept) and
                isinstance(node.parent, nodes.TryFinally)):
            return
        if (isinstance(node.parent, nodes.If) and not node.parent.orelse
                and self.config.single_line_if_stmt):
            return
        if (isinstance(node.parent, nodes.ClassDef) and len(node.parent.body) == 1
                and self.config.single_line_class_stmt):
            return
        self.add_message('multiple-statements', node=node)
        self._visited_lines[line] = 2

    def check_lines(self, lines, i):
        """check lines have less than a maximum number of characters
        """
        max_chars = self.config.max_line_length
        ignore_long_line = self.config.ignore_long_lines

        def check_line(line, i):
            if not line.endswith('\n'):
                self.add_message('missing-final-newline', line=i)
            else:
                # exclude \f (formfeed) from the rstrip
                stripped_line = line.rstrip('\t\n\r\v ')
                if not stripped_line and _EMPTY_LINE in self.config.no_space_check:
                    # allow empty lines
                    pass
                elif line[len(stripped_line):] not in ('\n', '\r\n'):
                    self.add_message('trailing-whitespace', line=i)
                # Don't count excess whitespace in the line length.
                line = stripped_line
            mobj = OPTION_RGX.search(line)
            if mobj and mobj.group(1).split('=', 1)[0].strip() == 'disable':
                line = line.split('#')[0].rstrip()

            if len(line) > max_chars and not ignore_long_line.search(line):
                self.add_message('line-too-long', line=i, args=(len(line), max_chars))
            return i + 1

        unsplit_ends = {
            u'\v',
            u'\x0b',
            u'\f',
            u'\x0c',
            u'\x1c',
            u'\x1d',
            u'\x1e',
            u'\x85',
            u'\u2028',
            u'\u2029'
        }
        unsplit = []
        for line in lines.splitlines(True):
            if line[-1] in unsplit_ends:
                unsplit.append(line)
                continue

            if unsplit:
                unsplit.append(line)
                line = ''.join(unsplit)
                unsplit = []

            i = check_line(line, i)

        if unsplit:
            check_line(''.join(unsplit), i)

    def check_indent_level(self, string, expected, line_num):
        """return the indent level of the string
        """
        indent = self.config.indent_string
        if indent == '\\t': # \t is not interpreted in the configuration file
            indent = '\t'
        level = 0
        unit_size = len(indent)
        while string[:unit_size] == indent:
            string = string[unit_size:]
            level += 1
        suppl = ''
        while string and string[0] in ' \t':
            if string[0] != indent[0]:
                if string[0] == '\t':
                    args = ('tab', 'space')
                else:
                    args = ('space', 'tab')
                self.add_message('mixed-indentation', args=args, line=line_num)
                return level
            suppl += string[0]
            string = string[1:]
        if level != expected or suppl:
            i_type = 'spaces'
            if indent[0] == '\t':
                i_type = 'tabs'
            self.add_message('bad-indentation', line=line_num,
                             args=(level * unit_size + len(suppl), i_type,
                                   expected * unit_size))


def register(linter):
    """required method to auto register this checker """
    linter.register_checker(FormatChecker(linter))

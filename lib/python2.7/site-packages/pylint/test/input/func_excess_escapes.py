# pylint:disable=W0105, W0511, misplaced-comparison-constant
"""Stray backslash escapes may be missing a raw-string prefix."""

__revision__ = '$Id$'

# Bad escape sequences, which probably don't do what you expect.
A = "\[\]\\"
assert '\/' == '\\/'
ESCAPE_BACKSLASH = '\`'

# Valid escape sequences.
NEWLINE = "\n"
OLD_ESCAPES = '\a\b\f\n\t\r\v'
HEX = '\xad\x0a\x0d'
FALSE_OCTAL = '\o123\o000'  # Not octal in Python
OCTAL = '\123\000'
NOT_OCTAL = '\888\999'
NUL = '\0'
UNICODE = u'\u1234'
HIGH_UNICODE = u'\U0000abcd'
QUOTES = '\'\"'
LITERAL_NEWLINE = '\
'
ESCAPE_UNICODE = "\\\\n"

# Bad docstring
"""Even in a docstring

You shouldn't have ambiguous text like: C:\Program Files\alpha
"""

# pylint:disable=W0105, W0511
"""Test for backslash escapes in byte vs unicode strings"""

# Would be valid in Unicode, but probably not what you want otherwise
BAD_UNICODE = b'\u0042'  # [anomalous-unicode-escape-in-string]
BAD_LONG_UNICODE = b'\U00000042'  # [anomalous-unicode-escape-in-string]
# +1:[anomalous-unicode-escape-in-string]
BAD_NAMED_UNICODE = b'\N{GREEK SMALL LETTER ALPHA}'

GOOD_UNICODE = u'\u0042'
GOOD_LONG_UNICODE = u'\U00000042'
GOOD_NAMED_UNICODE = u'\N{GREEK SMALL LETTER ALPHA}'


# Valid raw strings
RAW_BACKSLASHES = r'raw'

# In a comment you can have whatever you want: \ \\ \n \m
# even things that look like bad strings: "C:\Program Files"

"""Unicode literals in Python 2.*"""
from __future__ import unicode_literals


BAD_STRING = b'\u1234'  # >= 2.7.4:[anomalous-unicode-escape-in-string]
GOOD_STRING = '\u1234'

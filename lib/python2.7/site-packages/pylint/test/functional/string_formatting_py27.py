"""test for Python 2 string formatting error
"""
from __future__ import unicode_literals
# pylint: disable=line-too-long
__revision__ = 1

def pprint_bad():
    """Test string format """
    "{{}}".format(1) # [too-many-format-args]
    "{} {".format() # [bad-format-string]
    "{} }".format() # [bad-format-string]
    "{0} {}".format(1, 2) # [format-combined-specification]
    # +1: [missing-format-argument-key, unused-format-string-argument]
    "{a} {b}".format(a=1, c=2)
    "{} {a}".format(1, 2) # [missing-format-argument-key]
    "{} {}".format(1) # [too-few-format-args]
    "{} {}".format(1, 2, 3) # [too-many-format-args]
    # +1: [missing-format-argument-key,missing-format-argument-key,missing-format-argument-key]
    "{a} {b} {c}".format()
    "{} {}".format(a=1, b=2) # [too-few-format-args]
    # +1: [missing-format-argument-key, missing-format-argument-key]
    "{a} {b}".format(1, 2)

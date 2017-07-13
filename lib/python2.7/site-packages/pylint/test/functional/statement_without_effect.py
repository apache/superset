"""Test for statements without effects."""
# pylint: disable=too-few-public-methods

# +1:[pointless-string-statement]
"""inline doc string should use a separated message"""

__revision__ = ''

__revision__  # [pointless-statement]

__revision__ <= 1  # [pointless-statement]

__revision__.lower()

[i for i in __revision__]  # [pointless-statement]

# +1:[pointless-string-statement]
"""inline doc string should use a separated message"""


__revision__.lower();  # [unnecessary-semicolon]

list() and tuple()  # [expression-not-assigned]

def to_be():
    """return 42"""
    return "42"

ANSWER = to_be() # ok
ANSWER == to_be()  # [expression-not-assigned]

to_be() or not to_be()  # [expression-not-assigned]
to_be().title  # [expression-not-assigned]

GOOD_ATTRIBUTE_DOCSTRING = 42
"""Module level attribute docstring is fine. """

class ClassLevelAttributeTest(object):
    """ test attribute docstrings. """

    good_attribute_docstring = 24
    """ class level attribute docstring is fine either. """
    second_good_attribute_docstring = 42
    # Comments are good.

    # empty lines are good, too.
    """ Still a valid class level attribute docstring. """

    def __init__(self):
        self.attr = 42
        """ Good attribute docstring """
        attr = 24
        """ Still a good __init__ level attribute docstring. """
        val = 0
        for val in range(42):
            val += attr
        # +1:[pointless-string-statement]
        """ Invalid attribute docstring """
        self.val = val

    def test(self):
        """ invalid attribute docstrings here. """
        self.val = 42
        # +1:[pointless-string-statement]
        """ this is an invalid attribute docstring. """

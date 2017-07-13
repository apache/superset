"""Contains both normal error messages and Python3 porting error messages."""
# pylint: disable=too-few-public-methods

raise Exception, 1  # Error emitted here with the Python 3 checker.


class Test(object):
    """dummy"""

    def __init__(self):
        return 42

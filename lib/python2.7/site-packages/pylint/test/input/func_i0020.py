"""Test for reporting of suppressed messages."""

__revision__ = 0

def suppressed():
    """A function with an unused variable."""
    # pylint: disable=W0612
    var = 0

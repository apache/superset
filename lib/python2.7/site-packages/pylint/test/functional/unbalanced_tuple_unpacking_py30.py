""" Test that using starred nodes in unpacking
does not trigger a false positive on Python 3.
"""

__revision__ = 1

def test():
    """ Test that starred expressions don't give false positives. """
    first, second, *last = (1, 2, 3, 4)
    *last, = (1, 2)
    return (first, second, last)

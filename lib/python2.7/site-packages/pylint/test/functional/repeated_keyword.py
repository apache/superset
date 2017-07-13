"""Check that a keyword is not repeated in a function call

This is somehow related to redundant-keyword, but it's not the same.
"""

# pylint: disable=missing-docstring, invalid-name

def test(a, b):
    return a, b

test(1, 24)
test(1, b=24, **{})
test(1, b=24, **{'b': 24}) # [repeated-keyword]

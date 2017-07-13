"""Test namedtuple attributes.

Regression test for:
https://bitbucket.org/logilab/pylint/issue/93/pylint-crashes-on-namedtuple-attribute
"""
from __future__ import absolute_import, print_function
from collections import namedtuple

__revision__ = None

Thing = namedtuple('Thing', ())

Fantastic = namedtuple('Fantastic', ['foo'])

def test():
    """Test member access in named tuples."""
    print(Thing.x)  # [no-member]
    fan = Fantastic(1)
    print(fan.foo)
    # Should not raise protected-access.
    fan2 = fan._replace(foo=2)
    print(fan2.foo)

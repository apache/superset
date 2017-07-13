"""Test the generated-members config option."""
# pylint: disable=pointless-statement, invalid-name
from __future__ import print_function
from astroid import node_classes
from pylint import checkers

class Klass(object):
    """A class with a generated member."""

print(Klass().DoesNotExist)
print(Klass().aBC_set1)
node_classes.Tuple.does.not_.exist
checkers.base.doesnotexist()

session = Klass()
SESSION = Klass()
session.rollback()
SESSION.rollback()

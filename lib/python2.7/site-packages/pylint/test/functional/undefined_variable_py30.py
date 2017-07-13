"""Test warnings about access to undefined variables
for various Python 3 constructs. """
# pylint: disable=too-few-public-methods, no-init, no-self-use
# pylint: disable=wrong-import-position, invalid-metaclass
class Undefined:
    """ test various annotation problems. """

    def test(self)->Undefined: # [undefined-variable]
        """ used Undefined, which is Undefined in this scope. """

    Undefined = True

    def test1(self)->Undefined:
        """ This Undefined exists at local scope. """

    def test2(self):
        """ This should not emit. """
        def func()->Undefined:
            """ empty """
            return
        return func


class Undefined1:
    """ Other annotation problems. """

    Undef = 42
    ABC = 42

    class InnerScope:
        """ Test inner scope definition. """

        def test_undefined(self)->Undef: # [undefined-variable]
            """ Looking at a higher scope is impossible. """

        def test1(self)->ABC: # [undefined-variable]
            """ Triggers undefined-variable. """


class FalsePositive342(object):
    # pylint: disable=line-too-long
    """ Fix some false positives found in
    https://bitbucket.org/logilab/pylint/issue/342/spurious-undefined-variable-for-class
    """

    top = 42

    def test_good(self, bac: top):
        """ top is defined at this moment. """

    def test_bad(self, bac: trop): # [undefined-variable]
        """ trop is undefined at this moment. """

    def test_bad1(self, *args: trop1): # [undefined-variable]
        """ trop1 is undefined at this moment. """

    def test_bad2(self, **bac: trop2): # [undefined-variable]
        """ trop2 is undefined at this moment. """

from abc import ABCMeta

class Bad(metaclass=ABCMet): # [undefined-variable]
    """ Notice the typo """

class SecondBad(metaclass=ab.ABCMeta): # [undefined-variable]
    """ Notice the `ab` module. """

class Good(metaclass=int):
    """ int is not a proper metaclass, but it is defined. """

class SecondGood(metaclass=Good):
    """ empty """

class ThirdGood(metaclass=ABCMeta):
    """ empty """

class FourthGood(ThirdGood):
    """ This should not trigger anything. """

# The following used to raise used-before-assignment
# pylint: disable=missing-docstring, multiple-statements
def used_before_assignment(*, arg): return arg + 1

# pylint: disable=too-few-public-methods,import-error, no-absolute-import,missing-docstring
# pylint: disable=useless-super-delegation,wrong-import-position,invalid-name, wrong-import-order

from unknown import Missing

class Aaaa:  # <3.0:[old-style-class]
    """old style"""
    def hop(self):  # <3.0:[super-on-old-class]
        """hop"""
        super(Aaaa, self).hop() # >=3.0:[no-member]

    def __init__(self):  # <3.0:[super-on-old-class]
        super(Aaaa, self).__init__()

class NewAaaa(object):
    """old style"""
    def hop(self):
        """hop"""
        super(NewAaaa, self).hop() # [no-member]

    def __init__(self):
        super(Aaaa, self).__init__()  # [bad-super-call]

class Py3kAaaa(NewAaaa):
    """new style"""
    def __init__(self):
        super().__init__()  # <3.0:[missing-super-argument]

class Py3kWrongSuper(Py3kAaaa):
    """new style"""
    def __init__(self):
        super(NewAaaa, self).__init__()  # [bad-super-call]

class WrongNameRegression(Py3kAaaa):
    """ test a regression with the message """
    def __init__(self):
        super(Missing, self).__init__()  # [bad-super-call]

class Getattr(object):
    """ crash """
    name = NewAaaa

class CrashSuper(object):
    """ test a crash with this checker """
    def __init__(self):
        super(Getattr.name, self).__init__()  # [bad-super-call]

class Empty(object):
    """Just an empty class."""

class SuperDifferentScope(object):
    """Don'emit bad-super-call when the super call is in another scope.
    For reference, see https://bitbucket.org/logilab/pylint/issue/403.
    """
    @staticmethod
    def test():
        """Test that a bad-super-call is not emitted for this case."""
        class FalsePositive(Empty):
            """The following super is in another scope than `test`."""
            def __init__(self, arg):
                super(FalsePositive, self).__init__(arg)
        super(object, 1).__init__() # [bad-super-call]


class UnknownBases(Missing):
    """Don't emit if we don't know all the bases."""
    def __init__(self):
        super(UnknownBases, self).__init__()
        super(UnknownBases, self).test()
        super(Missing, self).test() # [bad-super-call]


# Test that we are detecting proper super errors.

class BaseClass(object):

    not_a_method = 42

    def function(self, param):
        return param + self.not_a_method

    def __getattr__(self, attr):
        return attr


class InvalidSuperChecks(BaseClass):

    def __init__(self):
        super(InvalidSuperChecks, self).not_a_method() # [not-callable]
        super(InvalidSuperChecks, self).attribute_error() # [no-member]
        super(InvalidSuperChecks, self).function(42)
        super(InvalidSuperChecks, self).function() # [no-value-for-parameter]
        super(InvalidSuperChecks, self).function(42, 24, 24) # [too-many-function-args]
        # +1: [unexpected-keyword-arg,no-value-for-parameter]
        super(InvalidSuperChecks, self).function(lala=42)
        # Even though BaseClass has a __getattr__, that won't
        # be called.
        super(InvalidSuperChecks, self).attribute_error() # [no-member]



# Regression for PyCQA/pylint/issues/773
import subprocess

# The problem was related to astroid not filtering statements
# at scope level properly, basically not doing strong updates.
try:
    TimeoutExpired = subprocess.TimeoutExpired
except AttributeError:
    class TimeoutExpired(subprocess.CalledProcessError):
        def __init__(self):
            returncode = -1
            self.timeout = -1
            super(TimeoutExpired, self).__init__(returncode)


class SuperWithType(object):
    """type(self) may lead to recursion loop in derived classes"""
    def __init__(self):
        super(type(self), self).__init__() # [bad-super-call]

class SuperWithSelfClass(object):
    """self.__class__ may lead to recursion loop in derived classes"""
    def __init__(self):
        super(self.__class__, self).__init__() # [bad-super-call]

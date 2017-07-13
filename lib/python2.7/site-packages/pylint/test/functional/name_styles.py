"""Test for the invalid-name warning."""
# pylint: disable=no-absolute-import
from __future__ import print_function
import abc
import collections

GOOD_CONST_NAME = ''
bad_const_name = 0  # [invalid-name]


def BADFUNCTION_name():  # [invalid-name]
    """Bad function name."""
    BAD_LOCAL_VAR = 1  # [invalid-name]
    print(BAD_LOCAL_VAR)


def func_bad_argname(NOT_GOOD):  # [invalid-name]
    """Function with a badly named argument."""
    return NOT_GOOD


def no_nested_args(arg1, arg21, arg22):
    """Well-formed function."""
    print(arg1, arg21, arg22)


class bad_class_name(object):  # [invalid-name]
    """Class with a bad name."""


class CorrectClassName(object):
    """Class with a good name."""

    def __init__(self):
        self._good_private_name = 10
        self.__good_real_private_name = 11
        self.good_attribute_name = 12
        self._Bad_AtTR_name = None  # [invalid-name]
        self.Bad_PUBLIC_name = None  # [invalid-name]

    zz = 'Bad Class Attribute'  # [invalid-name]
    GOOD_CLASS_ATTR = 'Good Class Attribute'

    def BadMethodName(self):  # [invalid-name]
        """A Method with a bad name."""

    def good_method_name(self):
        """A method with a good name."""

    def __DunDER_IS_not_free_for_all__(self):  # [invalid-name]
        """Another badly named method."""


class DerivedFromCorrect(CorrectClassName):
    """A derived class with an invalid inherited members.

    Derived attributes and methods with invalid names do not trigger warnings.
    """
    zz = 'Now a good class attribute'

    def __init__(self):
        super(DerivedFromCorrect, self).__init__()
        self._Bad_AtTR_name = None  # Ignored

    def BadMethodName(self):
        """Ignored since the method is in the interface."""


V = [WHAT_Ever_inListComp for WHAT_Ever_inListComp in GOOD_CONST_NAME]

def class_builder():
    """Function returning a class object."""

    class EmbeddedClass(object):
        """Useless class."""

    return EmbeddedClass

# +1:[invalid-name]
BAD_NAME_FOR_CLASS = collections.namedtuple('Named', ['tuple'])
NEXT_BAD_NAME_FOR_CLASS = class_builder()  # [invalid-name]

GoodName = collections.namedtuple('Named', ['tuple'])
ToplevelClass = class_builder()

# Aliases for classes have the same name constraints.
AlsoCorrect = CorrectClassName
NOT_CORRECT = CorrectClassName  # [invalid-name]


def test_globals():
    """Names in global statements are also checked."""
    global NOT_CORRECT
    global AlsoCorrect  # [invalid-name]
    NOT_CORRECT = 1
    AlsoCorrect = 2


class FooClass(object):
    """A test case for property names.

    Since by default, the regex for attributes is the same as the one
    for method names, we check the warning messages to contain the
    string 'attribute'.
    """
    @property
    def PROPERTY_NAME(self):  # [invalid-name]
        """Ignored."""
        pass

    @abc.abstractproperty
    def ABSTRACT_PROPERTY_NAME(self):  # [invalid-name]
        """Ignored."""
        pass

    @PROPERTY_NAME.setter
    def PROPERTY_NAME_SETTER(self):  # [invalid-name]
        """Ignored."""
        pass

    def _nice_and_long_descriptive_private_method_name(self):
        """private method with long name"""
        pass


def good_public_function_name(good_arg_name):
    """This is a perfect public function"""
    good_variable_name = 1
    return good_variable_name + good_arg_name


def too_long_function_name_in_public_scope():  # [invalid-name]
    """Public scope function with a too long name"""
    return 12

def _private_scope_function_with_long_descriptive_name():
    """Private scope function are cool with long descriptive names"""
    return 12

LONG_CONSTANT_NAME_IN_PUBLIC_SCOPE_ARE_OKAY = True

class _AnExceptionalExceptionThatOccursVeryVeryRarely(Exception):
    """A very exceptional exception with a nice descriptive name"""
    pass

# pylint: disable=missing-docstring,no-self-use,too-few-public-methods,wrong-import-position

REVISION = None

REVISION() # [not-callable]

def correct():
    return 1

REVISION = correct()

class Correct(object):
    """callable object"""

class MetaCorrect(object):
    """callable object"""
    def __call__(self):
        return self

INSTANCE = Correct()
CALLABLE_INSTANCE = MetaCorrect()
CORRECT = CALLABLE_INSTANCE()
INCORRECT = INSTANCE() # [not-callable]
LIST = []
INCORRECT = LIST() # [not-callable]
DICT = {}
INCORRECT = DICT() # [not-callable]
TUPLE = ()
INCORRECT = TUPLE() # [not-callable]
INT = 1
INCORRECT = INT() # [not-callable]

# Test calling properties. Pylint can detect when using only the
# getter, but it doesn't infer properly when having a getter
# and a setter.
class MyProperty(property):
    """ test subclasses """

class PropertyTest(object):
    """ class """

    def __init__(self):
        self.attr = 4

    @property
    def test(self):
        """ Get the attribute """
        return self.attr

    @test.setter
    def test(self, value):
        """ Set the attribute """
        self.attr = value

    @MyProperty
    def custom(self):
        """ Get the attribute """
        return self.attr

    @custom.setter
    def custom(self, value):
        """ Set the attribute """
        self.attr = value

PROP = PropertyTest()
PROP.test(40) # [not-callable]
PROP.custom() # [not-callable]

# Safe from not-callable when using properties.

class SafeProperty(object):
    @property
    def static(self):
        return staticmethod

    @property
    def klass(self):
        return classmethod

    @property
    def get_lambda(self):
        return lambda: None

    @property
    def other_function(self):
        def function(arg):
            return arg
        return function

    @property
    def dict_builtin(self):
        return dict

    @property
    def range_builtin(self):
        return range

    @property
    def instance(self):
        class Empty(object):
            def __call__(self):
                return 42
        return Empty()

PROP1 = SafeProperty()
PROP1.static(2)
PROP1.klass(2)
PROP1.get_lambda()
PROP1.other_function(4)
PROP1.dict_builtin()
PROP1.range_builtin(4)
PROP1.instance()


import missing # pylint: disable=import-error

class UnknownBaseCallable(missing.Blah):
    pass

UnknownBaseCallable()()

# pylint: disable=missing-docstring,too-few-public-methods,invalid-name

class A(object):

    def __init__(self):
        self.x = 0
        self.setUp()

    def set_y(self, y):
        self.y = y

    def set_x(self, x):
        self.x = x

    def set_z(self, z):
        self.z = z # [attribute-defined-outside-init]

    def setUp(self):
        self.x = 0
        self.y = 0


class B(A):

    def test(self):
        self.z = 44 # [attribute-defined-outside-init]


class C(object):

    def __init__(self):
        self._init()

    def _init(self):
        self.z = 44


class D(object):

    def setUp(self):
        self.set_z()

    def set_z(self):
        self.z = 42


class E(object):

    def __init__(self):
        i = self._init
        i()

    def _init(self):
        self.z = 44


class Mixin(object):

    def test_mixin(self):
        """Don't emit attribute-defined-outside-init for mixin classes."""
        if self.defined_already: # pylint: disable=access-member-before-definition
            self.defined_already = None

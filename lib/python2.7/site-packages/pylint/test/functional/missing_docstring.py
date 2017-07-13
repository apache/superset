# [missing-docstring]
# pylint: disable=too-few-public-methods

def public_documented():
    """It has a docstring."""


def _private_undocumented():
    # Doesn't need a docstring
    pass


def _private_documented():
    """It has a docstring."""


class ClassDocumented(object):
    """It has a docstring."""


class ClassUndocumented(object): # [missing-docstring]
    pass


def public_undocumented(): # [missing-docstring]
    pass


def __sizeof__():
    # Special
    pass


def __mangled():
    pass


class Property(object):
    """Don't warn about setters and deleters."""

    def __init__(self):
        self._value = None

    @property
    def test(self):
        """Default docstring for setters and deleters."""

    @test.setter
    def test(self, value):
        self._value = value

    @test.deleter
    def test(self):
        pass

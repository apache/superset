"""Checks that missing self in method defs don't crash Pylint."""



class MyClass(object):
    """A class with some methods missing self args."""

    def __init__(self):
        self.var = "var"

    def method():  # [no-method-argument]
        """A method without a self argument."""

    def setup():  # [no-method-argument]
        """A method without a self argument, but usage."""
        self.var = 1  # [undefined-variable]

    def correct(self):
        """Correct."""
        self.var = "correct"

# pylint: disable=missing-docstring, too-few-public-methods
class MyClass:

    async def method(self):
        pass


def function():
    assert self.attr # [undefined-variable]


def func():
    self.attr += 2 # [undefined-variable]

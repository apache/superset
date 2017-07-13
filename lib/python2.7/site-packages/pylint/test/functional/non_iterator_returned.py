"""Check non-iterators returned by __iter__ """

# pylint: disable=too-few-public-methods, missing-docstring, no-self-use

import six

class FirstGoodIterator(object):
    """ yields in iterator. """

    def __iter__(self):
        for index in range(10):
            yield index

class SecondGoodIterator(object):
    """ __iter__ and next """

    def __iter__(self):
        return self

    def __next__(self):
        """ Infinite iterator, but still an iterator """
        return 1

    def next(self):
        """Same as __next__, but for Python 2."""
        return 1

class ThirdGoodIterator(object):
    """ Returns other iterator, not the current instance """

    def __iter__(self):
        return SecondGoodIterator()

class FourthGoodIterator(object):
    """ __iter__ returns iter(...) """

    def __iter__(self):
        return iter(range(10))


class IteratorMetaclass(type):
    def __next__(cls):
        return 1

    def next(cls):
        return 2


@six.add_metaclass(IteratorMetaclass)
class IteratorClass(object):
    """Iterable through the metaclass."""


class FifthGoodIterator(object):
    """__iter__ returns a class which uses an iterator-metaclass."""
    def __iter__(self):
        return IteratorClass

class FileBasedIterator(object):
    def __init__(self, path):
        self.path = path
        self.file = None

    def __iter__(self):
        if self.file is not None:
            self.file.close()
        self.file = open(self.path)
        # self file has two infered values: None and <instance of 'file'>
        # we don't want to emit error in this case
        return self.file


class FirstBadIterator(object):
    """ __iter__ returns a list """

    def __iter__(self): # [non-iterator-returned]
        return []

class SecondBadIterator(object):
    """ __iter__ without next """

    def __iter__(self): # [non-iterator-returned]
        return self

class ThirdBadIterator(object):
    """ __iter__ returns an instance of another non-iterator """

    def __iter__(self): # [non-iterator-returned]
        return SecondBadIterator()

class FourthBadIterator(object):
    """__iter__ returns a class."""

    def __iter__(self): # [non-iterator-returned]
        return ThirdBadIterator

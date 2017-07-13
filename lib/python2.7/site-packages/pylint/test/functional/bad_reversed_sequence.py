""" Checks that reversed() receive proper argument """
# pylint: disable=missing-docstring
# pylint: disable=too-few-public-methods,no-self-use,no-absolute-import
from collections import deque

__revision__ = 0

class GoodReversed(object):
    """ Implements __reversed__ """
    def __reversed__(self):
        return [1, 2, 3]

class SecondGoodReversed(object):
    """ Implements __len__ and __getitem__ """
    def __len__(self):
        return 3

    def __getitem__(self, index):
        return index

class BadReversed(object):
    """ implements only len() """
    def __len__(self):
        return 3

class SecondBadReversed(object):
    """ implements only __getitem__ """
    def __getitem__(self, index):
        return index

class ThirdBadReversed(dict):
    """ dict subclass """

def uninferable(seq):
    """ This can't be infered at this moment,
    make sure we don't have a false positive.
    """
    return reversed(seq)

def test(path):
    """ test function """
    seq = reversed() # No argument given
    seq = reversed(None) # [bad-reversed-sequence]
    seq = reversed([1, 2, 3])
    seq = reversed((1, 2, 3))
    seq = reversed(set()) # [bad-reversed-sequence]
    seq = reversed({'a': 1, 'b': 2}) # [bad-reversed-sequence]
    seq = reversed(iter([1, 2, 3])) # [bad-reversed-sequence]
    seq = reversed(GoodReversed())
    seq = reversed(SecondGoodReversed())
    seq = reversed(BadReversed()) # [bad-reversed-sequence]
    seq = reversed(SecondBadReversed()) # [bad-reversed-sequence]
    seq = reversed(range(100))
    seq = reversed(ThirdBadReversed()) # [bad-reversed-sequence]
    seq = reversed(lambda: None) # [bad-reversed-sequence]
    seq = reversed(deque([]))
    seq = reversed("123")
    seq = uninferable([1, 2, 3])
    seq = reversed(path.split("/"))
    return seq

def test_dict_ancestor_and_reversed():
    """Don't emit for subclasses of dict, with __reversed__ implemented."""
    from collections import OrderedDict

    class Child(dict):
        def __reversed__(self):
            return reversed(range(10))

    seq = reversed(OrderedDict())
    return reversed(Child()), seq

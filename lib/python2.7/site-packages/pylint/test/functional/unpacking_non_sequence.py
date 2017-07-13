"""Check unpacking non-sequences in assignments. """

# pylint: disable=too-few-public-methods, invalid-name, attribute-defined-outside-init, unused-variable, no-absolute-import
# pylint: disable=using-constant-test, no-init, missing-docstring, wrong-import-order,wrong-import-position,no-else-return
from os import rename as nonseq_func
from six import with_metaclass
from functional.unpacking import nonseq

__revision__ = 0

# Working

class Seq(object):
    """ sequence """
    def __init__(self):
        self.items = range(2)

    def __getitem__(self, item):
        return self.items[item]

    def __len__(self):
        return len(self.items)

class Iter(object):
    """ Iterator """
    def __iter__(self):
        for number in range(2):
            yield number

def good_unpacking():
    """ returns should be unpackable """
    if True:
        return [1, 2]
    else:
        return (3, 4)

def good_unpacking2():
    """ returns should be unpackable """
    return good_unpacking()

class MetaIter(type):
    "metaclass that makes classes that use it iterables"
    def __iter__(cls):
        return iter((1, 2))

class IterClass(with_metaclass(MetaIter)):
    "class that is iterable (and unpackable)"

class AbstrClass(object):
    "abstract class"
    pair = None

    def setup_pair(self):
        "abstract method"
        raise NotImplementedError

    def __init__(self):
        "error should not be emitted because setup_pair is abstract"
        self.setup_pair()
        x, y = self.pair

a, b = [1, 2]
a, b = (1, 2)
a, b = set([1, 2])
a, b = {1: 2, 2: 3}
a, b = "xy"
a, b = Seq()
a, b = Iter()
a, b = (number for number in range(2))
a, b = good_unpacking()
a, b = good_unpacking2()
a, b = IterClass

# Not working
class NonSeq(object):
    """ does nothing """

a, b = NonSeq() # [unpacking-non-sequence]
a, b = ValueError # [unpacking-non-sequence]
a, b = None # [unpacking-non-sequence]
a, b = 1 # [unpacking-non-sequence]
a, b = nonseq # [unpacking-non-sequence]
a, b = nonseq() # [unpacking-non-sequence]
a, b = nonseq_func # [unpacking-non-sequence]

class ClassUnpacking(object):
    """ Check unpacking as instance attributes. """

    def test(self):
        """ test unpacking in instance attributes. """

        self.a, self.b = 1, 2
        self.a, self.b = {1: 2, 2: 3}
        self.a, self.b = "xy"
        self.a, c = "xy"
        c, self.a = good_unpacking()
        self.a, self.b = Iter()

        self.a, self.b = NonSeq() # [unpacking-non-sequence]
        self.a, self.b = ValueError # [unpacking-non-sequence]
        self.a, c = nonseq_func # [unpacking-non-sequence]

class TestBase(object):
    'base class with `test` method implementation'
    @staticmethod
    def test(data):
        'default implementation'
        return data

class Test(TestBase):
    'child class that overrides `test` method'
    def __init__(self):
        # no error should be emitted here as `test` is overridden in this class
        (self.aaa, self.bbb, self.ccc) = self.test(None)

    @staticmethod
    def test(data):
        'overridden implementation'
        return (1, 2, 3)


import platform


def flow_control_false_positive():
    # This used to trigger an unpacking-non-sequence error. The problem was
    # partially related to the fact that pylint does not understand flow control,
    # but now it does not emit anymore, for this example, due to skipping it when
    # determining an inference of multiple potential values.
    # In any case, it is good having this repro as a test.
    system, node, release, version, machine, processor = platform.uname()
    # The previous line raises W0633
    return system, node, release, version, machine, processor


def flow_control_unpacking(var=None):
    if var is not None:
        var0, var1 = var
        return var0, var1

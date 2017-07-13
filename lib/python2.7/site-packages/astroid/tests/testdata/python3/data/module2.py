from __future__ import print_function
from data.module import YO, YOUPI
import data


class Specialization(YOUPI, YO):
    pass



class Metaclass(type):
    pass



class Interface:
    pass



class MyIFace(Interface):
    pass



class AnotherIFace(Interface):
    pass



class MyException(Exception):
    pass



class MyError(MyException):
    pass



class AbstractClass(object):
    
    def to_override(self, whatever):
        raise NotImplementedError()
    
    def return_something(self, param):
        if param:
            return 'toto'
        return



class Concrete0:
    __implements__ = MyIFace



class Concrete1:
    __implements__ = (MyIFace, AnotherIFace)



class Concrete2:
    __implements__ = (MyIFace, AnotherIFace)



class Concrete23(Concrete1):
    pass

del YO.member
del YO
[SYN1, SYN2] = (Concrete0, Concrete1)
assert repr(1)
b = (1) | (((2) & (3)) ^ (8))
bb = ((1) | (two)) | (6)
ccc = ((one) & (two)) & (three)
dddd = ((x) ^ (o)) ^ (r)
exec('c = 3')
exec('c = 3', {}, {})

def raise_string(a=2, *args, **kwargs):
    raise Exception('yo')
    yield 'coucou'
    yield
a = (b) + (2)
c = (b) * (2)
c = (b) / (2)
c = (b) // (2)
c = (b) - (2)
c = (b) % (2)
c = (b) ** (2)
c = (b) << (2)
c = (b) >> (2)
c = ~b
c = not b
d = [c]
e = d[:]
e = d[a:b:c]
raise_string(*args, **kwargs)
print('bonjour', file=stream)
print('salut', end=' ', file=stream)

def make_class(any, base=data.module.YO, *args, **kwargs):
    """check base is correctly resolved to Concrete0"""
    
    
    class Aaaa(base):
        """dynamic class"""
        
    
    return Aaaa
from os.path import abspath
import os as myos


class A:
    pass



class A(A):
    pass


def generator():
    """A generator."""
    yield

def not_a_generator():
    """A function that contains generator, but is not one."""
    
    def generator():
        yield
    genl = lambda : (yield)

def with_metaclass(meta, *bases):
    return meta('NewBase', bases, {})


class NotMetaclass(with_metaclass(Metaclass)):
    pass



# pylint: disable=R0903, print-statement
"""test unused argument
"""
from __future__ import print_function


def function(arg=1):
    """ignore arg"""


class AAAA(object):
    """dummy class"""

    def method(self, arg):
        """dummy method"""
        print(self)
    def __init__(self, *unused_args, **unused_kwargs):
        pass

    @classmethod
    def selected(cls, *args, **kwargs):
        """called by the registry when the vobject has been selected.
        """
        return cls

    def using_inner_function(self, etype, size=1):
        """return a fake result set for a particular entity type"""
        rset = AAAA([('A',)]*size, '%s X' % etype,
                    description=[(etype,)]*size)
        def inner(row, col=0, etype=etype, req=self, rset=rset):
            """inner using all its argument"""
            # pylint: disable = E1103
            return req.vreg.etype_class(etype)(req, rset, row, col)
        # pylint: disable = W0201
        rset.get_entity = inner

class BBBB(object):
    """dummy class"""

    def __init__(self, arg):
        """Constructor with an extra parameter. Should raise a warning"""
        self.spam = 1

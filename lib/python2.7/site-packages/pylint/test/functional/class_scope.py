# pylint: disable=R0903,W0232
"""check for scope problems"""

__revision__ = None

class Well(object):
    """well"""
    attr = 42
    get_attr = lambda arg=attr: arg * 24
    # +1: [used-before-assignment]
    get_attr_bad = lambda arg=revattr: revattr * 42
    revattr = 24
    bad_lambda = lambda: get_attr_bad # [undefined-variable]

    class Data(object):
        """base hidden class"""
    class Sub(Data):
        """whaou, is Data found???"""
        attr = Data() # [undefined-variable]
    def func(self):
        """check Sub is not defined here"""
        return Sub(), self # [undefined-variable]

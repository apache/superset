"""test no crash on __file__ global"""

def func():
    """override __file__"""
    global __file__
    __file__ = 'hop'

__revision__ = 'pouet'

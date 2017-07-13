"""test global statement"""

__revision__ = 0

exec 'a = __revision__'
exec 'a = 1' in {}

exec 'a = 1' in globals()

def func():
    """exec in local scope"""
    exec 'b = 1'

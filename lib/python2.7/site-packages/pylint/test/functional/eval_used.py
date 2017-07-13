"""test for eval usage"""

eval('os.listdir(".")') # [eval-used]
eval('os.listdir(".")', globals={})  # [eval-used]

eval('os.listdir(".")', globals=globals())  # [eval-used]

def func():
    """ eval in local scope"""
    eval('b = 1')  # [eval-used]

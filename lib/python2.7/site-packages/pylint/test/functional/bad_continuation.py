"""Regression test case for bad-continuation."""
# pylint: disable=print-statement,using-constant-test
# Various alignment for brackets
from __future__ import print_function

LIST0 = [
    1, 2, 3
]
LIST1 = [
    1, 2, 3
    ]
LIST2 = [
    1, 2, 3
   ]  # [bad-continuation]

# Alignment inside literals
W0 = [1, 2, 3,
      4, 5, 6,
         7,  # [bad-continuation]
      8, 9, 10,
      11, 12, 13,
      # and a comment
      14, 15, 16]

W1 = {
    'a': 1,
   'b': 2,  # [bad-continuation]
    'c': 3,
    }

W2 = {
    'a': 1,
   'b': 2,  # [bad-continuation]
    'c': 3,
    }

W2 = ['some', 'contents'  # with a continued comment that may be aligned
                          # under the previous comment (optionally)
      'and',
      'more',             # but this
                             # [bad-continuation] is not accepted
                          'contents', # [bad-continuation] nor this.
     ]

# Values in dictionaries should be indented 4 spaces further if they are on a
# different line than their key
W4 = {
    'key1':
    'value1',  # Grandfather in the old style
    'key2':
      'value2',  # [bad-continuation]
    'key3':
        'value3',  # Comma here
    }

# And should follow the same rules as continuations within parens
W5 = {
    'key1': 'long value'
            'long continuation',
    'key2': 'breaking'
        'wrong',  # [bad-continuation]
    'key3': 2*(
        2+2),
    'key4': ('parenthesis',
             'continuation')  # No comma here
    }

# Allow values to line up with their keys when the key is next to the brace
W6 = {'key1':
      'value1',
      'key2':
      'value2',
     }

# Or allow them to be indented
W7 = {'key1':
          'value1',
      'key2':
          'value2'
     }

# Bug that caused a warning on the previous two cases permitted these odd
# incorrect indentations
W8 = {'key1':
'value1',  # [bad-continuation]
     }

W9 = {'key1':
    'value1',  # [bad-continuation]
     }

# Alignment of arguments in function definitions
def continue1(some_arg,
              some_other_arg):
    """A function with well-aligned arguments."""
    print(some_arg, some_other_arg)


def continue2(
        some_arg,
        some_other_arg):
    """A function with well-aligned arguments."""
    print(some_arg, some_other_arg)

def continue3(
    some_arg,         # [bad-continuation]
    some_other_arg):  # [bad-continuation]
    """A function with misaligned arguments"""
    print(some_arg, some_other_arg)

def continue4(  # pylint:disable=missing-docstring
    arg1,
    arg2): print(arg1, arg2)


def callee(*args):
    """noop"""
    print(args)


callee(
    "a",
    "b"
    )

callee("a",
    "b")  # [bad-continuation]

callee(5, {'a': 'b',
           'c': 'd'})

if (
    1
    ): pass

if (
    1
): pass
if (
    1
   ): pass  # [bad-continuation]

if (1 and
    2):  # [bad-continuation]
    pass

while (1 and
       2):
    pass

while (1 and
         2 and  # [bad-continuation]
       3):
    pass

if (
  2): pass  # [bad-continuation]

if (1 or
    2 or
    3): pass

if (1 or
     2 or  # [bad-continuation]
    3): print(1, 2)

if (1 and
  2): pass  # [bad-continuation]

if (
    2): pass

if (
  2):  # [bad-continuation]
    pass

L1 = (lambda a,
             b: a + b)

if not (1 and
        2):
    print(3)

if not (1 and
    2):  # [bad-continuation]
    print(3)

continue2("foo",
          some_other_arg="this "
                         "is "
                         "fine")

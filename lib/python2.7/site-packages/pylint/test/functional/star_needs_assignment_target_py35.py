"""
Test PEP 0448 -- Additional Unpacking Generalizations
https://www.python.org/dev/peps/pep-0448/
"""

# pylint: disable=superfluous-parens

UNPACK_TUPLE = (*range(4), 4)
UNPACK_LIST = [*range(4), 4]
UNPACK_SET = {*range(4), 4}
UNPACK_DICT = {'a': 1, **{'b': '2'}}
UNPACK_DICT2 = {**UNPACK_DICT, "x": 1, "y": 2}
UNPACK_DICT3 = {**{'a': 1}, 'a': 2, **{'a': 3}}

UNPACK_IN_COMP = {elem for elem in (*range(10))} # [star-needs-assignment-target]

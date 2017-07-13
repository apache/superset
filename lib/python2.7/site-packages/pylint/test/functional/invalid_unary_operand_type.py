"""Detect problems with invalid operands used on invalid objects."""
# pylint: disable=missing-docstring,too-few-public-methods,invalid-name
# pylint: disable=unused-variable

import collections


class Implemented(object):
    def __invert__(self):
        return 42
    def __pos__(self):
        return 42
    def __neg__(self):
        return 42


def these_are_good():
    negative = -1
    negative1 = -1.0
    positive = +1
    positive2 = +1.0
    inverted = ~1
    not_int = not 1
    not_float = not 2.0
    not_string = not ""
    not_list = not []
    not_dict = not {}
    not_tuple = not (1, 2)
    inverted_instance = ~Implemented()
    positive_instance = +Implemented()
    negative_instance = -Implemented()
    not_instance = not Implemented()


def these_are_bad():
    invert_list = ~[] # [invalid-unary-operand-type]
    invert_tuple = ~() # [invalid-unary-operand-type]
    invert_dict = ~dict() # [invalid-unary-operand-type]
    invert_dict_1 = ~{} # [invalid-unary-operand-type]
    invert_set = ~set() # [invalid-unary-operand-type]
    neg_set = -set() # [invalid-unary-operand-type]
    neg_str = -"" # [invalid-unary-operand-type]
    invert_str = ~"" # [invalid-unary-operand-type]
    pos_str = +"" # [invalid-unary-operand-type]
    class A(object):
        pass
    invert_func = ~(lambda: None) # [invalid-unary-operand-type]
    invert_class = ~A # [invalid-unary-operand-type]
    invert_instance = ~A() # [invalid-unary-operand-type]
    invert_module = ~collections # [invalid-unary-operand-type]
    invert_float = ~2.0 # [invalid-unary-operand-type]

# pylint: disable=missing-docstring


HEHE = {}

def function1(value=[]): # [dangerous-default-value]
    """docstring"""
    return value

def function2(value=HEHE): # [dangerous-default-value]
    """docstring"""
    return value

def function3(value):
    """docstring"""
    return value

def function4(value=set()): # [dangerous-default-value]
    """set is mutable and dangerous."""
    return value

def function5(value=frozenset()):
    """frozenset is immutable and safe."""
    return value

GLOBAL_SET = set()

def function6(value=GLOBAL_SET): # [dangerous-default-value]
    """set is mutable and dangerous."""
    return value

def function7(value=dict()): # [dangerous-default-value]
    """dict is mutable and dangerous."""
    return value

def function8(value=list()):  # [dangerous-default-value]
    """list is mutable and dangerous."""
    return value

def function9(value=[1, 2, 3, 4]): # [dangerous-default-value]
    """list with items should not output item values in error message"""
    return value

def function10(value={'a': 1, 'b': 2}): # [dangerous-default-value]
    """dictionaries with items should not output item values in error message"""
    return value

def function11(value=list([1, 2, 3])): # [dangerous-default-value]
    """list with items should not output item values in error message"""
    return value

def function12(value=dict([('a', 1), ('b', 2)])): # [dangerous-default-value]
    """dictionaries with items should not output item values in error message"""
    return value

OINK = {
    'a': 1,
    'b': 2
}

def function13(value=OINK): # [dangerous-default-value]
    """dictionaries with items should not output item values in error message"""
    return value

def function14(value=dict([(1, 2), (1, 2, 3)])): # [dangerous-default-value]
    """a dictionary which will not be inferred to a syntax AST, but to an
    astroid.Instance.
    """
    return value

INVALID_DICT = dict([(1, 2), (1, 2, 3)])

def function15(value=INVALID_DICT): # [dangerous-default-value]
    """The same situation as function14."""
    return value

def function16(value={1}): # [dangerous-default-value]
    """set literal as default value"""
    return value

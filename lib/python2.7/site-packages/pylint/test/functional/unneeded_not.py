"""Check exceeding negations in boolean expressions trigger warnings"""

# pylint: disable=singleton-comparison,too-many-branches,too-few-public-methods,undefined-variable
# pylint: disable=literal-comparison
def unneeded_not():
    """This is not ok
    """
    bool_var = True
    someint = 2
    if not not bool_var:  # [unneeded-not]
        pass
    if not someint == 1:  # [unneeded-not]
        pass
    if not someint != 1:  # [unneeded-not]
        pass
    if not someint < 1:  # [unneeded-not]
        pass
    if not someint > 1:  # [unneeded-not]
        pass
    if not someint <= 1:  # [unneeded-not]
        pass
    if not someint >= 1:  # [unneeded-not]
        pass
    if not not someint:  # [unneeded-not]
        pass
    if not bool_var == True:  # [unneeded-not]
        pass
    if not bool_var == False:  # [unneeded-not]
        pass
    if not bool_var != True:  # [unneeded-not]
        pass
    if not True == True:  # [unneeded-not]
        pass
    if not 2 in [3, 4]:  # [unneeded-not]
        pass
    if not someint is 'test':  # [unneeded-not]
        pass


def tolerated_statements():
    """This is ok"""
    bool_var = True
    someint = 2
    if not(bool_var == False and someint == 1):
        pass
    if 2 not in [3, 4]:
        pass
    if not someint == bool_var == 2:
        pass
    if not 2 <= someint < 3 < 4:
        pass
    if not set('bar') <= set('foobaz'):
        pass
    if not set(something) <= 3:
        pass
    if not frozenset(something) <= 3:
        pass


class Klass(object):
    """This is also ok"""
    def __ne__(self, other):
        return not self == other

""" Test for too many branches. """
# pylint: disable=using-constant-test
def wrong(): # [too-many-branches]
    """ Has too many branches. """
    if 1:
        pass
    elif 1:
        pass
    elif 1:
        pass
    elif 1:
        pass
    elif 1:
        pass
    elif 1:
        pass
    try:
        pass
    finally:
        pass
    if 2:
        pass
    while True:
        pass
    if 1:
        pass
    elif 2:
        pass
    elif 3:
        pass

def good():
    """ Too many branches only if we take
    into consideration the nested functions.
    """
    def nested_1():
        """ empty """
        if 1:
            pass
        elif 2:
            pass
        elif 3:
            pass
        elif 4:
            pass

    nested_1()
    try:
        pass
    finally:
        pass
    try:
        pass
    finally:
        pass
    if 1:
        pass
    elif 2:
        pass
    elif 3:
        pass
    elif 4:
        pass
    elif 5:
        pass
    elif 6:
        pass
    elif 7:
        pass

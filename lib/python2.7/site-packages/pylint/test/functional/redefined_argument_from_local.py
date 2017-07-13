# pylint: disable=missing-docstring, unused-variable, unused-argument
# pylint: disable=redefined-outer-name, invalid-name, redefine-in-handler

def test_redefined_in_with(name):
    with open('something') as name: # [redefined-argument-from-local]
        pass
    with open('something') as (second, name): # [redefined-argument-from-local]
        pass
    with open('something') as (second, (name, third)): # [redefined-argument-from-local]
        pass
    other = None
    with open('something') as other:
        pass



def test_not_redefined_in_with(name):
    with open('something') as test_redefined_in_with:
        pass



def test_redefined_in_for(name):
    for name in []: # [redefined-argument-from-local]
        pass
    for (name, is_) in []: # [redefined-argument-from-local]
        pass
    for (is_, (name, _)) in []: # [redefined-argument-from-local]
        pass
    for _ in []:
        pass


def test_not_redefined_in_for(name):
    for name_1 in []:
        pass

    # This one can be okay if you are interested in the last value
    # of the iteration
    other = None
    for other in []:
        pass


def test_redefined_in_except_handler(name):
    try:
        1 / 0
    except ZeroDivisionError as name: # [redefined-argument-from-local]
        pass


def test_not_redefined_in_except_handler(name):
    try:
        1 / 0
    except ZeroDivisionError as test_redefined_in_except_handler:
        pass


def test_not_redefined(name):
    if not name:
        name = ''

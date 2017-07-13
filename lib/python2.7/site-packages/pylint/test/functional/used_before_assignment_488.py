# pylint: disable=missing-docstring
def func():
    """Test that a variable defined in a finally clause does not trigger a false positive"""
    try:
        variable = 1
        yield variable
    finally:
        variable = 2
        yield variable

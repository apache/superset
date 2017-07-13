"""Test for redefine-in-handler, overwriting names in exception handlers."""

def new_style():
    """Some exceptions can be unpacked."""
    try:
        pass
    except IOError, (errno, message):  # [unpacking-in-except]
        print errno, message  # pylint: disable=print-statement
    # +1: [redefine-in-handler,redefine-in-handler,unpacking-in-except]
    except IOError, (new_style, tuple):  # pylint: disable=duplicate-except
        print new_style, tuple  # pylint: disable=print-statement

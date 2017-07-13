# pylint: disable=undefined-variable,not-context-manager,missing-docstring

# both context managers are named
with one as first, two as second:
    pass

# first matched as tuple; this is ok
with one as (first, second), third:
    pass

# the first context manager doesn't have as name
with one, two as second:
    pass

# the second is a function call; this is ok
with one as first, two():
    pass

# nested with statements; make sure no message is emitted
# this could be a false positive on Py2
with one as first:
    with two:
        pass

# ambiguous looking with statement
with one as first, two:  # [confusing-with-statement]
    pass

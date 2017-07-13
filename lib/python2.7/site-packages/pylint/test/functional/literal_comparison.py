# pylint: disable=missing-docstring


if 2 is 2: # [literal-comparison]
    pass

if "a" is b"a": # [literal-comparison]
    pass

if 2.0 is 3.0: # [literal-comparison]
    pass

if () is (1, 2, 3): # [literal-comparison]
    pass

if () is {1:2, 2:3}: # [literal-comparison]
    pass

if [] is [4, 5, 6]: # [literal-comparison]
    pass

if () is {1, 2, 3}: # [literal-comparison]
    pass

if () is not {1:2, 2:3}: # [literal-comparison]
    pass

if [] is not [4, 5, 6]: # [literal-comparison]
    pass

if () is not {1, 2, 3}: # [literal-comparison]
    pass


# We do not do inference for this check, since the comparing
# object might be used as a sentinel.
CONST = 24
if () is CONST:
    pass

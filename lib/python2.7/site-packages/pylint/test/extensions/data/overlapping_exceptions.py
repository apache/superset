# pylint: disable=missing-docstring

class SomeException(Exception):
    pass

class SubclassException(SomeException):
    pass

AliasException = SomeException

try:
    pass
except (SomeException, SomeException): # [overlapping-except]
    pass

try:
    pass
except (SomeException, SubclassException): # [overlapping-except]
    pass

try:
    pass
except (SomeException, AliasException): # [overlapping-except]
    pass

try:
    pass
except (AliasException, SubclassException): # [overlapping-except]
    pass

try:
    pass
# +1:[overlapping-except, overlapping-except, overlapping-except]
except (SomeException, AliasException, SubclassException):
    pass

try:
    pass
except (ArithmeticError, FloatingPointError): # [overlapping-except]
    pass

try:
    pass
except (ValueError, UnicodeDecodeError): # [overlapping-except]
    pass

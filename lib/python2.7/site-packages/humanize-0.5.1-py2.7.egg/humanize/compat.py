import sys

if sys.version_info < (3,):
    string_types = (basestring,)
else:
    string_types = (str,)


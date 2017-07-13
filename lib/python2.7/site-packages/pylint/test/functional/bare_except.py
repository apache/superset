# pylint: disable=missing-docstring, import-error

try:
    1 + "2"
except: # [bare-except]
    pass

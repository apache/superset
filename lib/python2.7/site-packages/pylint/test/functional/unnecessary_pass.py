# pylint: disable=missing-docstring

try:
    A = 2
except ValueError:
    A = 24
    pass # [unnecessary-pass]

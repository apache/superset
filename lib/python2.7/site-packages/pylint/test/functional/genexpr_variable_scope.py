"""test name defined in generator expression are not available
outside the genexpr scope
"""
from __future__ import print_function
print(n)  # [undefined-variable]

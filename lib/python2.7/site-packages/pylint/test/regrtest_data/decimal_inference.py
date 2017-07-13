"""hum E1011 on .prec member is justifiable since Context instance are built
using setattr/locals :(

2007/02/17 update: .prec attribute is now detected by astroid :o)
"""
from __future__ import print_function
import decimal

decimal.getcontext().prec = 200
print(decimal.getcontext().prec)

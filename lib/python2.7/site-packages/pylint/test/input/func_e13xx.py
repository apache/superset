"""test string format error
"""
# pylint: disable=print-statement,unsupported-binary-operation
from __future__ import print_function

PARG_1 = PARG_2 = PARG_3 = 1

def pprint():
    """Test string format
    """
    print("%s %s" % {'PARG_1': 1, 'PARG_2': 2}) # E1306
    print("%s" % (PARG_1, PARG_2)) # E1305
    print("%(PARG_1)d %d" % {'PARG_1': 1, 'PARG_2': 2}) # E1302
    print("%(PARG_1)d %(PARG_2)d" % {'PARG_1': 1}) # E1304
    print("%(PARG_1)d %(PARG_2)d" % {'PARG_1': 1, 'PARG_2':2, 'PARG_3':3}) #W1301
    print("%(PARG_1)d %(PARG_2)d" % {'PARG_1': 1, 2:3}) # W1300 E1304
    print("%(PARG_1)d %(PARG_2)d" % (2, 3)) # 1303
    print("%(PARG_1)d %(PARG_2)d" % [2, 3]) # 1303
    print("%2z" % PARG_1)
    print("strange format %2" % PARG_2)
    print("works in 3 %a" % 1)

# pylint: disable=too-few-public-methods,import-error, no-absolute-import,missing-docstring
# pylint: disable=useless-super-delegation,wrong-import-position,invalid-name, wrong-import-order

if len('TEST'): # [len-as-condition]
    pass

while not len('TEST'): # [len-as-condition]
    pass

assert len('TEST') > 0 # [len-as-condition]

x = 1 if len('TEST') != 0 else 2 # [len-as-condition]

if len('TEST') == 0: # [len-as-condition]
    pass

if True and len('TEST') == 0: # [len-as-condition]
    pass

if 0 == len('TEST') < 10: # [len-as-condition]
    pass

if 0 < 1 <= len('TEST') < 10: # Should be fine
    pass

if 10 > len('TEST') != 0: # [len-as-condition]
    pass

z = False
if z and len(['T', 'E', 'S', 'T']):  # [len-as-condition]
    pass

if 10 > len('TEST') > 1 > 0:
    pass

f_o_o = len('TEST') or 42  # Should be fine

a = x and len(x)  # Should be fine

if 0 <= len('TEST') < 100:  # Should be fine
    pass

if z or 10 > len('TEST') != 0: # [len-as-condition]
    pass

def some_func():
    return len('TEST') > 0  # Should be fine


def github_issue_1325():
    l = [1, 2, 3]
    length = len(l) if l else 0
    return length


def github_issue_1331(*args):
    assert False, len(args)


def github_issue_1331_v2(*args):
    assert len(args), args  # [len-as-condition]


def github_issue_1331_v3(*args):
    assert len(args) or z, args  # [len-as-condition]

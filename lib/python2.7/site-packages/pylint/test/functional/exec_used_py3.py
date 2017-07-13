# pylint: disable=missing-docstring

exec('a = __revision__') # [exec-used]
exec('a = 1', globals={}) # [exec-used]

exec('a = 1', globals=globals()) # [exec-used]

def func():
    exec('b = 1') # [exec-used]

'''Assert check example'''

# pylint: disable=misplaced-comparison-constant
assert (1 == 1, 2 == 2), "no error"
assert (1 == 1, 2 == 2) # [assert-on-tuple]
assert 1 == 1, "no error"
assert (1 == 1, ), "no error"
assert (1 == 1, )
assert (1 == 1, 2 == 2, 3 == 5), "no error"
assert ()
assert (True, 'error msg') # [assert-on-tuple]

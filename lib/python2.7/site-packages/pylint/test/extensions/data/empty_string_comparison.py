# pylint: disable=literal-comparison,missing-docstring

X = ''
Y = 'test'

if X is '':  # [compare-to-empty-string]
    pass

if Y is not "":  # [compare-to-empty-string]
    pass

if X == "":  # [compare-to-empty-string]
    pass

if Y != '':  # [compare-to-empty-string]
    pass

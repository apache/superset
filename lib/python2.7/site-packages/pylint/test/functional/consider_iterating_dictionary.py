# pylint: disable=missing-docstring, expression-not-assigned, too-few-public-methods, no-member, import-error, no-self-use, line-too-long

from unknown import Unknown


class CustomClass(object):
    def keys(self):
        return []

for key in Unknown().keys():
    pass
for key in Unknown.keys():
    pass
for key in dict.keys():
    pass
for key in {}.values():
    pass
for key in {}.key():
    pass
for key in CustomClass().keys():
    pass

[key for key in {}.keys()] # [consider-iterating-dictionary]
(key for key in {}.keys()) # [consider-iterating-dictionary]
{key for key in {}.keys()} # [consider-iterating-dictionary]
{key: key for key in {}.keys()} # [consider-iterating-dictionary]
COMP1 = [key for key in {}.keys()] # [consider-iterating-dictionary]
COMP2 = (key for key in {}.keys()) # [consider-iterating-dictionary]
COMP3 = {key for key in {}.keys()} # [consider-iterating-dictionary]
COMP4 = {key: key for key in {}.keys()} # [consider-iterating-dictionary]
for key in {}.keys(): # [consider-iterating-dictionary]
    pass

# Issue #1247
DICT = {'a': 1, 'b': 2}
COMP1 = [k * 2 for k in DICT.keys()] + [k * 3 for k in DICT.keys()]  # [consider-iterating-dictionary,consider-iterating-dictionary]
COMP2, COMP3 = [k * 2 for k in DICT.keys()], [k * 3 for k in DICT.keys()]  # [consider-iterating-dictionary,consider-iterating-dictionary]
SOME_TUPLE = ([k * 2 for k in DICT.keys()], [k * 3 for k in DICT.keys()])  # [consider-iterating-dictionary,consider-iterating-dictionary]

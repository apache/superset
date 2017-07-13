"""Checks for if statements containing too many boolean expressions"""

# pylint: disable=invalid-name

x = y = z = 5
if x > -5 and x < 5 and y > -5 and y < 5 and z > -5 and z < 5:  # [too-many-boolean-expressions]
    pass
elif True and False and 1 and 2 and 3:
    pass
elif True and False and 1 and 2 and 3 and 4 and 5: # [too-many-boolean-expressions]
    pass
elif True and (True and True) and (x == 5 or True or True): # [too-many-boolean-expressions]
    pass
elif True and (True or (x > -5 and x < 5 and (z > -5 or z < 5))): # [too-many-boolean-expressions]
    pass
elif True == True == True == True == True == True:
    pass

if True and False and 1 and 2 and 3:
    pass

"""Test for a = *b"""

FIRST = *[1, 2]  # [star-needs-assignment-target]
*THIRD, FOURTH = [1, 2, 3,]

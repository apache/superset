"""Test for *a = b """

*FIRST = [1, 2, 3] # [invalid-star-assignment-target]
(*FIRST, ) = [1, 2, 3]

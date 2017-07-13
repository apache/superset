"""Test for too-many-star-expressions."""

*FIRST, *SECOND = [1, 2, 3] # [too-many-star-expressions]
*FIRST_1, SECOND = (1, 2, 3)

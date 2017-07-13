# coding: utf-8
"""Test data file files with non-ASCII content."""


THIS_IS_A_LONG_VARIABLE_NAME = 'Существительное Частица'  # but the line is okay

THIS_IS_A_VERY_LONG_VARIABLE_NAME = 'Существительное Частица'  # and the line is not okay  # [line-too-long]

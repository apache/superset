'''Regression for issue https://github.com/PyCQA/pylint/issues/1004'''
# pylint: disable=missing-docstring, pointless-statement

import sys
sys.__stdout__.buffer.write('test')
sys.__stdout__.buff # [no-member]
sys.__stdout__.buffer.write1 # [no-member]

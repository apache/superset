# pylint: disable=missing-docstring, pointless-statement
from __future__ import print_function


def totoo():
 print('malindented') # [bad-indentation]

def tutuu():
    print('good indentation')

def titii():
     1  # and this. # [bad-indentation]

def tataa(kdict):
    for key in ['1', '2', '3']:
        key = key.lower()

        if key in kdict:
            del kdict[key]

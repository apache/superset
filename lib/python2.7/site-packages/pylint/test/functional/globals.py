"""Warnings about global statements and usage of global variables."""
from __future__ import print_function

global CSTE  # [global-at-module-level]
print(CSTE)  # [undefined-variable]

CONSTANT = 1

def fix_contant(value):
    """all this is ok, but try not using global ;)"""
    global CONSTANT  # [global-statement]
    print(CONSTANT)
    CONSTANT = value


def other():
    """global behaviour test"""
    global HOP  # [global-variable-not-assigned]
    print(HOP)  # [undefined-variable]


def define_constant():
    """ok but somevar is not defined at the module scope"""
    global SOMEVAR  # [global-variable-undefined]
    SOMEVAR = 2

"""Unittests for W0404 (reimport)"""
from __future__ import absolute_import, print_function

import sys

import xml.etree.ElementTree
from xml.etree import ElementTree

from email import encoders
import email.encoders

import sys  #pylint: disable=ungrouped-imports,wrong-import-order
__revision__ = 0

def no_reimport():
    """docstring"""
    import os
    print(os)


def reimport():
    """This function contains a reimport."""
    import sys
    del sys


del sys, ElementTree, xml.etree.ElementTree, encoders, email.encoders

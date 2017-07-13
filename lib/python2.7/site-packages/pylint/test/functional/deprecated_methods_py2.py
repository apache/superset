""" Functional test for deprecated methods in Python 2 """
# pylint: disable=no-member
import os
import xml.etree.ElementTree

os.popen2('')     # [deprecated-method]
os.popen3('')     # [deprecated-method]
os.popen4('')     # [deprecated-method]
xml.etree.ElementTree.Element('elem').getchildren()     # [deprecated-method]

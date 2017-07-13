""" Functional tests for method deprecation. """
# pylint: disable=missing-docstring, super-init-not-called, not-callable
import base64
import cgi
import inspect
import logging
import nntplib
import platform
import unittest
import xml.etree.ElementTree


class MyTest(unittest.TestCase):
    def test(self):
        self.assert_(True)  # [deprecated-method]

xml.etree.ElementTree.Element('tag').getchildren()  # [deprecated-method]
xml.etree.ElementTree.Element('tag').getiterator()  # [deprecated-method]
xml.etree.ElementTree.XMLParser('tag', None, None).doctype(None, None, None)  # [deprecated-method]
nntplib.NNTP(None).xpath(None) # [deprecated-method]


inspect.getargspec(None) # [deprecated-method]
logging.warn("a") # [deprecated-method]
platform.popen([]) # [deprecated-method]
base64.encodestring("42") # [deprecated-method]
base64.decodestring("42") # [deprecated-method]
cgi.escape("a") # [deprecated-method]


class SuperCrash(unittest.TestCase):

    def __init__(self):
        # should not crash.
        super(SuperCrash, self)()

xml.etree.ElementTree.iterparse(None)

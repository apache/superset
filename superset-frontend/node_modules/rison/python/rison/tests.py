# encoding: utf-8

import unittest
import parser as rison

expected_mappings = {
    "(a:0,b:1)": {'a': 0, 'b': 1},
    "(a:0,b:foo,c:'23skidoo')": {'a': 0, 'c': '23skidoo', 'b': 'foo'},
    "!t": True,
    "!f": False,
    "!n": None,
    "''": '',
    "0": 0,
    "1.5": 1.5,
    "-3": -3,
    "1e30": 1e+30,
    "1e-30": 1.0000000000000001e-30,
    "G.": "G.",
    "a": "a",
    "'0a'": "0a",
    "'abc def'": "abc def",
    "()": {},
    "(a:0)": {'a': 0},
    "(id:!n,type:/common/document)": {'type': '/common/document', 'id': None},
    "!()": [],
    "!(!t,!f,!n,'')": [True, False, None, ''],
    "'-h'": "-h",
    "a-z": "a-z",
    "'wow!!'": "wow!",
    "domain.com": "domain.com",
    "'user@domain.com'": "user@domain.com",
    "'US $10'": "US $10",
    "'can!'t'": "can't",
}

class TestRisonParser(unittest.TestCase):
    def test_deserialization(self):
        for frm, to in expected_mappings.items():
            self.assertEquals(rison.loads(frm), to)

if __name__ == '__main__':
    for s in expected_mappings.keys():
        print
        print '*'*70
        print
        print s
        print '%r' % (rison.loads(s),)
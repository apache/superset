# Copyright 2004-2005 Elemental Security, Inc. All Rights Reserved.
# Licensed to PSF under a Contributor Agreement.

# Extended to handle raw and unicode literals by Georg Brandl.

"""Safely evaluate Python string literals without using eval()."""
from __future__ import print_function

import re

from six import text_type


simple_escapes = {"a": "\a",
                  "b": "\b",
                  "f": "\f",
                  "n": "\n",
                  "r": "\r",
                  "t": "\t",
                  "v": "\v",
                  "'": "'",
                  '"': '"',
                  "\\": "\\"}

def convert_hex(x, n):
    if len(x) < n+1:
        raise ValueError("invalid hex string escape ('\\%s')" % x)
    try:
        return int(x[1:], 16)
    except ValueError:
        raise ValueError("invalid hex string escape ('\\%s')" % x)

def escape(m):
    all, tail = m.group(0, 1)
    assert all.startswith("\\")
    esc = simple_escapes.get(tail)
    if esc is not None:
        return esc
    elif tail.startswith("x"):
        return chr(convert_hex(tail, 2))
    elif tail.startswith('u'):
        return unichr(convert_hex(tail, 4))
    elif tail.startswith('U'):
        return unichr(convert_hex(tail, 8))
    elif tail.startswith('N'):
        import unicodedata
        try:
            return unicodedata.lookup(tail[1:-1])
        except KeyError:
            raise ValueError("undefined character name %r" % tail[1:-1])
    else:
        try:
            return chr(int(tail, 8))
        except ValueError:
            raise ValueError("invalid octal string escape ('\\%s')" % tail)

def escaperaw(m):
    all, tail = m.group(0, 1)
    if tail.startswith('u'):
        return unichr(convert_hex(tail, 4))
    elif tail.startswith('U'):
        return unichr(convert_hex(tail, 8))
    else:
        return all

escape_re = re.compile(r"\\(\'|\"|\\|[abfnrtv]|x.{0,2}|[0-7]{1,3})")
uni_escape_re = re.compile(r"\\(\'|\"|\\|[abfnrtv]|x.{0,2}|[0-7]{1,3}|"
                           r"u[0-9a-fA-F]{0,4}|U[0-9a-fA-F]{0,8}|N\{.+?\})")

def evalString(s, encoding=None):
    regex = escape_re
    repl = escape
    if encoding and not isinstance(s, text_type):
        s = s.decode(encoding)
    if s.startswith('u') or s.startswith('U'):
        regex = uni_escape_re
        s = s[1:]
    if s.startswith('r') or s.startswith('R'):
        repl = escaperaw
        s = s[1:]
    assert s.startswith("'") or s.startswith('"'), repr(s[:1])
    q = s[0]
    if s[:3] == q*3:
        q = q*3
    assert s.endswith(q), repr(s[-len(q):])
    assert len(s) >= 2*len(q)
    s = s[len(q):-len(q)]
    return regex.sub(repl, s)

def test():
    for i in range(256):
        c = chr(i)
        s = repr(c)
        e = evalString(s)
        if e != c:
            print(i, c, s, e)


if __name__ == "__main__":
    test()

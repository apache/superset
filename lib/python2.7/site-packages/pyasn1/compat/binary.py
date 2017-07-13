#
# This file is part of pyasn1 software.
#
# Copyright (c) 2005-2017, Ilya Etingof <etingof@gmail.com>
# License: http://pyasn1.sf.net/license.html
#
from sys import version_info

if version_info[0:2] < (2, 6):
    def bin(value):
        bitstring = []

        while value:
            if value & 1 == 1:
                bitstring.append('1')
            else:
                bitstring.append('0')

            value >>= 1

        bitstring.reverse()

        return '0b' + ''.join(bitstring)
else:
    bin = bin

#!/usr/bin/env python

# bug_gc.py - test for refcounting/GC bug
#
# Copyright (C) 2010-2011 Federico Di Gregorio  <fog@debian.org>
#
# psycopg2 is free software: you can redistribute it and/or modify it
# under the terms of the GNU Lesser General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# In addition, as a special exception, the copyright holders give
# permission to link this program with the OpenSSL library (or with
# modified versions of OpenSSL that use the same license as OpenSSL),
# and distribute linked combinations including the two.
#
# You must obey the GNU Lesser General Public License in all respects for
# all of the code used other than OpenSSL.
#
# psycopg2 is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public
# License for more details.

import psycopg2
import psycopg2.extensions
import unittest
import gc

from testutils import ConnectingTestCase, skip_if_no_uuid


class StolenReferenceTestCase(ConnectingTestCase):
    @skip_if_no_uuid
    def test_stolen_reference_bug(self):
        def fish(val, cur):
            gc.collect()
            return 42
        UUID = psycopg2.extensions.new_type((2950,), "UUID", fish)
        psycopg2.extensions.register_type(UUID, self.conn)
        curs = self.conn.cursor()
        curs.execute("select 'b5219e01-19ab-4994-b71e-149225dc51e4'::uuid")
        curs.fetchone()


def test_suite():
    return unittest.TestLoader().loadTestsFromName(__name__)


if __name__ == "__main__":
    unittest.main()

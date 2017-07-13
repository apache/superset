#!/usr/bin/env python

# test_psycopg2_dbapi20.py - DB API conformance test for psycopg2
#
# Copyright (C) 2006-2011 Federico Di Gregorio  <fog@debian.org>
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

import dbapi20
import dbapi20_tpc
from testutils import skip_if_tpc_disabled
from testutils import unittest, decorate_all_tests
import psycopg2

from testconfig import dsn


class Psycopg2Tests(dbapi20.DatabaseAPI20Test):
    driver = psycopg2
    connect_args = ()
    connect_kw_args = {'dsn': dsn}

    lower_func = 'lower' # For stored procedure test

    def test_callproc(self):
        # Until DBAPI 2.0 compliance, callproc should return None or it's just
        # misleading. Therefore, we will skip the return value test for
        # callproc and only perform the fetch test.
        #
        # For what it's worth, the DBAPI2.0 test_callproc doesn't actually
        # test for DBAPI2.0 compliance! It doesn't check for modified OUT and
        # IN/OUT parameters in the return values!
        con = self._connect()
        try:
            cur = con.cursor()
            if self.lower_func and hasattr(cur,'callproc'):
                cur.callproc(self.lower_func,('FOO',))
                r = cur.fetchall()
                self.assertEqual(len(r),1,'callproc produced no result set')
                self.assertEqual(len(r[0]),1,
                    'callproc produced invalid result set'
                    )
                self.assertEqual(r[0][0],'foo',
                    'callproc produced invalid results'
                    )
        finally:
            con.close()

    def test_setoutputsize(self):
        # psycopg2's setoutputsize() is a no-op
        pass

    def test_nextset(self):
        # psycopg2 does not implement nextset()
        pass


class Psycopg2TPCTests(dbapi20_tpc.TwoPhaseCommitTests, unittest.TestCase):
    driver = psycopg2

    def connect(self):
        return psycopg2.connect(dsn=dsn)

decorate_all_tests(Psycopg2TPCTests, skip_if_tpc_disabled)


def test_suite():
    return unittest.TestLoader().loadTestsFromName(__name__)

if __name__ == '__main__':
    unittest.main()

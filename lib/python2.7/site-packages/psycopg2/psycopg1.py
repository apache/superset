"""psycopg 1.1.x compatibility module

This module uses the new style connection and cursor types to build a psycopg
1.1.1.x compatibility layer. It should be considered a temporary hack to run
old code while porting to psycopg 2. Import it as follows::

    from psycopg2 import psycopg1 as psycopg
"""
# psycopg/psycopg1.py - psycopg 1.1.x compatibility module
#
# Copyright (C) 2003-2010 Federico Di Gregorio  <fog@debian.org>
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

import psycopg2._psycopg as _2psycopg   # noqa
from psycopg2.extensions import cursor as _2cursor
from psycopg2.extensions import connection as _2connection

from psycopg2 import *      # noqa
import psycopg2.extensions as _ext
_2connect = connect


def connect(*args, **kwargs):
    """connect(dsn, ...) -> new psycopg 1.1.x compatible connection object"""
    kwargs['connection_factory'] = connection
    conn = _2connect(*args, **kwargs)
    conn.set_isolation_level(_ext.ISOLATION_LEVEL_READ_COMMITTED)
    return conn


class connection(_2connection):
    """psycopg 1.1.x connection."""

    def cursor(self):
        """cursor() -> new psycopg 1.1.x compatible cursor object"""
        return _2connection.cursor(self, cursor_factory=cursor)

    def autocommit(self, on_off=1):
        """autocommit(on_off=1) -> switch autocommit on (1) or off (0)"""
        if on_off > 0:
            self.set_isolation_level(_ext.ISOLATION_LEVEL_AUTOCOMMIT)
        else:
            self.set_isolation_level(_ext.ISOLATION_LEVEL_READ_COMMITTED)


class cursor(_2cursor):
    """psycopg 1.1.x cursor.

    Note that this cursor implements the exact procedure used by psycopg 1 to
    build dictionaries out of result rows. The DictCursor in the
    psycopg.extras modules implements a much better and faster algorithm.
    """

    def __build_dict(self, row):
        res = {}
        for i in range(len(self.description)):
            res[self.description[i][0]] = row[i]
        return res

    def dictfetchone(self):
        row = _2cursor.fetchone(self)
        if row:
            return self.__build_dict(row)
        else:
            return row

    def dictfetchmany(self, size):
        res = []
        rows = _2cursor.fetchmany(self, size)
        for row in rows:
            res.append(self.__build_dict(row))
        return res

    def dictfetchall(self):
        res = []
        rows = _2cursor.fetchall(self)
        for row in rows:
            res.append(self.__build_dict(row))
        return res

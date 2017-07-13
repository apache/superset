#!/usr/bin/env python

# test_notify.py - unit test for async notifications
#
# Copyright (C) 2010-2011 Daniele Varrazzo  <daniele.varrazzo@gmail.com>
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

from testutils import unittest

import psycopg2
from psycopg2 import extensions
from testutils import ConnectingTestCase, script_to_py3, slow
from testconfig import dsn

import sys
import time
import select
from subprocess import Popen, PIPE


class NotifiesTests(ConnectingTestCase):

    def autocommit(self, conn):
        """Set a connection in autocommit mode."""
        conn.set_isolation_level(extensions.ISOLATION_LEVEL_AUTOCOMMIT)

    def listen(self, name):
        """Start listening for a name on self.conn."""
        curs = self.conn.cursor()
        curs.execute("LISTEN " + name)
        curs.close()

    def notify(self, name, sec=0, payload=None):
        """Send a notification to the database, eventually after some time."""
        if payload is None:
            payload = ''
        else:
            payload = ", %r" % payload

        script = ("""\
import time
time.sleep(%(sec)s)
import %(module)s as psycopg2
import %(module)s.extensions as ext
conn = psycopg2.connect(%(dsn)r)
conn.set_isolation_level(ext.ISOLATION_LEVEL_AUTOCOMMIT)
print conn.get_backend_pid()
curs = conn.cursor()
curs.execute("NOTIFY " %(name)r %(payload)r)
curs.close()
conn.close()
""" % {
            'module': psycopg2.__name__,
            'dsn': dsn, 'sec': sec, 'name': name, 'payload': payload})

        return Popen([sys.executable, '-c', script_to_py3(script)], stdout=PIPE)

    @slow
    def test_notifies_received_on_poll(self):
        self.autocommit(self.conn)
        self.listen('foo')

        proc = self.notify('foo', 1)

        t0 = time.time()
        select.select([self.conn], [], [], 5)
        t1 = time.time()
        self.assert_(0.99 < t1 - t0 < 4, t1 - t0)

        pid = int(proc.communicate()[0])
        self.assertEqual(0, len(self.conn.notifies))
        self.assertEqual(extensions.POLL_OK, self.conn.poll())
        self.assertEqual(1, len(self.conn.notifies))
        self.assertEqual(pid, self.conn.notifies[0][0])
        self.assertEqual('foo', self.conn.notifies[0][1])

    @slow
    def test_many_notifies(self):
        self.autocommit(self.conn)
        for name in ['foo', 'bar', 'baz']:
            self.listen(name)

        pids = {}
        for name in ['foo', 'bar', 'baz', 'qux']:
            pids[name] = int(self.notify(name).communicate()[0])

        self.assertEqual(0, len(self.conn.notifies))
        for i in range(10):
            self.assertEqual(extensions.POLL_OK, self.conn.poll())
        self.assertEqual(3, len(self.conn.notifies))

        names = dict.fromkeys(['foo', 'bar', 'baz'])
        for (pid, name) in self.conn.notifies:
            self.assertEqual(pids[name], pid)
            names.pop(name)     # raise if name found twice

    @slow
    def test_notifies_received_on_execute(self):
        self.autocommit(self.conn)
        self.listen('foo')
        pid = int(self.notify('foo').communicate()[0])
        self.assertEqual(0, len(self.conn.notifies))
        self.conn.cursor().execute('select 1;')
        self.assertEqual(1, len(self.conn.notifies))
        self.assertEqual(pid, self.conn.notifies[0][0])
        self.assertEqual('foo', self.conn.notifies[0][1])

    @slow
    def test_notify_object(self):
        self.autocommit(self.conn)
        self.listen('foo')
        self.notify('foo').communicate()
        time.sleep(0.5)
        self.conn.poll()
        notify = self.conn.notifies[0]
        self.assert_(isinstance(notify, psycopg2.extensions.Notify))

    @slow
    def test_notify_attributes(self):
        self.autocommit(self.conn)
        self.listen('foo')
        pid = int(self.notify('foo').communicate()[0])
        time.sleep(0.5)
        self.conn.poll()
        self.assertEqual(1, len(self.conn.notifies))
        notify = self.conn.notifies[0]
        self.assertEqual(pid, notify.pid)
        self.assertEqual('foo', notify.channel)
        self.assertEqual('', notify.payload)

    @slow
    def test_notify_payload(self):
        if self.conn.server_version < 90000:
            return self.skipTest("server version %s doesn't support notify payload"
                % self.conn.server_version)
        self.autocommit(self.conn)
        self.listen('foo')
        pid = int(self.notify('foo', payload="Hello, world!").communicate()[0])
        time.sleep(0.5)
        self.conn.poll()
        self.assertEqual(1, len(self.conn.notifies))
        notify = self.conn.notifies[0]
        self.assertEqual(pid, notify.pid)
        self.assertEqual('foo', notify.channel)
        self.assertEqual('Hello, world!', notify.payload)

    @slow
    def test_notify_deque(self):
        from collections import deque
        self.autocommit(self.conn)
        self.conn.notifies = deque()
        self.listen('foo')
        self.notify('foo').communicate()
        time.sleep(0.5)
        self.conn.poll()
        notify = self.conn.notifies.popleft()
        self.assert_(isinstance(notify, psycopg2.extensions.Notify))
        self.assertEqual(len(self.conn.notifies), 0)

    @slow
    def test_notify_noappend(self):
        self.autocommit(self.conn)
        self.conn.notifies = None
        self.listen('foo')
        self.notify('foo').communicate()
        time.sleep(0.5)
        self.conn.poll()
        self.assertEqual(self.conn.notifies, None)

    def test_notify_init(self):
        n = psycopg2.extensions.Notify(10, 'foo')
        self.assertEqual(10, n.pid)
        self.assertEqual('foo', n.channel)
        self.assertEqual('', n.payload)
        (pid, channel) = n
        self.assertEqual((pid, channel), (10, 'foo'))

        n = psycopg2.extensions.Notify(42, 'bar', 'baz')
        self.assertEqual(42, n.pid)
        self.assertEqual('bar', n.channel)
        self.assertEqual('baz', n.payload)
        (pid, channel) = n
        self.assertEqual((pid, channel), (42, 'bar'))

    def test_compare(self):
        data = [(10, 'foo'), (20, 'foo'), (10, 'foo', 'bar'), (10, 'foo', 'baz')]
        for d1 in data:
            for d2 in data:
                n1 = psycopg2.extensions.Notify(*d1)
                n2 = psycopg2.extensions.Notify(*d2)
                self.assertEqual((n1 == n2), (d1 == d2))
                self.assertEqual((n1 != n2), (d1 != d2))

    def test_compare_tuple(self):
        from psycopg2.extensions import Notify
        self.assertEqual((10, 'foo'), Notify(10, 'foo'))
        self.assertEqual((10, 'foo'), Notify(10, 'foo', 'bar'))
        self.assertNotEqual((10, 'foo'), Notify(20, 'foo'))
        self.assertNotEqual((10, 'foo'), Notify(10, 'bar'))

    def test_hash(self):
        from psycopg2.extensions import Notify
        self.assertEqual(hash((10, 'foo')), hash(Notify(10, 'foo')))
        self.assertNotEqual(hash(Notify(10, 'foo', 'bar')),
            hash(Notify(10, 'foo')))


def test_suite():
    return unittest.TestLoader().loadTestsFromName(__name__)


if __name__ == "__main__":
    unittest.main()

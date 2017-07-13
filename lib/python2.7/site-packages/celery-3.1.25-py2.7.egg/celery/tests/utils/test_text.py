from __future__ import absolute_import

from celery.utils.text import (
    indent,
    ensure_2lines,
    abbr,
    truncate,
    abbrtask,
    pretty,
)
from celery.tests.case import AppCase, Case

RANDTEXT = """\
The quick brown
fox jumps
over the
lazy dog\
"""

RANDTEXT_RES = """\
    The quick brown
    fox jumps
    over the
    lazy dog\
"""

QUEUES = {
    'queue1': {
        'exchange': 'exchange1',
        'exchange_type': 'type1',
        'routing_key': 'bind1',
    },
    'queue2': {
        'exchange': 'exchange2',
        'exchange_type': 'type2',
        'routing_key': 'bind2',
    },
}


QUEUE_FORMAT1 = '.> queue1           exchange=exchange1(type1) key=bind1'
QUEUE_FORMAT2 = '.> queue2           exchange=exchange2(type2) key=bind2'


class test_Info(AppCase):

    def test_textindent(self):
        self.assertEqual(indent(RANDTEXT, 4), RANDTEXT_RES)

    def test_format_queues(self):
        self.app.amqp.queues = self.app.amqp.Queues(QUEUES)
        self.assertEqual(sorted(self.app.amqp.queues.format().split('\n')),
                         sorted([QUEUE_FORMAT1, QUEUE_FORMAT2]))

    def test_ensure_2lines(self):
        self.assertEqual(
            len(ensure_2lines('foo\nbar\nbaz\n').splitlines()), 3,
        )
        self.assertEqual(
            len(ensure_2lines('foo\nbar').splitlines()), 2,
        )


class test_utils(Case):

    def test_truncate_text(self):
        self.assertEqual(truncate('ABCDEFGHI', 3), 'ABC...')
        self.assertEqual(truncate('ABCDEFGHI', 10), 'ABCDEFGHI')

    def test_abbr(self):
        self.assertEqual(abbr(None, 3), '???')
        self.assertEqual(abbr('ABCDEFGHI', 6), 'ABC...')
        self.assertEqual(abbr('ABCDEFGHI', 20), 'ABCDEFGHI')
        self.assertEqual(abbr('ABCDEFGHI', 6, None), 'ABCDEF')

    def test_abbrtask(self):
        self.assertEqual(abbrtask(None, 3), '???')
        self.assertEqual(
            abbrtask('feeds.tasks.refresh', 10),
            '[.]refresh',
        )
        self.assertEqual(
            abbrtask('feeds.tasks.refresh', 30),
            'feeds.tasks.refresh',
        )

    def test_pretty(self):
        self.assertTrue(pretty(('a', 'b', 'c')))

from __future__ import absolute_import

from kombu.five import items
from kombu.utils import reprcall
from kombu.utils.eventio import READ, WRITE, ERR


def repr_flag(flag):
    return '{0}{1}{2}'.format('R' if flag & READ else '',
                              'W' if flag & WRITE else '',
                              '!' if flag & ERR else '')


def _rcb(obj):
    if obj is None:
        return '<missing>'
    if isinstance(obj, str):
        return obj
    if isinstance(obj, tuple):
        cb, args = obj
        return reprcall(cb.__name__, args=args)
    return obj.__name__


def repr_active(h):
    return ', '.join(repr_readers(h) + repr_writers(h))


def repr_events(h, events):
    return ', '.join(
        '{0}({1})->{2}'.format(
            _rcb(callback_for(h, fd, fl, '(GONE)')), fd,
            repr_flag(fl),
        )
        for fd, fl in events
    )


def repr_readers(h):
    return ['({0}){1}->{2}'.format(fd, _rcb(cb), repr_flag(READ | ERR))
            for fd, cb in items(h.readers)]


def repr_writers(h):
    return ['({0}){1}->{2}'.format(fd, _rcb(cb), repr_flag(WRITE))
            for fd, cb in items(h.writers)]


def callback_for(h, fd, flag, *default):
    try:
        if flag & READ:
            return h.readers[fd]
        if flag & WRITE:
            if fd in h.consolidate:
                return h.consolidate_callback
            return h.writers[fd]
    except KeyError:
        if default:
            return default[0]
        raise

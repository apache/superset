# -*- coding: utf-8 -*-
from functools import total_ordering

from .. import i18n
from ..utils import str_coercible


@str_coercible
@total_ordering
class WeekDay(object):
    NUM_WEEK_DAYS = 7

    def __init__(self, index):
        if not (0 <= index < self.NUM_WEEK_DAYS):
            raise ValueError(
                "index must be between 0 and %d" % self.NUM_WEEK_DAYS
            )
        self.index = index

    def __eq__(self, other):
        if isinstance(other, WeekDay):
            return self.index == other.index
        else:
            return NotImplemented

    def __hash__(self):
        return hash(self.index)

    def __lt__(self, other):
        return self.position < other.position

    def __repr__(self):
        return '%s(%r)' % (self.__class__.__name__, self.index)

    def __unicode__(self):
        return self.name

    def get_name(self, width='wide', context='format'):
        names = i18n.babel.dates.get_day_names(
            width,
            context,
            i18n.get_locale()
        )
        return names[self.index]

    @property
    def name(self):
        return self.get_name()

    @property
    def position(self):
        return (
            self.index -
            i18n.get_locale().first_week_day
        ) % self.NUM_WEEK_DAYS

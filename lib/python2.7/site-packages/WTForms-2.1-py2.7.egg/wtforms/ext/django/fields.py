"""
Useful form fields for use with the Django ORM.
"""
from __future__ import unicode_literals

import datetime
import operator

try:
    from django.conf import settings
    from django.utils import timezone
    has_timezone = True
except ImportError:
    has_timezone = False

from wtforms import fields, widgets
from wtforms.compat import string_types
from wtforms.validators import ValidationError

__all__ = (
    'ModelSelectField', 'QuerySetSelectField', 'DateTimeField'
)


class QuerySetSelectField(fields.SelectFieldBase):
    """
    Given a QuerySet either at initialization or inside a view, will display a
    select drop-down field of choices. The `data` property actually will
    store/keep an ORM model instance, not the ID. Submitting a choice which is
    not in the queryset will result in a validation error.

    Specify `get_label` to customize the label associated with each option. If
    a string, this is the name of an attribute on the model object to use as
    the label text. If a one-argument callable, this callable will be passed
    model instance and expected to return the label text. Otherwise, the model
    object's `__str__` or `__unicode__` will be used.

    If `allow_blank` is set to `True`, then a blank choice will be added to the
    top of the list. Selecting this choice will result in the `data` property
    being `None`.  The label for the blank choice can be set by specifying the
    `blank_text` parameter.
    """
    widget = widgets.Select()

    def __init__(self, label=None, validators=None, queryset=None, get_label=None, allow_blank=False, blank_text='', **kwargs):
        super(QuerySetSelectField, self).__init__(label, validators, **kwargs)
        self.allow_blank = allow_blank
        self.blank_text = blank_text
        self._set_data(None)
        if queryset is not None:
            self.queryset = queryset.all()  # Make sure the queryset is fresh

        if get_label is None:
            self.get_label = lambda x: x
        elif isinstance(get_label, string_types):
            self.get_label = operator.attrgetter(get_label)
        else:
            self.get_label = get_label

    def _get_data(self):
        if self._formdata is not None:
            for obj in self.queryset:
                if obj.pk == self._formdata:
                    self._set_data(obj)
                    break
        return self._data

    def _set_data(self, data):
        self._data = data
        self._formdata = None

    data = property(_get_data, _set_data)

    def iter_choices(self):
        if self.allow_blank:
            yield ('__None', self.blank_text, self.data is None)

        for obj in self.queryset:
            yield (obj.pk, self.get_label(obj), obj == self.data)

    def process_formdata(self, valuelist):
        if valuelist:
            if valuelist[0] == '__None':
                self.data = None
            else:
                self._data = None
                self._formdata = int(valuelist[0])

    def pre_validate(self, form):
        if not self.allow_blank or self.data is not None:
            for obj in self.queryset:
                if self.data == obj:
                    break
            else:
                raise ValidationError(self.gettext('Not a valid choice'))


class ModelSelectField(QuerySetSelectField):
    """
    Like a QuerySetSelectField, except takes a model class instead of a
    queryset and lists everything in it.
    """
    def __init__(self, label=None, validators=None, model=None, **kwargs):
        super(ModelSelectField, self).__init__(label, validators, queryset=model._default_manager.all(), **kwargs)


class DateTimeField(fields.DateTimeField):
    """
    Adds support for Django's timezone utilities.
    Requires Django >= 1.5
    """
    def __init__(self, *args, **kwargs):
        if not has_timezone:
            raise ImportError('DateTimeField requires Django >= 1.5')

        super(DateTimeField, self).__init__(*args, **kwargs)

    def process_formdata(self, valuelist):
        super(DateTimeField, self).process_formdata(valuelist)

        date = self.data

        if settings.USE_TZ and date is not None and timezone.is_naive(date):
            current_timezone = timezone.get_current_timezone()
            self.data = timezone.make_aware(date, current_timezone)

    def _value(self):
        date = self.data

        if settings.USE_TZ and isinstance(date, datetime.datetime) and timezone.is_aware(date):
            self.data = timezone.localtime(date)

        return super(DateTimeField, self)._value()

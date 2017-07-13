"""
A DateTimeField and DateField that use the `dateutil` package for parsing.
"""
from __future__ import unicode_literals

from dateutil import parser

from wtforms.fields import Field
from wtforms.validators import ValidationError
from wtforms.widgets import TextInput


__all__ = (
    'DateTimeField', 'DateField',
)


# This is a fix to handle issues in dateutil which arose in version 2.2.
# A bug ticket is filed: https://bugs.launchpad.net/dateutil/+bug/1247643
try:
    parser.parse('foobar')
except TypeError:
    DATEUTIL_TYPEERROR_ISSUE = True
except ValueError:
    DATEUTIL_TYPEERROR_ISSUE = False
else:
    import warnings
    warnings.warn('In testing for a dateutil issue, we ran into a very strange error.', ImportWarning)


class DateTimeField(Field):
    """
    DateTimeField represented by a text input, accepts all input text formats
    that `dateutil.parser.parse` will.

    :param parse_kwargs:
        A dictionary of keyword args to pass to the dateutil parse() function.
        See dateutil docs for available keywords.
    :param display_format:
        A format string to pass to strftime() to format dates for display.
    """
    widget = TextInput()

    def __init__(self, label=None, validators=None, parse_kwargs=None,
                 display_format='%Y-%m-%d %H:%M', **kwargs):
        super(DateTimeField, self).__init__(label, validators, **kwargs)
        if parse_kwargs is None:
            parse_kwargs = {}
        self.parse_kwargs = parse_kwargs
        self.display_format = display_format

    def _value(self):
        if self.raw_data:
            return ' '.join(self.raw_data)
        else:
            return self.data and self.data.strftime(self.display_format) or ''

    def process_formdata(self, valuelist):
        if valuelist:
            date_str = ' '.join(valuelist)
            if not date_str:
                self.data = None
                raise ValidationError(self.gettext('Please input a date/time value'))

            parse_kwargs = self.parse_kwargs.copy()
            if 'default' not in parse_kwargs:
                try:
                    parse_kwargs['default'] = self.default()
                except TypeError:
                    parse_kwargs['default'] = self.default
            try:
                self.data = parser.parse(date_str, **parse_kwargs)
            except ValueError:
                self.data = None
                raise ValidationError(self.gettext('Invalid date/time input'))
            except TypeError:
                if not DATEUTIL_TYPEERROR_ISSUE:
                    raise

                # If we're using dateutil 2.2, then consider it a normal
                # ValidationError. Hopefully dateutil fixes this issue soon.
                self.data = None
                raise ValidationError(self.gettext('Invalid date/time input'))


class DateField(DateTimeField):
    """
    Same as the DateTimeField, but stores only the date portion.
    """
    def __init__(self, label=None, validators=None, parse_kwargs=None,
                 display_format='%Y-%m-%d', **kwargs):
        super(DateField, self).__init__(label, validators, parse_kwargs=parse_kwargs, display_format=display_format, **kwargs)

    def process_formdata(self, valuelist):
        super(DateField, self).process_formdata(valuelist)
        if self.data is not None and hasattr(self.data, 'date'):
            self.data = self.data.date()

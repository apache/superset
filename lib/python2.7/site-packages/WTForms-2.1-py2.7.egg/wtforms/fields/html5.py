"""
Fields to support various HTML5 input types.
"""
from ..widgets import html5 as widgets
from . import core

__all__ = (
    'DateField', 'DateTimeField', 'DateTimeLocalField', 'DecimalField',
    'DecimalRangeField', 'EmailField', 'IntegerField', 'IntegerRangeField',
    'SearchField', 'TelField', 'URLField',
)


class SearchField(core.StringField):
    """
    Represents an ``<input type="search">``.
    """
    widget = widgets.SearchInput()


class TelField(core.StringField):
    """
    Represents an ``<input type="tel">``.
    """
    widget = widgets.TelInput()


class URLField(core.StringField):
    """
    Represents an ``<input type="url">``.
    """
    widget = widgets.URLInput()


class EmailField(core.StringField):
    """
    Represents an ``<input type="email">``.
    """
    widget = widgets.EmailInput()


class DateTimeField(core.DateTimeField):
    """
    Represents an ``<input type="datetime">``.
    """
    widget = widgets.DateTimeInput()


class DateField(core.DateField):
    """
    Represents an ``<input type="date">``.
    """
    widget = widgets.DateInput()


class DateTimeLocalField(core.DateTimeField):
    """
    Represents an ``<input type="datetime-local">``.
    """
    widget = widgets.DateTimeLocalInput()


class IntegerField(core.IntegerField):
    """
    Represents an ``<input type="number">``.
    """
    widget = widgets.NumberInput(step='1')


class DecimalField(core.DecimalField):
    """
    Represents an ``<input type="number">``.
    """
    widget = widgets.NumberInput(step='any')


class IntegerRangeField(core.IntegerField):
    """
    Represents an ``<input type="range">``.
    """
    widget = widgets.RangeInput(step='1')


class DecimalRangeField(core.DecimalField):
    """
    Represents an ``<input type="range">``.
    """
    widget = widgets.RangeInput(step='any')

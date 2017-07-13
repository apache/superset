"""
Widgets for various HTML5 input types.
"""

from .core import Input

__all__ = (
    'ColorInput', 'DateInput', 'DateTimeInput', 'DateTimeLocalInput',
    'EmailInput', 'MonthInput', 'NumberInput', 'RangeInput', 'SearchInput',
    'TelInput', 'TimeInput', 'URLInput', 'WeekInput',
)


class SearchInput(Input):
    """
    Renders an input with type "search".
    """
    input_type = 'search'


class TelInput(Input):
    """
    Renders an input with type "tel".
    """
    input_type = 'tel'


class URLInput(Input):
    """
    Renders an input with type "url".
    """
    input_type = 'url'


class EmailInput(Input):
    """
    Renders an input with type "email".
    """
    input_type = 'email'


class DateTimeInput(Input):
    """
    Renders an input with type "datetime".
    """
    input_type = 'datetime'


class DateInput(Input):
    """
    Renders an input with type "date".
    """
    input_type = 'date'


class MonthInput(Input):
    """
    Renders an input with type "month".
    """
    input_type = 'month'


class WeekInput(Input):
    """
    Renders an input with type "week".
    """
    input_type = 'week'


class TimeInput(Input):
    """
    Renders an input with type "time".
    """
    input_type = 'time'


class DateTimeLocalInput(Input):
    """
    Renders an input with type "datetime-local".
    """
    input_type = 'datetime-local'


class NumberInput(Input):
    """
    Renders an input with type "number".
    """
    input_type = 'number'

    def __init__(self, step=None, min=None, max=None):
        self.step = step
        self.min = min
        self.max = max

    def __call__(self, field, **kwargs):
        if self.step is not None:
            kwargs.setdefault('step', self.step)
        if self.min is not None:
            kwargs.setdefault('min', self.min)
        if self.max is not None:
            kwargs.setdefault('max', self.max)
        return super(NumberInput, self).__call__(field, **kwargs)


class RangeInput(Input):
    """
    Renders an input with type "range".
    """
    input_type = 'range'

    def __init__(self, step=None):
        self.step = step

    def __call__(self, field, **kwargs):
        if self.step is not None:
            kwargs.setdefault('step', self.step)
        return super(RangeInput, self).__call__(field, **kwargs)


class ColorInput(Input):
    """
    Renders an input with type "color".
    """
    input_type = 'color'

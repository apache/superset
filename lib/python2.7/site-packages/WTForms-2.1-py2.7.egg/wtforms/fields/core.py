from __future__ import unicode_literals

import datetime
import decimal
import itertools

from wtforms import widgets
from wtforms.compat import text_type, izip
from wtforms.i18n import DummyTranslations
from wtforms.validators import StopValidation
from wtforms.utils import unset_value


__all__ = (
    'BooleanField', 'DecimalField', 'DateField', 'DateTimeField', 'FieldList',
    'FloatField', 'FormField', 'IntegerField', 'RadioField', 'SelectField',
    'SelectMultipleField', 'StringField',
)


class Field(object):
    """
    Field base class
    """
    errors = tuple()
    process_errors = tuple()
    raw_data = None
    validators = tuple()
    widget = None
    _formfield = True
    _translations = DummyTranslations()
    do_not_call_in_templates = True  # Allow Django 1.4 traversal

    def __new__(cls, *args, **kwargs):
        if '_form' in kwargs and '_name' in kwargs:
            return super(Field, cls).__new__(cls)
        else:
            return UnboundField(cls, *args, **kwargs)

    def __init__(self, label=None, validators=None, filters=tuple(),
                 description='', id=None, default=None, widget=None,
                 render_kw=None, _form=None, _name=None, _prefix='',
                 _translations=None, _meta=None):
        """
        Construct a new field.

        :param label:
            The label of the field.
        :param validators:
            A sequence of validators to call when `validate` is called.
        :param filters:
            A sequence of filters which are run on input data by `process`.
        :param description:
            A description for the field, typically used for help text.
        :param id:
            An id to use for the field. A reasonable default is set by the form,
            and you shouldn't need to set this manually.
        :param default:
            The default value to assign to the field, if no form or object
            input is provided. May be a callable.
        :param widget:
            If provided, overrides the widget used to render the field.
        :param dict render_kw:
            If provided, a dictionary which provides default keywords that
            will be given to the widget at render time.
        :param _form:
            The form holding this field. It is passed by the form itself during
            construction. You should never pass this value yourself.
        :param _name:
            The name of this field, passed by the enclosing form during its
            construction. You should never pass this value yourself.
        :param _prefix:
            The prefix to prepend to the form name of this field, passed by
            the enclosing form during construction.
        :param _translations:
            A translations object providing message translations. Usually
            passed by the enclosing form during construction. See
            :doc:`I18n docs <i18n>` for information on message translations.
        :param _meta:
            If provided, this is the 'meta' instance from the form. You usually
            don't pass this yourself.

        If `_form` and `_name` isn't provided, an :class:`UnboundField` will be
        returned instead. Call its :func:`bind` method with a form instance and
        a name to construct the field.
        """
        if _translations is not None:
            self._translations = _translations

        if _meta is not None:
            self.meta = _meta
        elif _form is not None:
            self.meta = _form.meta
        else:
            raise TypeError("Must provide one of _form or _meta")

        self.default = default
        self.description = description
        self.render_kw = render_kw
        self.filters = filters
        self.flags = Flags()
        self.name = _prefix + _name
        self.short_name = _name
        self.type = type(self).__name__
        self.validators = validators or list(self.validators)

        self.id = id or self.name
        self.label = Label(self.id, label if label is not None else self.gettext(_name.replace('_', ' ').title()))

        if widget is not None:
            self.widget = widget

        for v in itertools.chain(self.validators, [self.widget]):
            flags = getattr(v, 'field_flags', ())
            for f in flags:
                setattr(self.flags, f, True)

    def __unicode__(self):
        """
        Returns a HTML representation of the field. For more powerful rendering,
        see the `__call__` method.
        """
        return self()

    def __str__(self):
        """
        Returns a HTML representation of the field. For more powerful rendering,
        see the `__call__` method.
        """
        return self()

    def __html__(self):
        """
        Returns a HTML representation of the field. For more powerful rendering,
        see the :meth:`__call__` method.
        """
        return self()

    def __call__(self, **kwargs):
        """
        Render this field as HTML, using keyword args as additional attributes.

        This delegates rendering to
        :meth:`meta.render_field <wtforms.meta.DefaultMeta.render_field>`
        whose default behavior is to call the field's widget, passing any
        keyword arguments from this call along to the widget.

        In all of the WTForms HTML widgets, keyword arguments are turned to
        HTML attributes, though in theory a widget is free to do anything it
        wants with the supplied keyword arguments, and widgets don't have to
        even do anything related to HTML.
        """
        return self.meta.render_field(self, kwargs)

    def gettext(self, string):
        """
        Get a translation for the given message.

        This proxies for the internal translations object.

        :param string: A unicode string to be translated.
        :return: A unicode string which is the translated output.
        """
        return self._translations.gettext(string)

    def ngettext(self, singular, plural, n):
        """
        Get a translation for a message which can be pluralized.

        :param str singular: The singular form of the message.
        :param str plural: The plural form of the message.
        :param int n: The number of elements this message is referring to
        """
        return self._translations.ngettext(singular, plural, n)

    def validate(self, form, extra_validators=tuple()):
        """
        Validates the field and returns True or False. `self.errors` will
        contain any errors raised during validation. This is usually only
        called by `Form.validate`.

        Subfields shouldn't override this, but rather override either
        `pre_validate`, `post_validate` or both, depending on needs.

        :param form: The form the field belongs to.
        :param extra_validators: A sequence of extra validators to run.
        """
        self.errors = list(self.process_errors)
        stop_validation = False

        # Call pre_validate
        try:
            self.pre_validate(form)
        except StopValidation as e:
            if e.args and e.args[0]:
                self.errors.append(e.args[0])
            stop_validation = True
        except ValueError as e:
            self.errors.append(e.args[0])

        # Run validators
        if not stop_validation:
            chain = itertools.chain(self.validators, extra_validators)
            stop_validation = self._run_validation_chain(form, chain)

        # Call post_validate
        try:
            self.post_validate(form, stop_validation)
        except ValueError as e:
            self.errors.append(e.args[0])

        return len(self.errors) == 0

    def _run_validation_chain(self, form, validators):
        """
        Run a validation chain, stopping if any validator raises StopValidation.

        :param form: The Form instance this field beongs to.
        :param validators: a sequence or iterable of validator callables.
        :return: True if validation was stopped, False otherwise.
        """
        for validator in validators:
            try:
                validator(form, self)
            except StopValidation as e:
                if e.args and e.args[0]:
                    self.errors.append(e.args[0])
                return True
            except ValueError as e:
                self.errors.append(e.args[0])

        return False

    def pre_validate(self, form):
        """
        Override if you need field-level validation. Runs before any other
        validators.

        :param form: The form the field belongs to.
        """
        pass

    def post_validate(self, form, validation_stopped):
        """
        Override if you need to run any field-level validation tasks after
        normal validation. This shouldn't be needed in most cases.

        :param form: The form the field belongs to.
        :param validation_stopped:
            `True` if any validator raised StopValidation.
        """
        pass

    def process(self, formdata, data=unset_value):
        """
        Process incoming data, calling process_data, process_formdata as needed,
        and run filters.

        If `data` is not provided, process_data will be called on the field's
        default.

        Field subclasses usually won't override this, instead overriding the
        process_formdata and process_data methods. Only override this for
        special advanced processing, such as when a field encapsulates many
        inputs.
        """
        self.process_errors = []
        if data is unset_value:
            try:
                data = self.default()
            except TypeError:
                data = self.default

        self.object_data = data

        try:
            self.process_data(data)
        except ValueError as e:
            self.process_errors.append(e.args[0])

        if formdata:
            try:
                if self.name in formdata:
                    self.raw_data = formdata.getlist(self.name)
                else:
                    self.raw_data = []
                self.process_formdata(self.raw_data)
            except ValueError as e:
                self.process_errors.append(e.args[0])

        try:
            for filter in self.filters:
                self.data = filter(self.data)
        except ValueError as e:
            self.process_errors.append(e.args[0])

    def process_data(self, value):
        """
        Process the Python data applied to this field and store the result.

        This will be called during form construction by the form's `kwargs` or
        `obj` argument.

        :param value: The python object containing the value to process.
        """
        self.data = value

    def process_formdata(self, valuelist):
        """
        Process data received over the wire from a form.

        This will be called during form construction with data supplied
        through the `formdata` argument.

        :param valuelist: A list of strings to process.
        """
        if valuelist:
            self.data = valuelist[0]

    def populate_obj(self, obj, name):
        """
        Populates `obj.<name>` with the field's data.

        :note: This is a destructive operation. If `obj.<name>` already exists,
               it will be overridden. Use with caution.
        """
        setattr(obj, name, self.data)


class UnboundField(object):
    _formfield = True
    creation_counter = 0

    def __init__(self, field_class, *args, **kwargs):
        UnboundField.creation_counter += 1
        self.field_class = field_class
        self.args = args
        self.kwargs = kwargs
        self.creation_counter = UnboundField.creation_counter

    def bind(self, form, name, prefix='', translations=None, **kwargs):
        kw = dict(
            self.kwargs,
            _form=form,
            _prefix=prefix,
            _name=name,
            _translations=translations,
            **kwargs
        )
        return self.field_class(*self.args, **kw)

    def __repr__(self):
        return '<UnboundField(%s, %r, %r)>' % (self.field_class.__name__, self.args, self.kwargs)


class Flags(object):
    """
    Holds a set of boolean flags as attributes.

    Accessing a non-existing attribute returns False for its value.
    """
    def __getattr__(self, name):
        if name.startswith('_'):
            return super(Flags, self).__getattr__(name)
        return False

    def __contains__(self, name):
        return getattr(self, name)

    def __repr__(self):
        flags = (name for name in dir(self) if not name.startswith('_'))
        return '<wtforms.fields.Flags: {%s}>' % ', '.join(flags)


class Label(object):
    """
    An HTML form label.
    """
    def __init__(self, field_id, text):
        self.field_id = field_id
        self.text = text

    def __str__(self):
        return self()

    def __unicode__(self):
        return self()

    def __html__(self):
        return self()

    def __call__(self, text=None, **kwargs):
        if 'for_' in kwargs:
            kwargs['for'] = kwargs.pop('for_')
        else:
            kwargs.setdefault('for', self.field_id)

        attributes = widgets.html_params(**kwargs)
        return widgets.HTMLString('<label %s>%s</label>' % (attributes, text or self.text))

    def __repr__(self):
        return 'Label(%r, %r)' % (self.field_id, self.text)


class SelectFieldBase(Field):
    option_widget = widgets.Option()

    """
    Base class for fields which can be iterated to produce options.

    This isn't a field, but an abstract base class for fields which want to
    provide this functionality.
    """
    def __init__(self, label=None, validators=None, option_widget=None, **kwargs):
        super(SelectFieldBase, self).__init__(label, validators, **kwargs)

        if option_widget is not None:
            self.option_widget = option_widget

    def iter_choices(self):
        """
        Provides data for choice widget rendering. Must return a sequence or
        iterable of (value, label, selected) tuples.
        """
        raise NotImplementedError()

    def __iter__(self):
        opts = dict(widget=self.option_widget, _name=self.name, _form=None, _meta=self.meta)
        for i, (value, label, checked) in enumerate(self.iter_choices()):
            opt = self._Option(label=label, id='%s-%d' % (self.id, i), **opts)
            opt.process(None, value)
            opt.checked = checked
            yield opt

    class _Option(Field):
        checked = False

        def _value(self):
            return text_type(self.data)


class SelectField(SelectFieldBase):
    widget = widgets.Select()

    def __init__(self, label=None, validators=None, coerce=text_type, choices=None, **kwargs):
        super(SelectField, self).__init__(label, validators, **kwargs)
        self.coerce = coerce
        self.choices = choices

    def iter_choices(self):
        for value, label in self.choices:
            yield (value, label, self.coerce(value) == self.data)

    def process_data(self, value):
        try:
            self.data = self.coerce(value)
        except (ValueError, TypeError):
            self.data = None

    def process_formdata(self, valuelist):
        if valuelist:
            try:
                self.data = self.coerce(valuelist[0])
            except ValueError:
                raise ValueError(self.gettext('Invalid Choice: could not coerce'))

    def pre_validate(self, form):
        for v, _ in self.choices:
            if self.data == v:
                break
        else:
            raise ValueError(self.gettext('Not a valid choice'))


class SelectMultipleField(SelectField):
    """
    No different from a normal select field, except this one can take (and
    validate) multiple choices.  You'll need to specify the HTML `size`
    attribute to the select field when rendering.
    """
    widget = widgets.Select(multiple=True)

    def iter_choices(self):
        for value, label in self.choices:
            selected = self.data is not None and self.coerce(value) in self.data
            yield (value, label, selected)

    def process_data(self, value):
        try:
            self.data = list(self.coerce(v) for v in value)
        except (ValueError, TypeError):
            self.data = None

    def process_formdata(self, valuelist):
        try:
            self.data = list(self.coerce(x) for x in valuelist)
        except ValueError:
            raise ValueError(self.gettext('Invalid choice(s): one or more data inputs could not be coerced'))

    def pre_validate(self, form):
        if self.data:
            values = list(c[0] for c in self.choices)
            for d in self.data:
                if d not in values:
                    raise ValueError(self.gettext("'%(value)s' is not a valid choice for this field") % dict(value=d))


class RadioField(SelectField):
    """
    Like a SelectField, except displays a list of radio buttons.

    Iterating the field will produce subfields (each containing a label as
    well) in order to allow custom rendering of the individual radio fields.
    """
    widget = widgets.ListWidget(prefix_label=False)
    option_widget = widgets.RadioInput()


class StringField(Field):
    """
    This field is the base for most of the more complicated fields, and
    represents an ``<input type="text">``.
    """
    widget = widgets.TextInput()

    def process_formdata(self, valuelist):
        if valuelist:
            self.data = valuelist[0]
        else:
            self.data = ''

    def _value(self):
        return text_type(self.data) if self.data is not None else ''


class LocaleAwareNumberField(Field):
    """
    Base class for implementing locale-aware number parsing.

    Locale-aware numbers require the 'babel' package to be present.
    """
    def __init__(self, label=None, validators=None, use_locale=False, number_format=None, **kwargs):
        super(LocaleAwareNumberField, self).__init__(label, validators, **kwargs)
        self.use_locale = use_locale
        if use_locale:
            self.number_format = number_format
            self.locale = kwargs['_form'].meta.locales[0]
            self._init_babel()

    def _init_babel(self):
        try:
            from babel import numbers
            self.babel_numbers = numbers
        except ImportError:
            raise ImportError('Using locale-aware decimals requires the babel library.')

    def _parse_decimal(self, value):
        return self.babel_numbers.parse_decimal(value, self.locale)

    def _format_decimal(self, value):
        return self.babel_numbers.format_decimal(value, self.number_format, self.locale)


class IntegerField(Field):
    """
    A text field, except all input is coerced to an integer.  Erroneous input
    is ignored and will not be accepted as a value.
    """
    widget = widgets.TextInput()

    def __init__(self, label=None, validators=None, **kwargs):
        super(IntegerField, self).__init__(label, validators, **kwargs)

    def _value(self):
        if self.raw_data:
            return self.raw_data[0]
        elif self.data is not None:
            return text_type(self.data)
        else:
            return ''

    def process_formdata(self, valuelist):
        if valuelist:
            try:
                self.data = int(valuelist[0])
            except ValueError:
                self.data = None
                raise ValueError(self.gettext('Not a valid integer value'))


class DecimalField(LocaleAwareNumberField):
    """
    A text field which displays and coerces data of the `decimal.Decimal` type.

    :param places:
        How many decimal places to quantize the value to for display on form.
        If None, does not quantize value.
    :param rounding:
        How to round the value during quantize, for example
        `decimal.ROUND_UP`. If unset, uses the rounding value from the
        current thread's context.
    :param use_locale:
        If True, use locale-based number formatting. Locale-based number
        formatting requires the 'babel' package.
    :param number_format:
        Optional number format for locale. If omitted, use the default decimal
        format for the locale.
    """
    widget = widgets.TextInput()

    def __init__(self, label=None, validators=None, places=unset_value, rounding=None, **kwargs):
        super(DecimalField, self).__init__(label, validators, **kwargs)
        if self.use_locale and (places is not unset_value or rounding is not None):
            raise TypeError("When using locale-aware numbers, 'places' and 'rounding' are ignored.")

        if places is unset_value:
            places = 2
        self.places = places
        self.rounding = rounding

    def _value(self):
        if self.raw_data:
            return self.raw_data[0]
        elif self.data is not None:
            if self.use_locale:
                return text_type(self._format_decimal(self.data))
            elif self.places is not None:
                if hasattr(self.data, 'quantize'):
                    exp = decimal.Decimal('.1') ** self.places
                    if self.rounding is None:
                        quantized = self.data.quantize(exp)
                    else:
                        quantized = self.data.quantize(exp, rounding=self.rounding)
                    return text_type(quantized)
                else:
                    # If for some reason, data is a float or int, then format
                    # as we would for floats using string formatting.
                    format = '%%0.%df' % self.places
                    return format % self.data
            else:
                return text_type(self.data)
        else:
            return ''

    def process_formdata(self, valuelist):
        if valuelist:
            try:
                if self.use_locale:
                    self.data = self._parse_decimal(valuelist[0])
                else:
                    self.data = decimal.Decimal(valuelist[0])
            except (decimal.InvalidOperation, ValueError):
                self.data = None
                raise ValueError(self.gettext('Not a valid decimal value'))


class FloatField(Field):
    """
    A text field, except all input is coerced to an float.  Erroneous input
    is ignored and will not be accepted as a value.
    """
    widget = widgets.TextInput()

    def __init__(self, label=None, validators=None, **kwargs):
        super(FloatField, self).__init__(label, validators, **kwargs)

    def _value(self):
        if self.raw_data:
            return self.raw_data[0]
        elif self.data is not None:
            return text_type(self.data)
        else:
            return ''

    def process_formdata(self, valuelist):
        if valuelist:
            try:
                self.data = float(valuelist[0])
            except ValueError:
                self.data = None
                raise ValueError(self.gettext('Not a valid float value'))


class BooleanField(Field):
    """
    Represents an ``<input type="checkbox">``. Set the ``checked``-status by using the
    ``default``-option. Any value for ``default``, e.g. ``default="checked"`` puts
    ``checked`` into the html-element and sets the ``data`` to ``True``

    :param false_values:
        If provided, a sequence of strings each of which is an exact match
        string of what is considered a "false" value. Defaults to the tuple
        ``('false', '')``
    """
    widget = widgets.CheckboxInput()
    false_values = ('false', '')

    def __init__(self, label=None, validators=None, false_values=None, **kwargs):
        super(BooleanField, self).__init__(label, validators, **kwargs)
        if false_values is not None:
            self.false_values = false_values

    def process_data(self, value):
        self.data = bool(value)

    def process_formdata(self, valuelist):
        if not valuelist or valuelist[0] in self.false_values:
            self.data = False
        else:
            self.data = True

    def _value(self):
        if self.raw_data:
            return text_type(self.raw_data[0])
        else:
            return 'y'


class DateTimeField(Field):
    """
    A text field which stores a `datetime.datetime` matching a format.
    """
    widget = widgets.TextInput()

    def __init__(self, label=None, validators=None, format='%Y-%m-%d %H:%M:%S', **kwargs):
        super(DateTimeField, self).__init__(label, validators, **kwargs)
        self.format = format

    def _value(self):
        if self.raw_data:
            return ' '.join(self.raw_data)
        else:
            return self.data and self.data.strftime(self.format) or ''

    def process_formdata(self, valuelist):
        if valuelist:
            date_str = ' '.join(valuelist)
            try:
                self.data = datetime.datetime.strptime(date_str, self.format)
            except ValueError:
                self.data = None
                raise ValueError(self.gettext('Not a valid datetime value'))


class DateField(DateTimeField):
    """
    Same as DateTimeField, except stores a `datetime.date`.
    """
    def __init__(self, label=None, validators=None, format='%Y-%m-%d', **kwargs):
        super(DateField, self).__init__(label, validators, format, **kwargs)

    def process_formdata(self, valuelist):
        if valuelist:
            date_str = ' '.join(valuelist)
            try:
                self.data = datetime.datetime.strptime(date_str, self.format).date()
            except ValueError:
                self.data = None
                raise ValueError(self.gettext('Not a valid date value'))


class FormField(Field):
    """
    Encapsulate a form as a field in another form.

    :param form_class:
        A subclass of Form that will be encapsulated.
    :param separator:
        A string which will be suffixed to this field's name to create the
        prefix to enclosed fields. The default is fine for most uses.
    """
    widget = widgets.TableWidget()

    def __init__(self, form_class, label=None, validators=None, separator='-', **kwargs):
        super(FormField, self).__init__(label, validators, **kwargs)
        self.form_class = form_class
        self.separator = separator
        self._obj = None
        if self.filters:
            raise TypeError('FormField cannot take filters, as the encapsulated data is not mutable.')
        if validators:
            raise TypeError('FormField does not accept any validators. Instead, define them on the enclosed form.')

    def process(self, formdata, data=unset_value):
        if data is unset_value:
            try:
                data = self.default()
            except TypeError:
                data = self.default
            self._obj = data

        self.object_data = data

        prefix = self.name + self.separator
        if isinstance(data, dict):
            self.form = self.form_class(formdata=formdata, prefix=prefix, **data)
        else:
            self.form = self.form_class(formdata=formdata, obj=data, prefix=prefix)

    def validate(self, form, extra_validators=tuple()):
        if extra_validators:
            raise TypeError('FormField does not accept in-line validators, as it gets errors from the enclosed form.')
        return self.form.validate()

    def populate_obj(self, obj, name):
        candidate = getattr(obj, name, None)
        if candidate is None:
            if self._obj is None:
                raise TypeError('populate_obj: cannot find a value to populate from the provided obj or input data/defaults')
            candidate = self._obj
            setattr(obj, name, candidate)

        self.form.populate_obj(candidate)

    def __iter__(self):
        return iter(self.form)

    def __getitem__(self, name):
        return self.form[name]

    def __getattr__(self, name):
        return getattr(self.form, name)

    @property
    def data(self):
        return self.form.data

    @property
    def errors(self):
        return self.form.errors


class FieldList(Field):
    """
    Encapsulate an ordered list of multiple instances of the same field type,
    keeping data as a list.

    >>> authors = FieldList(StringField('Name', [validators.required()]))

    :param unbound_field:
        A partially-instantiated field definition, just like that would be
        defined on a form directly.
    :param min_entries:
        if provided, always have at least this many entries on the field,
        creating blank ones if the provided input does not specify a sufficient
        amount.
    :param max_entries:
        accept no more than this many entries as input, even if more exist in
        formdata.
    """
    widget = widgets.ListWidget()

    def __init__(self, unbound_field, label=None, validators=None, min_entries=0,
                 max_entries=None, default=tuple(), **kwargs):
        super(FieldList, self).__init__(label, validators, default=default, **kwargs)
        if self.filters:
            raise TypeError('FieldList does not accept any filters. Instead, define them on the enclosed field.')
        assert isinstance(unbound_field, UnboundField), 'Field must be unbound, not a field class'
        self.unbound_field = unbound_field
        self.min_entries = min_entries
        self.max_entries = max_entries
        self.last_index = -1
        self._prefix = kwargs.get('_prefix', '')

    def process(self, formdata, data=unset_value):
        self.entries = []
        if data is unset_value or not data:
            try:
                data = self.default()
            except TypeError:
                data = self.default

        self.object_data = data

        if formdata:
            indices = sorted(set(self._extract_indices(self.name, formdata)))
            if self.max_entries:
                indices = indices[:self.max_entries]

            idata = iter(data)
            for index in indices:
                try:
                    obj_data = next(idata)
                except StopIteration:
                    obj_data = unset_value
                self._add_entry(formdata, obj_data, index=index)
        else:
            for obj_data in data:
                self._add_entry(formdata, obj_data)

        while len(self.entries) < self.min_entries:
            self._add_entry(formdata)

    def _extract_indices(self, prefix, formdata):
        """
        Yield indices of any keys with given prefix.

        formdata must be an object which will produce keys when iterated.  For
        example, if field 'foo' contains keys 'foo-0-bar', 'foo-1-baz', then
        the numbers 0 and 1 will be yielded, but not neccesarily in order.
        """
        offset = len(prefix) + 1
        for k in formdata:
            if k.startswith(prefix):
                k = k[offset:].split('-', 1)[0]
                if k.isdigit():
                    yield int(k)

    def validate(self, form, extra_validators=tuple()):
        """
        Validate this FieldList.

        Note that FieldList validation differs from normal field validation in
        that FieldList validates all its enclosed fields first before running any
        of its own validators.
        """
        self.errors = []

        # Run validators on all entries within
        for subfield in self.entries:
            if not subfield.validate(form):
                self.errors.append(subfield.errors)

        chain = itertools.chain(self.validators, extra_validators)
        self._run_validation_chain(form, chain)

        return len(self.errors) == 0

    def populate_obj(self, obj, name):
        values = getattr(obj, name, None)
        try:
            ivalues = iter(values)
        except TypeError:
            ivalues = iter([])

        candidates = itertools.chain(ivalues, itertools.repeat(None))
        _fake = type(str('_fake'), (object, ), {})
        output = []
        for field, data in izip(self.entries, candidates):
            fake_obj = _fake()
            fake_obj.data = data
            field.populate_obj(fake_obj, 'data')
            output.append(fake_obj.data)

        setattr(obj, name, output)

    def _add_entry(self, formdata=None, data=unset_value, index=None):
        assert not self.max_entries or len(self.entries) < self.max_entries, \
            'You cannot have more than max_entries entries in this FieldList'
        if index is None:
            index = self.last_index + 1
        self.last_index = index
        name = '%s-%d' % (self.short_name, index)
        id = '%s-%d' % (self.id, index)
        field = self.unbound_field.bind(form=None, name=name, prefix=self._prefix, id=id, _meta=self.meta,
                                        translations=self._translations)
        field.process(formdata, data)
        self.entries.append(field)
        return field

    def append_entry(self, data=unset_value):
        """
        Create a new entry with optional default data.

        Entries added in this way will *not* receive formdata however, and can
        only receive object data.
        """
        return self._add_entry(data=data)

    def pop_entry(self):
        """ Removes the last entry from the list and returns it. """
        entry = self.entries.pop()
        self.last_index -= 1
        return entry

    def __iter__(self):
        return iter(self.entries)

    def __len__(self):
        return len(self.entries)

    def __getitem__(self, index):
        return self.entries[index]

    @property
    def data(self):
        return [f.data for f in self.entries]

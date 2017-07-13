import itertools
try:
    from collections import OrderedDict
except ImportError:
    from ordereddict import OrderedDict

from wtforms.compat import with_metaclass, iteritems, itervalues
from wtforms.meta import DefaultMeta

__all__ = (
    'BaseForm',
    'Form',
)


class BaseForm(object):
    """
    Base Form Class.  Provides core behaviour like field construction,
    validation, and data and error proxying.
    """

    def __init__(self, fields, prefix='', meta=DefaultMeta()):
        """
        :param fields:
            A dict or sequence of 2-tuples of partially-constructed fields.
        :param prefix:
            If provided, all fields will have their name prefixed with the
            value.
        :param meta:
            A meta instance which is used for configuration and customization
            of WTForms behaviors.
        """
        if prefix and prefix[-1] not in '-_;:/.':
            prefix += '-'

        self.meta = meta
        self._prefix = prefix
        self._errors = None
        self._fields = OrderedDict()

        if hasattr(fields, 'items'):
            fields = fields.items()

        translations = self._get_translations()
        extra_fields = []
        if meta.csrf:
            self._csrf = meta.build_csrf(self)
            extra_fields.extend(self._csrf.setup_form(self))

        for name, unbound_field in itertools.chain(fields, extra_fields):
            options = dict(name=name, prefix=prefix, translations=translations)
            field = meta.bind_field(self, unbound_field, options)
            self._fields[name] = field

    def __iter__(self):
        """Iterate form fields in creation order."""
        return iter(itervalues(self._fields))

    def __contains__(self, name):
        """ Returns `True` if the named field is a member of this form. """
        return (name in self._fields)

    def __getitem__(self, name):
        """ Dict-style access to this form's fields."""
        return self._fields[name]

    def __setitem__(self, name, value):
        """ Bind a field to this form. """
        self._fields[name] = value.bind(form=self, name=name, prefix=self._prefix)

    def __delitem__(self, name):
        """ Remove a field from this form. """
        del self._fields[name]

    def _get_translations(self):
        """
        .. deprecated:: 2.0
            `_get_translations` is being removed in WTForms 3.0, use
            `Meta.get_translations` instead.

        Override in subclasses to provide alternate translations factory.

        Must return an object that provides gettext() and ngettext() methods.
        """
        return self.meta.get_translations(self)

    def populate_obj(self, obj):
        """
        Populates the attributes of the passed `obj` with data from the form's
        fields.

        :note: This is a destructive operation; Any attribute with the same name
               as a field will be overridden. Use with caution.
        """
        for name, field in iteritems(self._fields):
            field.populate_obj(obj, name)

    def process(self, formdata=None, obj=None, data=None, **kwargs):
        """
        Take form, object data, and keyword arg input and have the fields
        process them.

        :param formdata:
            Used to pass data coming from the enduser, usually `request.POST` or
            equivalent.
        :param obj:
            If `formdata` is empty or not provided, this object is checked for
            attributes matching form field names, which will be used for field
            values.
        :param data:
            If provided, must be a dictionary of data. This is only used if
            `formdata` is empty or not provided and `obj` does not contain
            an attribute named the same as the field.
        :param `**kwargs`:
            If `formdata` is empty or not provided and `obj` does not contain
            an attribute named the same as a field, form will assign the value
            of a matching keyword argument to the field, if one exists.
        """
        formdata = self.meta.wrap_formdata(self, formdata)

        if data is not None:
            # XXX we want to eventually process 'data' as a new entity.
            #     Temporarily, this can simply be merged with kwargs.
            kwargs = dict(data, **kwargs)

        for name, field, in iteritems(self._fields):
            if obj is not None and hasattr(obj, name):
                field.process(formdata, getattr(obj, name))
            elif name in kwargs:
                field.process(formdata, kwargs[name])
            else:
                field.process(formdata)

    def validate(self, extra_validators=None):
        """
        Validates the form by calling `validate` on each field.

        :param extra_validators:
            If provided, is a dict mapping field names to a sequence of
            callables which will be passed as extra validators to the field's
            `validate` method.

        Returns `True` if no errors occur.
        """
        self._errors = None
        success = True
        for name, field in iteritems(self._fields):
            if extra_validators is not None and name in extra_validators:
                extra = extra_validators[name]
            else:
                extra = tuple()
            if not field.validate(self, extra):
                success = False
        return success

    @property
    def data(self):
        return dict((name, f.data) for name, f in iteritems(self._fields))

    @property
    def errors(self):
        if self._errors is None:
            self._errors = dict((name, f.errors) for name, f in iteritems(self._fields) if f.errors)
        return self._errors


class FormMeta(type):
    """
    The metaclass for `Form` and any subclasses of `Form`.

    `FormMeta`'s responsibility is to create the `_unbound_fields` list, which
    is a list of `UnboundField` instances sorted by their order of
    instantiation.  The list is created at the first instantiation of the form.
    If any fields are added/removed from the form, the list is cleared to be
    re-generated on the next instantiation.

    Any properties which begin with an underscore or are not `UnboundField`
    instances are ignored by the metaclass.
    """
    def __init__(cls, name, bases, attrs):
        type.__init__(cls, name, bases, attrs)
        cls._unbound_fields = None
        cls._wtforms_meta = None

    def __call__(cls, *args, **kwargs):
        """
        Construct a new `Form` instance.

        Creates the `_unbound_fields` list and the internal `_wtforms_meta`
        subclass of the class Meta in order to allow a proper inheritance
        hierarchy.
        """
        if cls._unbound_fields is None:
            fields = []
            for name in dir(cls):
                if not name.startswith('_'):
                    unbound_field = getattr(cls, name)
                    if hasattr(unbound_field, '_formfield'):
                        fields.append((name, unbound_field))
            # We keep the name as the second element of the sort
            # to ensure a stable sort.
            fields.sort(key=lambda x: (x[1].creation_counter, x[0]))
            cls._unbound_fields = fields

        # Create a subclass of the 'class Meta' using all the ancestors.
        if cls._wtforms_meta is None:
            bases = []
            for mro_class in cls.__mro__:
                if 'Meta' in mro_class.__dict__:
                    bases.append(mro_class.Meta)
            cls._wtforms_meta = type('Meta', tuple(bases), {})
        return type.__call__(cls, *args, **kwargs)

    def __setattr__(cls, name, value):
        """
        Add an attribute to the class, clearing `_unbound_fields` if needed.
        """
        if name == 'Meta':
            cls._wtforms_meta = None
        elif not name.startswith('_') and hasattr(value, '_formfield'):
            cls._unbound_fields = None
        type.__setattr__(cls, name, value)

    def __delattr__(cls, name):
        """
        Remove an attribute from the class, clearing `_unbound_fields` if
        needed.
        """
        if not name.startswith('_'):
            cls._unbound_fields = None
        type.__delattr__(cls, name)


class Form(with_metaclass(FormMeta, BaseForm)):
    """
    Declarative Form base class. Extends BaseForm's core behaviour allowing
    fields to be defined on Form subclasses as class attributes.

    In addition, form and instance input data are taken at construction time
    and passed to `process()`.
    """
    Meta = DefaultMeta

    def __init__(self, formdata=None, obj=None, prefix='', data=None, meta=None, **kwargs):
        """
        :param formdata:
            Used to pass data coming from the enduser, usually `request.POST` or
            equivalent. formdata should be some sort of request-data wrapper which
            can get multiple parameters from the form input, and values are unicode
            strings, e.g. a Werkzeug/Django/WebOb MultiDict
        :param obj:
            If `formdata` is empty or not provided, this object is checked for
            attributes matching form field names, which will be used for field
            values.
        :param prefix:
            If provided, all fields will have their name prefixed with the
            value.
        :param data:
            Accept a dictionary of data. This is only used if `formdata` and
            `obj` are not present.
        :param meta:
            If provided, this is a dictionary of values to override attributes
            on this form's meta instance.
        :param `**kwargs`:
            If `formdata` is empty or not provided and `obj` does not contain
            an attribute named the same as a field, form will assign the value
            of a matching keyword argument to the field, if one exists.
        """
        meta_obj = self._wtforms_meta()
        if meta is not None and isinstance(meta, dict):
            meta_obj.update_values(meta)
        super(Form, self).__init__(self._unbound_fields, meta=meta_obj, prefix=prefix)

        for name, field in iteritems(self._fields):
            # Set all the fields to attributes so that they obscure the class
            # attributes with the same names.
            setattr(self, name, field)
        self.process(formdata, obj, data=data, **kwargs)

    def __setitem__(self, name, value):
        raise TypeError('Fields may not be added to Form instances, only classes.')

    def __delitem__(self, name):
        del self._fields[name]
        setattr(self, name, None)

    def __delattr__(self, name):
        if name in self._fields:
            self.__delitem__(name)
        else:
            # This is done for idempotency, if we have a name which is a field,
            # we want to mask it by setting the value to None.
            unbound_field = getattr(self.__class__, name, None)
            if unbound_field is not None and hasattr(unbound_field, '_formfield'):
                setattr(self, name, None)
            else:
                super(Form, self).__delattr__(name)

    def validate(self):
        """
        Validates the form by calling `validate` on each field, passing any
        extra `Form.validate_<fieldname>` validators to the field validator.
        """
        extra = {}
        for name in self._fields:
            inline = getattr(self.__class__, 'validate_%s' % name, None)
            if inline is not None:
                extra[name] = [inline]

        return super(Form, self).validate(extra)

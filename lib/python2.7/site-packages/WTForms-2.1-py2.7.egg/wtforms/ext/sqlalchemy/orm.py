"""
Tools for generating forms based on SQLAlchemy models.
"""
from __future__ import unicode_literals

import inspect

from wtforms import fields as f
from wtforms import validators
from wtforms.form import Form
from .fields import QuerySelectField, QuerySelectMultipleField

__all__ = (
    'model_fields', 'model_form',
)


def converts(*args):
    def _inner(func):
        func._converter_for = frozenset(args)
        return func
    return _inner


class ModelConversionError(Exception):
    def __init__(self, message):
        Exception.__init__(self, message)


class ModelConverterBase(object):
    def __init__(self, converters, use_mro=True):
        self.use_mro = use_mro

        if not converters:
            converters = {}

        for name in dir(self):
            obj = getattr(self, name)
            if hasattr(obj, '_converter_for'):
                for classname in obj._converter_for:
                    converters[classname] = obj

        self.converters = converters

    def convert(self, model, mapper, prop, field_args, db_session=None):
        if not hasattr(prop, 'columns') and not hasattr(prop, 'direction'):
            return
        elif not hasattr(prop, 'direction') and len(prop.columns) != 1:
            raise TypeError(
                'Do not know how to convert multiple-column properties currently'
            )

        kwargs = {
            'validators': [],
            'filters': [],
            'default': None,
        }

        converter = None
        column = None
        types = None

        if not hasattr(prop, 'direction'):
            column = prop.columns[0]
            # Support sqlalchemy.schema.ColumnDefault, so users can benefit
            # from  setting defaults for fields, e.g.:
            #   field = Column(DateTimeField, default=datetime.utcnow)

            default = getattr(column, 'default', None)

            if default is not None:
                # Only actually change default if it has an attribute named
                # 'arg' that's callable.
                callable_default = getattr(default, 'arg', None)

                if callable_default is not None:
                    # ColumnDefault(val).arg can be also a plain value
                    default = callable_default(None) if callable(callable_default) else callable_default

            kwargs['default'] = default

            if column.nullable:
                kwargs['validators'].append(validators.Optional())
            else:
                kwargs['validators'].append(validators.Required())

            if self.use_mro:
                types = inspect.getmro(type(column.type))
            else:
                types = [type(column.type)]

            for col_type in types:
                type_string = '%s.%s' % (col_type.__module__, col_type.__name__)
                if type_string.startswith('sqlalchemy'):
                    type_string = type_string[11:]

                if type_string in self.converters:
                    converter = self.converters[type_string]
                    break
            else:
                for col_type in types:
                    if col_type.__name__ in self.converters:
                        converter = self.converters[col_type.__name__]
                        break
                else:
                    raise ModelConversionError('Could not find field converter for %s (%r).' % (prop.key, types[0]))
        else:
            # We have a property with a direction.
            if not db_session:
                raise ModelConversionError("Cannot convert field %s, need DB session." % prop.key)

            foreign_model = prop.mapper.class_

            nullable = True
            for pair in prop.local_remote_pairs:
                if not pair[0].nullable:
                    nullable = False

            kwargs.update({
                'allow_blank': nullable,
                'query_factory': lambda: db_session.query(foreign_model).all()
            })

            converter = self.converters[prop.direction.name]

        if field_args:
            kwargs.update(field_args)

        return converter(
            model=model,
            mapper=mapper,
            prop=prop,
            column=column,
            field_args=kwargs
        )


class ModelConverter(ModelConverterBase):
    def __init__(self, extra_converters=None, use_mro=True):
        super(ModelConverter, self).__init__(extra_converters, use_mro=use_mro)

    @classmethod
    def _string_common(cls, column, field_args, **extra):
        if column.type.length:
            field_args['validators'].append(validators.Length(max=column.type.length))

    @converts('String', 'Unicode')
    def conv_String(self, field_args, **extra):
        self._string_common(field_args=field_args, **extra)
        return f.TextField(**field_args)

    @converts('types.Text', 'UnicodeText', 'types.LargeBinary', 'types.Binary', 'sql.sqltypes.Text')
    def conv_Text(self, field_args, **extra):
        self._string_common(field_args=field_args, **extra)
        return f.TextAreaField(**field_args)

    @converts('Boolean')
    def conv_Boolean(self, field_args, **extra):
        return f.BooleanField(**field_args)

    @converts('Date')
    def conv_Date(self, field_args, **extra):
        return f.DateField(**field_args)

    @converts('DateTime')
    def conv_DateTime(self, field_args, **extra):
        return f.DateTimeField(**field_args)

    @converts('Enum')
    def conv_Enum(self, column, field_args, **extra):
        if 'choices' not in field_args:
            field_args['choices'] = [(e, e) for e in column.type.enums]
        return f.SelectField(**field_args)

    @converts('Integer', 'SmallInteger')
    def handle_integer_types(self, column, field_args, **extra):
        unsigned = getattr(column.type, 'unsigned', False)
        if unsigned:
            field_args['validators'].append(validators.NumberRange(min=0))
        return f.IntegerField(**field_args)

    @converts('Numeric', 'Float')
    def handle_decimal_types(self, column, field_args, **extra):
        places = getattr(column.type, 'scale', 2)
        if places is not None:
            field_args['places'] = places
        return f.DecimalField(**field_args)

    @converts('databases.mysql.MSYear', 'dialects.mysql.base.YEAR')
    def conv_MSYear(self, field_args, **extra):
        field_args['validators'].append(validators.NumberRange(min=1901, max=2155))
        return f.TextField(**field_args)

    @converts('databases.postgres.PGInet', 'dialects.postgresql.base.INET')
    def conv_PGInet(self, field_args, **extra):
        field_args.setdefault('label', 'IP Address')
        field_args['validators'].append(validators.IPAddress())
        return f.TextField(**field_args)

    @converts('dialects.postgresql.base.MACADDR')
    def conv_PGMacaddr(self, field_args, **extra):
        field_args.setdefault('label', 'MAC Address')
        field_args['validators'].append(validators.MacAddress())
        return f.TextField(**field_args)

    @converts('dialects.postgresql.base.UUID')
    def conv_PGUuid(self, field_args, **extra):
        field_args.setdefault('label', 'UUID')
        field_args['validators'].append(validators.UUID())
        return f.TextField(**field_args)

    @converts('MANYTOONE')
    def conv_ManyToOne(self, field_args, **extra):
        return QuerySelectField(**field_args)

    @converts('MANYTOMANY', 'ONETOMANY')
    def conv_ManyToMany(self, field_args, **extra):
        return QuerySelectMultipleField(**field_args)


def model_fields(model, db_session=None, only=None, exclude=None,
                 field_args=None, converter=None, exclude_pk=False,
                 exclude_fk=False):
    """
    Generate a dictionary of fields for a given SQLAlchemy model.

    See `model_form` docstring for description of parameters.
    """
    mapper = model._sa_class_manager.mapper
    converter = converter or ModelConverter()
    field_args = field_args or {}
    properties = []

    for prop in mapper.iterate_properties:
        if getattr(prop, 'columns', None):
            if exclude_fk and prop.columns[0].foreign_keys:
                continue
            elif exclude_pk and prop.columns[0].primary_key:
                continue

        properties.append((prop.key, prop))

    # ((p.key, p) for p in mapper.iterate_properties)
    if only:
        properties = (x for x in properties if x[0] in only)
    elif exclude:
        properties = (x for x in properties if x[0] not in exclude)

    field_dict = {}
    for name, prop in properties:
        field = converter.convert(
            model, mapper, prop,
            field_args.get(name), db_session
        )
        if field is not None:
            field_dict[name] = field

    return field_dict


def model_form(model, db_session=None, base_class=Form, only=None,
               exclude=None, field_args=None, converter=None, exclude_pk=True,
               exclude_fk=True, type_name=None):
    """
    Create a wtforms Form for a given SQLAlchemy model class::

        from wtforms.ext.sqlalchemy.orm import model_form
        from myapp.models import User
        UserForm = model_form(User)

    :param model:
        A SQLAlchemy mapped model class.
    :param db_session:
        An optional SQLAlchemy Session.
    :param base_class:
        Base form class to extend from. Must be a ``wtforms.Form`` subclass.
    :param only:
        An optional iterable with the property names that should be included in
        the form. Only these properties will have fields.
    :param exclude:
        An optional iterable with the property names that should be excluded
        from the form. All other properties will have fields.
    :param field_args:
        An optional dictionary of field names mapping to keyword arguments used
        to construct each field object.
    :param converter:
        A converter to generate the fields based on the model properties. If
        not set, ``ModelConverter`` is used.
    :param exclude_pk:
        An optional boolean to force primary key exclusion.
    :param exclude_fk:
        An optional boolean to force foreign keys exclusion.
    :param type_name:
        An optional string to set returned type name.
    """
    if not hasattr(model, '_sa_class_manager'):
        raise TypeError('model must be a sqlalchemy mapped model')

    type_name = type_name or str(model.__name__ + 'Form')
    field_dict = model_fields(
        model, db_session, only, exclude, field_args, converter,
        exclude_pk=exclude_pk, exclude_fk=exclude_fk
    )
    return type(type_name, (base_class, ), field_dict)

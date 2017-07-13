import logging
from flask_wtf import FlaskForm
from wtforms import (BooleanField, StringField,
                     TextAreaField, IntegerField, FloatField,
                      DateField, DateTimeField, DecimalField)
from .fields import QuerySelectMultipleField, QuerySelectField

from wtforms import validators
from .fieldwidgets import (BS3TextAreaFieldWidget,
                           BS3TextFieldWidget,
                           DatePickerWidget,
                           DateTimePickerWidget,
                           Select2Widget,
                           Select2ManyWidget)
from .upload import (BS3FileUploadFieldWidget,
                     BS3ImageUploadFieldWidget,
                     FileUploadField,
                     ImageUploadField)
from .models.mongoengine.fields import MongoFileField, MongoImageField
from .validators import Unique

try:
    from wtforms.fields.core import _unset_value as unset_value
except:
    from wtforms.utils import unset_value

log = logging.getLogger(__name__)


class FieldConverter(object):
    """
        Helper class that converts model fields into WTForm fields

        it has a conversion table with type method checks from model
        interfaces, these methods are invoked with a column name
    """
    conversion_table = (('is_image', ImageUploadField, BS3ImageUploadFieldWidget),
                        ('is_file', FileUploadField, BS3FileUploadFieldWidget),
                        ('is_gridfs_file', MongoFileField, BS3FileUploadFieldWidget),
                        ('is_gridfs_image', MongoImageField, BS3ImageUploadFieldWidget),
                        ('is_text', TextAreaField, BS3TextAreaFieldWidget),
                        ('is_string', StringField, BS3TextFieldWidget),
                        ('is_integer', IntegerField, BS3TextFieldWidget),
                        ('is_numeric', DecimalField, BS3TextFieldWidget),
                        ('is_float', FloatField, BS3TextFieldWidget),
                        ('is_boolean', BooleanField, None),
                        ('is_date', DateField, DatePickerWidget),
                        ('is_datetime', DateTimeField, DateTimePickerWidget),
    )

    def __init__(self, datamodel, colname, label, description, validators, default=None):
        self.datamodel = datamodel
        self.colname = colname
        self.label = label
        self.description = description
        self.validators = validators
        self.default = default

    def convert(self):
        for conversion in self.conversion_table:
            if getattr(self.datamodel, conversion[0])(self.colname):
                if conversion[2]:
                    return conversion[1](self.label,
                                         description=self.description,
                                         validators=self.validators,
                                         widget=conversion[2](),
                                         default=self.default)
                else:
                    return conversion[1](self.label,
                                         description=self.description,
                                         validators=self.validators,
                                         default=self.default)
        log.error('Column %s Type not supported' % self.colname)


class GeneralModelConverter(object):
    """
        Returns a form from a model only one public exposed
        method 'create_form'
    """

    def __init__(self, datamodel):
        self.datamodel = datamodel

    @staticmethod
    def _get_validators(col_name, validators_columns):
        return validators_columns.get(col_name, [])

    @staticmethod
    def _get_description(col_name, description_columns):
        return description_columns.get(col_name, "")

    @staticmethod
    def _get_label(col_name, label_columns):
        return label_columns.get(col_name, "")

    def _get_related_query_func(self, col_name, filter_rel_fields):
        if filter_rel_fields:
            if col_name in filter_rel_fields:
                datamodel = self.datamodel.get_related_interface(col_name)
                filters = datamodel.get_filters().add_filter_list(filter_rel_fields[col_name])
                return lambda: datamodel.query(filters)[1]
        return lambda: self.datamodel.get_related_interface(col_name).query()[1]

    def _get_related_pk_func(self, col_name):
        return lambda obj: self.datamodel.get_related_interface(col_name).get_pk_value(obj)

    def _convert_many_to_one(self, col_name, label, description,
                             lst_validators, filter_rel_fields,
                             form_props):
        """
            Creates a WTForm field for many to one related fields,
            will use a Select box based on a query. Will only
            work with SQLAlchemy interface.
        """
        query_func = self._get_related_query_func(col_name, filter_rel_fields)
        get_pk_func = self._get_related_pk_func(col_name)
        extra_classes = None
        allow_blank = True
        if not self.datamodel.is_nullable(col_name):
            lst_validators.append(validators.DataRequired())
            allow_blank = False
        else:
            lst_validators.append(validators.Optional())
        form_props[col_name] = \
            QuerySelectField(label,
                             description=description,
                             query_func=query_func,
                             get_pk_func=get_pk_func,
                             allow_blank=allow_blank,
                             validators=lst_validators,
                             widget=Select2Widget(extra_classes=extra_classes))
        return form_props

    def _convert_many_to_many(self, col_name, label, description,
                              lst_validators, filter_rel_fields,
                              form_props):
        query_func = self._get_related_query_func(col_name, filter_rel_fields)
        get_pk_func = self._get_related_pk_func(col_name)
        allow_blank = True
        form_props[col_name] = \
            QuerySelectMultipleField(label,
                                     description=description,
                                     query_func=query_func,
                                    get_pk_func=get_pk_func,
                                    allow_blank=allow_blank,
                                     validators=lst_validators,
                                     widget=Select2ManyWidget())
        return form_props

    def _convert_simple(self, col_name, label, description, lst_validators, form_props):
        # Add Validator size
        max = self.datamodel.get_max_length(col_name)
        min = self.datamodel.get_min_length(col_name)
        if max != -1 or min != -1:
            lst_validators.append(validators.Length(max=max, min=min))
        # Add Validator is null
        if not self.datamodel.is_nullable(col_name):
            lst_validators.append(validators.InputRequired())
        else:
            lst_validators.append(validators.Optional())
        # Add Validator is unique
        if self.datamodel.is_unique(col_name):
            lst_validators.append(Unique(self.datamodel, col_name))
        default_value = self.datamodel.get_col_default(col_name)
        fc = FieldConverter(self.datamodel, col_name, label, description, lst_validators, default=default_value)
        form_props[col_name] = fc.convert()
        return form_props

    def _convert_col(self, col_name,
                     label, description,
                     lst_validators, filter_rel_fields,
                     form_props):
        if self.datamodel.is_relation(col_name):
            if self.datamodel.is_relation_many_to_one(col_name) or \
                    self.datamodel.is_relation_one_to_one(col_name):
                return self._convert_many_to_one(col_name, label,
                                                 description,
                                                 lst_validators,
                                                 filter_rel_fields,
                                                 form_props)
            elif self.datamodel.is_relation_many_to_many(col_name) or \
                    self.datamodel.is_relation_one_to_many(col_name):
                return self._convert_many_to_many(col_name, label,
                                                  description,
                                                  lst_validators,
                                                  filter_rel_fields,
                                                  form_props)
            else:
                log.warning("Relation {0} not supported".format(col_name))
        else:
            return self._convert_simple(col_name, label, description, lst_validators, form_props)

    def create_form(self, label_columns=None, inc_columns=None,
                    description_columns=None, validators_columns=None,
                    extra_fields=None, filter_rel_fields=None):
        """
            Converts a model to a form given

            :param label_columns:
                A dictionary with the column's labels.
            :param inc_columns:
                A list with the columns to include
            :param description_columns:
                A dictionary with a description for cols.
            :param validators_columns:
                A dictionary with WTForms validators ex::

                    validators={'personal_email':EmailValidator}

            :param extra_fields:
                A dictionary containing column names and a WTForm
                Form fields to be added to the form, these fields do not
                 exist on the model itself ex::

                    extra_fields={'some_col':BooleanField('Some Col', default=False)}

            :param filter_rel_fields:
                A filter to be applied on relationships
        """
        label_columns = label_columns or {}
        inc_columns = inc_columns or []
        description_columns = description_columns or {}
        validators_columns = validators_columns or {}
        extra_fields = extra_fields or {}
        form_props = {}
        for col_name in inc_columns:
            if col_name in extra_fields:
                form_props[col_name] = extra_fields.get(col_name)
            else:
                self._convert_col(col_name, self._get_label(col_name, label_columns),
                                  self._get_description(col_name, description_columns),
                                  self._get_validators(col_name, validators_columns),
                                  filter_rel_fields, form_props)
        return type('DynamicForm', (DynamicForm,), form_props)


class DynamicForm(FlaskForm):
    """
        Refresh method will force select field to refresh
    """

    @classmethod
    def refresh(self, obj=None):
        form = self(obj=obj)
        return form



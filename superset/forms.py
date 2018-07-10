# -*- coding: utf-8 -*-
# pylint: disable=C,R,W
"""Contains the logic to create cohesive forms on the explore view"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from flask_appbuilder.fieldwidgets import BS3TextFieldWidget
from flask_appbuilder.forms import DynamicForm
from flask_babel import lazy_gettext as _
from flask_wtf.file import FileAllowed, FileField, FileRequired
from wtforms import (
    BooleanField, Field, IntegerField, SelectField, StringField)
from wtforms.ext.sqlalchemy.fields import QuerySelectField
from wtforms.validators import DataRequired, NumberRange, Optional

from superset import app, db
from superset.models import core as models

config = app.config


class CommaSeparatedListField(Field):
    widget = BS3TextFieldWidget()

    def _value(self):
        if self.data:
            return u', '.join(self.data)
        else:
            return u''

    def process_formdata(self, valuelist):
        if valuelist:
            self.data = [x.strip() for x in valuelist[0].split(',')]
        else:
            self.data = []


def filter_not_empty_values(value):
    """Returns a list of non empty values or None"""
    if not value:
        return None
    data = [x for x in value if x]
    if not data:
        return None
    return data


class CsvToDatabaseForm(DynamicForm):
    # pylint: disable=E0211
    def all_db_items():
        return db.session.query(models.Database)

    name = StringField(
        _('Table Name'),
        description=_('Name of table to be created from csv data.'),
        validators=[DataRequired()],
        widget=BS3TextFieldWidget())
    schema = StringField(
        _('Schema'),
        description=_('Specify a schema (if database flavour supports this).'),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
        filters=[lambda x: x or None])
    con = QuerySelectField(
        _('Database'),
        query_factory=all_db_items,
        get_pk=lambda a: a.id, get_label=lambda a: a.database_name)
    csv_file = FileField(
        _('CSV File'),
        description=_('Select a CSV file to be uploaded to a database.'),
        validators=[
            FileRequired(), FileAllowed(['csv'], _('CSV Files Only!'))])
    index_col = IntegerField(
        _('Index Column'),
        description=_(
            'Zero indexed position of column to use for index.'
            'If a sequence is given, a MultiIndex is used.',
        validators=[Optional(), NumberRange(0, 1E+20)],
        widget=BS3TextFieldWidget(),
        filters=[lambda x: x or None])
    infer_datetime_format = BooleanField(
        _('Infer Datetime Format'),
        description=_(
            'Use Pandas to interpret the datetime format '
            'automatically.'))

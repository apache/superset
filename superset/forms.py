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
    BooleanField, IntegerField, SelectField, StringField)
from wtforms.ext.sqlalchemy.fields import QuerySelectField
from wtforms.validators import DataRequired, NumberRange, Optional

from superset import app, db
from superset.models import core as models

config = app.config


class CsvToDatabaseForm(DynamicForm):
    # pylint: disable=E0211
    def all_db_items():
        return db.session.query(models.Database)

    name = StringField(
        _('Table Name'),
        description=_('Name of table to be created from csv data.'),
        validators=[DataRequired()],
        widget=BS3TextFieldWidget())
    csv_file = FileField(
        _('CSV File'),
        description=_('Select a CSV file to be uploaded to a database.'),
        validators=[
            FileRequired(), FileAllowed(['csv'], _('CSV Files Only!'))])
    con = QuerySelectField(
         query_factory=all_db_items,
         get_pk=lambda a: a.id, get_label=lambda a: a.database_name)
    sep = StringField(
        _('Delimiter'),
        description=_('Delimiter used by CSV file (for whitespace use \s+).'),
        validators=[DataRequired()],
        widget=BS3TextFieldWidget())
    if_exists = SelectField(
        _('Table Exists'),
        description=_(
            'If table exists do one of the following: '
            'Fail (do nothing), Replace (drop and recreate table) '
            'or Append (insert data).'),
        choices=[
            ('fail', _('Fail')), ('replace', _('Replace')),
            ('append', _('Append'))],
        validators=[DataRequired()])
    schema = StringField(
        _('Schema'),
        description=_('Specify a schema (if database flavour supports this).'),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
        filters=[lambda x: x or None])
    header = IntegerField(
        _('Header Row'),
        description=_(
            'Row containing the headers to use as '
            'column names (0 is first line of data). '
            'Leave empty if there is no header row.'),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
        filters=[lambda x: x or None])
    index_col = IntegerField(
        _('Index Column'),
        description=_(
            'Column to use as the row labels of the '
            'dataframe. Leave empty if no index column.'),
        validators=[Optional(), NumberRange(0, 1E+20)],
        widget=BS3TextFieldWidget(),
        filters=[lambda x: x or None])
    mangle_dupe_cols = BooleanField(
        _('Mangle Duplicate Columns'),
        description=_('Specify duplicate columns as "X.0, X.1".'))
    skipinitialspace = BooleanField(
        _('Skip Initial Space'),
        description=_('Skip spaces after delimiter.'))
    skiprows = IntegerField(
        _('Skip Rows'),
        description=_('Number of rows to skip at start of file.'),
        validators=[Optional(), NumberRange(0, 1E+20)],
        widget=BS3TextFieldWidget(),
        filters=[lambda x: x or None])
    nrows = IntegerField(
        _('Rows to Read'),
        description=_('Number of rows of file to read.'),
        validators=[Optional(), NumberRange(0, 1E+20)],
        widget=BS3TextFieldWidget(),
        filters=[lambda x: x or None])
    skip_blank_lines = BooleanField(
        _('Skip Blank Lines'),
        description=_(
            'Skip blank lines rather than interpreting them '
            'as NaN values.'))
    parse_dates = BooleanField(
        _('Parse Dates'),
        description=_('Parse date values.'))
    infer_datetime_format = BooleanField(
        _('Infer Datetime Format'),
        description=_(
            'Use Pandas to interpret the datetime format '
            'automatically.'))
    decimal = StringField(
        _('Decimal Character'),
        description=_('Character to interpret as decimal point.'),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
        filters=[lambda x: x or '.'])
    index = BooleanField(
        _('Dataframe Index'),
        description=_('Write dataframe index as a column.'))
    index_label = StringField(
        _('Column Label(s)'),
        description=_(
            'Column label for index column(s). If None is given '
            'and Dataframe Index is True, Index Names are used.'),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
        filters=[lambda x: x or None])

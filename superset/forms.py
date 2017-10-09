"""Contains the logic to create cohesive forms on the explore view"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from flask_babel import lazy_gettext as _
from flask_appbuilder.fieldwidgets import BS3TextFieldWidget
from flask_appbuilder.forms import DynamicForm
from flask_wtf.file import FileField, FileAllowed, FileRequired
from wtforms import (
    BooleanField, SelectField, IntegerField, StringField)
from wtforms.validators import DataRequired, InputRequired, Optional, NumberRange

from superset import app

config = app.config


class CsvToDatabaseForm(DynamicForm):
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

    con = SelectField(
        _('Database'),
        description=_('database in which to add above table.'),
        validators=[DataRequired()],
        choices=[])
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
    sep = StringField(
        _('Delimiter'),
        description=_('Delimiter used by CSV file (for whitespace use \s+).'),
        validators=[DataRequired()],
        widget=BS3TextFieldWidget())
    header = IntegerField(
        _('Header Row'),
        description=_(
            'Row containing the headers to use as '
            'column names (0 is first line of data). '
            'Leave empty if there is no header row.'),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
        filters=[lambda x: x or None])
    names = StringField(
        _('Column Names'),
        description=_(
            'List of comma-separated column names to use if '
            'header row not specified above. Leave empty if header '
            'field populated.'),
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
    squeeze = BooleanField(
        _('Squeeze'),
        description=_(
            'Parse the data as a series (specify '
            'this option if the data contains only one column.)'))
    prefix = StringField(
        _('Prefix'),
        description=_(
            'Prefix to add to column numbers when no header '
            '(e.g. "X" for "X0, X1").'),
        validators=[Optional()],
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
    dayfirst = BooleanField(
        _('Day First'),
        description=_(
            'Use DD/MM (European/International) date format.'))
    thousands = StringField(
        _('Thousands Separator'),
        description=_('Separator for values in thousands.'),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
        filters=[lambda x: x or None])
    decimal = StringField(
        _('Decimal Character'),
        description=_('Character to interpret as decimal point.'),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
        filters=[lambda x: x or '.'])
    quotechar = StringField(
        _('Quote Character'),
        description=_(
            'Character used to denote the start and end of a quoted item.'),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
        filters=[lambda x: x or "'"])
    escapechar = StringField(
        _('Escape Character'),
        description=_('Character used to escape a quoted item.'),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
        filters=[lambda x: x or None])
    comment = StringField(
        _('Comment Character'),
        description=_('Character used to denote the start of a comment.'),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
        filters=[lambda x: x or None])
    error_bad_lines = BooleanField(
        _('Error On Bad Lines'),
        description=_(
            'Error on bad lines (e.g. a line with '
            'too many commas). If false these bad lines will instead '
            'be dropped from the resulting dataframe.'))
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

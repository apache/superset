# pylint: disable=C,R,W
"""Contains the logic to create cohesive forms on the explore view"""
from flask_appbuilder.fieldwidgets import BS3TextFieldWidget
from flask_appbuilder.forms import DynamicForm
from flask_babel import lazy_gettext as _
from flask_wtf.file import FileAllowed, FileField, FileRequired
from wtforms import (
    BooleanField, Field, IntegerField, SelectField, StringField)
from wtforms.ext.sqlalchemy.fields import QuerySelectField
from wtforms.validators import DataRequired, NumberRange, Optional

from superset import app, db, security_manager
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
    def csv_allowed_dbs():
        csv_allowed_dbs = []
        csv_enabled_dbs = db.session.query(
            models.Database).filter_by(
            allow_csv_upload=True).all()
        for csv_enabled_db in csv_enabled_dbs:
            if CsvToDatabaseForm.at_least_one_schema_is_allowed(csv_enabled_db):
                csv_allowed_dbs.append(csv_enabled_db)
        return csv_allowed_dbs

    @staticmethod
    def at_least_one_schema_is_allowed(database):
        """
        If the user has access to the database or all datasource
            1. if schemas_allowed_for_csv_upload is empty
                a) if database does not support schema
                    user is able to upload csv without specifying schema name
                b) if database supports schema
                    user is able to upload csv to any schema
            2. if schemas_allowed_for_csv_upload is not empty
                a) if database does not support schema
                    This situation is impossible and upload will fail
                b) if database supports schema
                    user is able to upload to schema in schemas_allowed_for_csv_upload
        elif the user does not access to the database or all datasource
            1. if schemas_allowed_for_csv_upload is empty
                a) if database does not support schema
                    user is unable to upload csv
                b) if database supports schema
                    user is unable to upload csv
            2. if schemas_allowed_for_csv_upload is not empty
                a) if database does not support schema
                    This situation is impossible and user is unable to upload csv
                b) if database supports schema
                    user is able to upload to schema in schemas_allowed_for_csv_upload
        """
        if (security_manager.database_access(database) or
                security_manager.all_datasource_access()):
            return True
        schemas = database.get_schema_access_for_csv_upload()
        if (schemas and
            security_manager.schemas_accessible_by_user(
                database, schemas, False)):
            return True
        return False

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
        _('Database'),
        query_factory=csv_allowed_dbs,
        get_pk=lambda a: a.id, get_label=lambda a: a.database_name)
    schema = StringField(
        _('Schema'),
        description=_('Specify a schema (if database flavor supports this).'),
        validators=[Optional()],
        widget=BS3TextFieldWidget(),
        filters=[lambda x: x or None])
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
    parse_dates = CommaSeparatedListField(
        _('Parse Dates'),
        description=_(
            'A comma separated list of columns that should be '
            'parsed as dates.'),
        filters=[filter_not_empty_values])
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

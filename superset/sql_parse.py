import sqlparse
from sqlparse.sql import IdentifierList, Identifier
from sqlparse.tokens import DML, Keyword, Name

RESULT_OPERATIONS = {'UNION', 'INTERSECT', 'EXCEPT'}
PRECEDES_TABLE_NAME = {'FROM', 'JOIN', 'DESC', 'DESCRIBE', 'WITH'}


# TODO: some sql_lab logic here.
class SupersetQuery(object):
    def __init__(self, sql_statement):
        self.sql = sql_statement
        self._table_names = set()
        self._alias_names = set()
        # TODO: multistatement support
        self._parsed = sqlparse.parse(self.sql)
        for statement in self._parsed:
            self.__extract_from_token(statement)
        self._table_names = self._table_names - self._alias_names

    @property
    def tables(self):
        return self._table_names

    def is_select(self):
        return self._parsed[0].get_type() == 'SELECT'

    def stripped(self):
        sql = self.sql
        if sql:
            while sql[-1] in (' ', ';', '\n', '\t'):
                sql = sql[:-1]
            return sql

    @staticmethod
    def __precedes_table_name(token_value):
        for keyword in PRECEDES_TABLE_NAME:
            if keyword in token_value:
                return True
        return False

    @staticmethod
    def __get_full_name(identifier):
        if len(identifier.tokens) > 1 and identifier.tokens[1].value == '.':
            return "{}.{}".format(identifier.tokens[0].value,
                                  identifier.tokens[2].value)
        return identifier.get_real_name()

    @staticmethod
    def __is_result_operation(keyword):
        for operation in RESULT_OPERATIONS:
            if operation in keyword.upper():
                return True
        return False

    @staticmethod
    def __is_identifier(token):
        return (
            isinstance(token, IdentifierList) or isinstance(token, Identifier))

    def __process_identifier(self, identifier):
        # exclude subselects
        if '(' not in '{}'.format(identifier):
            self._table_names.add(SupersetQuery.__get_full_name(identifier))
            return

        # store aliases
        if hasattr(identifier, 'get_alias'):
            self._alias_names.add(identifier.get_alias())
        if hasattr(identifier, 'tokens'):
            # some aliases are not parsed properly
            if identifier.tokens[0].ttype == Name:
                self._alias_names.add(identifier.tokens[0].value)
        self.__extract_from_token(identifier)

    def as_create_table(self, table_name, overwrite=False):
        """Reformats the query into the create table as query.

        Works only for the single select SQL statements, in all other cases
        the sql query is not modified.
        :param superset_query: string, sql query that will be executed
        :param table_name: string, will contain the results of the
            query execution
        :param overwrite, boolean, table table_name will be dropped if true
        :return: string, create table as query
        """
        # TODO(bkyryliuk): enforce that all the columns have names.
        # Presto requires it for the CTA operation.
        # TODO(bkyryliuk): drop table if allowed, check the namespace and
        #                  the permissions.
        # TODO raise if multi-statement
        exec_sql = ''
        sql = self.stripped()
        if overwrite:
            exec_sql = 'DROP TABLE IF EXISTS {table_name};\n'
        exec_sql += "CREATE TABLE {table_name} AS \n{sql}"
        return exec_sql.format(**locals())

    def __extract_from_token(self, token):
        if not hasattr(token, 'tokens'):
            return

        table_name_preceding_token = False

        for item in token.tokens:
            if item.is_group and not self.__is_identifier(item):
                self.__extract_from_token(item)

            if item.ttype in Keyword:
                if SupersetQuery.__precedes_table_name(item.value.upper()):
                    table_name_preceding_token = True
                    continue

            if not table_name_preceding_token:
                continue

            if item.ttype in Keyword:
                if SupersetQuery.__is_result_operation(item.value):
                    table_name_preceding_token = False
                    continue
                # FROM clause is over
                break

            if isinstance(item, Identifier):
                self.__process_identifier(item)

            if isinstance(item, IdentifierList):
                for token in item.tokens:
                    if SupersetQuery.__is_identifier(token):
                        self.__process_identifier(token)

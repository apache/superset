import sqlparse
from sqlparse.sql import IdentifierList, Identifier
from sqlparse.tokens import Keyword, Name


RESULT_OPERATIONS = {'UNION', 'INTERSECT', 'EXCEPT'}
PRECEDES_TABLE_NAME = {'FROM', 'JOIN', 'DESC', 'DESCRIBE', 'WITH'}


def get_full_name(identifier):
    if len(identifier.tokens) > 1 and identifier.tokens[1].value == '.':
        return "{}.{}".format(identifier.tokens[0].value,
                              identifier.tokens[2].value)
    return identifier.get_real_name()


def is_result_operation(keyword):
    for operation in RESULT_OPERATIONS:
        if operation in keyword.upper():
            return True
    return False


def process_identifier(identifier, table_names, aliases):
    # exclude subselects
    if '(' not in identifier.value:
        table_names.append(get_full_name(identifier))
    else:
        # store aliases
        if hasattr(identifier, 'get_alias'):
            aliases.append(identifier.get_alias())
        if hasattr(identifier, 'tokens'):
            # some aliases are not parsed properly
            if identifier.tokens[0].ttype == Name:
                aliases.append(identifier.tokens[0].value)

        extract_from_token(identifier, table_names, aliases)


def extract_from_token(token, table_names, aliases):
    if not hasattr(token, 'tokens'):
        return

    table_name_preceding_token = False

    for item in token.tokens:
        if item.is_group and not isinstance(item, IdentifierList):
            extract_from_token(item, table_names, aliases)

        if item.ttype in Keyword:
            if item.value.upper() in PRECEDES_TABLE_NAME:
                table_name_preceding_token = True
                continue

        if not table_name_preceding_token:
            continue

        if item.ttype in Keyword:
            if is_result_operation(item.value):
                table_name_preceding_token = False
                continue
            # FROM clause is over
            break

        if isinstance(item, Identifier):
            process_identifier(item, table_names, aliases)

        if isinstance(item, IdentifierList):
            for identifier in item.get_identifiers():
                process_identifier(identifier, table_names, aliases)


def extract_tables(sql):
    table_names = []
    aliases = []
    extract_from_token(sqlparse.parse(sql)[0], table_names, aliases)
    return set(table_names) - set(aliases)

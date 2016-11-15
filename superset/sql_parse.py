import sqlparse
from sqlparse.sql import IdentifierList, Identifier
from sqlparse.tokens import Keyword, DML, Name


RESULT_OPERATIONS = {'UNION', 'INTERSECT', 'EXCEPT'}
PRECEDES_TABLE_NAME = {'FROM', 'JOIN', 'DESC', 'DESCRIBE', 'WITH'}


def get_full_name(identifier):
    if len(identifier.tokens) > 1 and identifier.tokens[1].value == '.':
        return "{}.{}".format(identifier.tokens[0].value,
                              identifier.tokens[2].value)
    return identifier.get_real_name()


def has_subselect(parsed):
    if not parsed.is_group:
        return False
    for item in parsed.tokens:
        if item.ttype is DML and item.value.upper() == 'SELECT':
            return True
        if item.is_group:
            return has_subselect(item)
    return False


def is_result_operation(keyword):
    for operation in RESULT_OPERATIONS:
        if operation in keyword.upper():
            return True
    return False


def extract_from_token(token, table_names, table_name_preceding_token=False):
    if not hasattr(token, 'tokens'):
        return

    for item in token.tokens:
        print('Processing token: {}'.format(item))
        print('from_seen: {}'.format(table_name_preceding_token))

        if item.is_group and not isinstance(item, IdentifierList):
            print("Parsing group: {}".format(item.tokens))
            extract_from_token(item, table_names, table_name_preceding_token=False)

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
            # FROM clause if over
            break

        if isinstance(item, Identifier):
            print("Parsing Identifier: {}".format(item))
            # exclude subselects
            if '(' not in item.tokens[0].value:
                table_names.append(get_full_name(item))
            else:
                print("Going inside Identifier: {}".format(item))
                # some subselects are recognized as Identifier,
                # some like generic groups
                extract_from_token(item, table_names)

        if isinstance(item, IdentifierList):
            print("Parsing list: {}".format(list(item.get_identifiers())))
            for identifier in item.get_identifiers():
                print("Parsing Identifier: {}".format(identifier))
                if identifier.tokens[0].ttype == Name:
                    table_names.append(get_full_name(identifier))
                else:
                    # some subselects are recognized as Identifier,
                    # some like generic groups
                    print("Going inside Identifier: {}".format(identifier))
                    extract_from_token(identifier, table_names)


def extract_tables(sql):
    # stream = extract_from_token(sqlparse.parse(sql)[0])
    table_names = []
    extract_from_token(sqlparse.parse(sql)[0], table_names)
    return set(table_names)

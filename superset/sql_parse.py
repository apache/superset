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


def extract_from_token(token, table_names, aliases, table_name_preceding_token=False):
    if not hasattr(token, 'tokens'):
        return

    for item in token.tokens:
        print('Processing token: {}'.format(item.value))
        print('from_seen: {}'.format(table_name_preceding_token))

        if item.is_group and not isinstance(item, IdentifierList):
            print("Parsing group: {}".format(item.tokens))
            extract_from_token(item, table_names, aliases,
                               table_name_preceding_token=False)

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

        def process_identifier(identifier):
            print("Parsing Identifier: {}".format(identifier.value))
            # exclude subselects
            if '(' not in identifier.value:
                print("Found Identifier: {}".format(identifier.value))
                table_names.append(get_full_name(identifier))
            else:
                print("Going inside Identifier: {}".format(identifier.value))
                # some subselects are recognized as Identifier,
                # some like generic groups

                # store aliases
                if hasattr(identifier, 'get_alias'):
                    aliases.append(identifier.get_alias())
                if hasattr(identifier, 'tokens'):
                    # some aliases are not parsed properly
                    if identifier.tokens[0].ttype == Name:
                        aliases.append(identifier.tokens[0].value)

                extract_from_token(identifier, table_names, aliases)

        if isinstance(item, Identifier):
            process_identifier(item)

        if isinstance(item, IdentifierList):
            print("Parsing list: {}".format(list(item.get_identifiers())))
            for identifier in item.get_identifiers():
                print("Parsing Identifier: {}".format(identifier))
                process_identifier(identifier)


def extract_tables(sql):
    # stream = extract_from_token(sqlparse.parse(sql)[0])
    table_names = []
    aliases = []
    extract_from_token(sqlparse.parse(sql)[0], table_names, aliases)
    print("ALIASES ARE {}".format(aliases))
    return set(table_names) - set(aliases)

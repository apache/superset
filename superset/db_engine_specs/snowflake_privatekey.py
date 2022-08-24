import os
from snowflake.sqlalchemy import URL
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric import dsa
from cryptography.hazmat.primitives import serialization
from sqlalchemy import create_engine


def get_param(sqlalchemy_url):
    parameters_map = {}
    # ['snowflake://{user}:{password}@{account}.{region}.{warehouse}.{database}/{schema}', 'privatekey={privatekey}&privatekeypw={privatekeypw}']
    sqlalchemy_url_split_by_question_mark = sqlalchemy_url.split('?')
    # {user}:{password}@{account}.{region}.{warehouse}.{database}/{schema}
    sqlalchemy_url_part_a = sqlalchemy_url_split_by_question_mark[0].replace('snowflake://', '')
    # ['{user}', '{password}@{account}.{region}.{warehouse}.{database}/{schema}']
    sqlalchemy_url_part_a_split_by_colon = sqlalchemy_url_part_a.split(':')
    parameters_map['user'] = sqlalchemy_url_part_a_split_by_colon[0]
    # ['{account}.{region}.{warehouse}.{database}', '{schema}']
    sqlalchemy_url_account_basic_and_schema = sqlalchemy_url_part_a_split_by_colon[1].split('@')[1].split('/')
    parameters_map['database'] = sqlalchemy_url_account_basic_and_schema[1]
    # ['{account}', '{region}', '{warehouse}', '{database}']
    sqlalchemy_url_account_basic = sqlalchemy_url_account_basic_and_schema[0].split('.')
    parameters_map['account'] = sqlalchemy_url_account_basic[0]
    parameters_map['region'] = sqlalchemy_url_account_basic[1]
    sqlalchemy_url_part_b = sqlalchemy_url_split_by_question_mark[1].split('&')
    for param in sqlalchemy_url_part_b:
        kv = param.split('=')
        if kv[0] == 'privatekey':
            parameters_map[kv[0]] = kv[1].replace('%2F', '/')
        else:
            parameters_map[kv[0]] = kv[1]
    # {'user': '{user}', 'database': '{schema}', 'account': '{account}', 'region': '{region}', 'privatekey': '{privatekey}', 'privatekeypw': '{privatekeypw}'}
    return parameters_map

def create_snowflake_url_with_privatekey(sqlalchemy_url):
    param = get_param(sqlalchemy_url)
    return URL(
        user=param['user'],
        account=param['account'],
        region=param['region'],
        warehouse=param['warehouse'],
        database=param['database'],
        schema=param['schema'],
        role=param['role'],
        )
    

def create_snowflake_engine_with_privatekey(sqlalchemy_url):
    param = get_param(sqlalchemy_url)
    with open(param['privatekey'], "rb") as key:
        p_key = serialization.load_pem_private_key(
            key.read(),
            password=param['privatekeypw'].encode(),
            backend=default_backend()
        )

    pkb = p_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption())
    
    engine = create_engine(
        create_snowflake_url_with_privatekey(sqlalchemy_url),
        connect_args={
            'private_key': pkb,
        },
    )
    return engine

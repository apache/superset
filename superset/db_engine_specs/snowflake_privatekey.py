import os
from snowflake.sqlalchemy import URL
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric import dsa
from cryptography.hazmat.primitives import serialization
from sqlalchemy import create_engine


def get_param(sqlalchemy_url):
    cmap = {}
    params = sqlalchemy_url.split('?')
    url1 = params[0].replace('snowflake://', '')
    usp3 = url1.split(':')
    cmap['user'] = usp3[0]
    usp4 = usp3[1].split('@')[1].split('/')
    cmap['database'] = usp4[1]
    usp5 = usp4[0].split('.')
    cmap['account'] = usp5[0]
    cmap['region'] = usp5[1]
    url2 = params[1].split('&')
    for param in url2:
        kv = param.split('=')
        if kv[0] == 'privatekey':
            cmap[kv[0]] = kv[1].replace('%2F', '/')
        else:
            cmap[kv[0]] = kv[1]
    print("======================================================")
    print(cmap)
    print("======================================================")
    return cmap

def create_sn_url(sqlalchemy_url):
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
    

def create_sn_engin(sqlalchemy_url):
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
    

    # engine = database.get_sqla_engine()
    engine = create_engine(
        create_sn_url(sqlalchemy_url),
        connect_args={
            'private_key': pkb,
        },
    )
    return engine

# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
import os
from sqlalchemy.engine.url import make_url
from snowflake.sqlalchemy import URL
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric import dsa
from cryptography.hazmat.primitives import serialization
from sqlalchemy import create_engine


def get_param(sqlalchemy_url):
    url = make_url(sqlalchemy_url)
    param = dict(url.query.items())
    return url, param

def create_snowflake_url_with_privatekey(sqlalchemy_url):
    url, query = get_param(sqlalchemy_url)
    url_obj = None
    if query.get("region") is None:
        url_obj = URL(
            user=url.username,
            account=url.host,
            database=url.database,
            warehouse=query.get("warehouse"),
            schema=query.get("schema"),
            role=query.get("role"),
        )
    else:
        url_obj = URL(
            user=url.username,
            account=url.host,
            region=query.get("region"),
            database=url.database,
            warehouse=query.get("warehouse"),
            schema=query.get("schema"),
            role=query.get("role"),
        )
    return url_obj
    

def create_snowflake_engine_with_privatekey(sqlalchemy_url):
    url, param = get_param(sqlalchemy_url)
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

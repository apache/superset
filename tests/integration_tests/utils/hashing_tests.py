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
import datetime
import math
from typing import Any
from unittest.mock import patch

import pytest  # noqa: F401

from superset.utils.hashing import hash_from_dict, hash_from_str


def test_basic_md5_sha():
    """Test basic hashing with MD5 (legacy mode)."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="md5"):
        obj = {
            "product": "Coffee",
            "company": "Gobias Industries",
            "price_in_cents": 4000,
        }

        serialized_obj = '{"company": "Gobias Industries", "price_in_cents": 4000, "product": "Coffee"}'  # noqa: E501

        assert hash_from_str(serialized_obj) == hash_from_dict(obj)
        assert hash_from_str(serialized_obj) == "35f22273cd6a6798b04f8ddef51135e3"


def test_basic_sha256():
    """Test basic hashing with SHA-256 (FedRAMP compliant mode)."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="sha256"):
        obj = {
            "product": "Coffee",
            "company": "Gobias Industries",
            "price_in_cents": 4000,
        }

        serialized_obj = '{"company": "Gobias Industries", "price_in_cents": 4000, "product": "Coffee"}'  # noqa: E501

        assert hash_from_str(serialized_obj) == hash_from_dict(obj)
        # SHA-256 hash of the serialized object
        assert (
            hash_from_str(serialized_obj)
            == "77bc5927f828903888572ab91c4f3114b36609ca5fb92039bef380d622cef596"
        )


def test_sort_order_md5_sha():
    """Test dictionary key order independence with MD5."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="md5"):
        obj_1 = {
            "product": "Coffee",
            "price_in_cents": 4000,
            "company": "Gobias Industries",
        }

        obj_2 = {
            "product": "Coffee",
            "company": "Gobias Industries",
            "price_in_cents": 4000,
        }

        assert hash_from_dict(obj_1) == hash_from_dict(obj_2)
        assert hash_from_dict(obj_1) == "35f22273cd6a6798b04f8ddef51135e3"


def test_sort_order_sha256():
    """Test dictionary key order independence with SHA-256."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="sha256"):
        obj_1 = {
            "product": "Coffee",
            "price_in_cents": 4000,
            "company": "Gobias Industries",
        }

        obj_2 = {
            "product": "Coffee",
            "company": "Gobias Industries",
            "price_in_cents": 4000,
        }

        assert hash_from_dict(obj_1) == hash_from_dict(obj_2)
        assert (
            hash_from_dict(obj_1)
            == "77bc5927f828903888572ab91c4f3114b36609ca5fb92039bef380d622cef596"
        )


def test_custom_default_md5_sha():
    """Test custom serializer with MD5."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="md5"):

        def custom_datetime_serializer(obj: Any):
            if isinstance(obj, datetime.datetime):
                return "<datetime>"

        obj = {
            "product": "Coffee",
            "company": "Gobias Industries",
            "datetime": datetime.datetime.now(),
        }

        serialized_obj = '{"company": "Gobias Industries", "datetime": "<datetime>", "product": "Coffee"}'  # noqa: E501

        assert hash_from_str(serialized_obj) == hash_from_dict(
            obj, default=custom_datetime_serializer
        )
        assert hash_from_str(serialized_obj) == "dc280121213aabcaeb8087aef268fd0d"


def test_custom_default_sha256():
    """Test custom serializer with SHA-256."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="sha256"):

        def custom_datetime_serializer(obj: Any):
            if isinstance(obj, datetime.datetime):
                return "<datetime>"

        obj = {
            "product": "Coffee",
            "company": "Gobias Industries",
            "datetime": datetime.datetime.now(),
        }

        serialized_obj = '{"company": "Gobias Industries", "datetime": "<datetime>", "product": "Coffee"}'  # noqa: E501

        assert hash_from_str(serialized_obj) == hash_from_dict(
            obj, default=custom_datetime_serializer
        )
        assert (
            hash_from_str(serialized_obj)
            == "417b57b6f3979bdd0937286f2dc872089fcd5fdb7daad1d3dbcaae1e34cc564e"
        )


def test_ignore_nan_md5_sha():
    """Test NaN handling with MD5."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="md5"):
        obj = {
            "product": "Coffee",
            "company": "Gobias Industries",
            "price": math.nan,
        }

        serialized_obj = (
            '{"company": "Gobias Industries", "price": NaN, "product": "Coffee"}'
        )

        assert hash_from_str(serialized_obj) == hash_from_dict(obj)
        assert hash_from_str(serialized_obj) == "5d129d1dffebc0bacc734366476d586d"

        serialized_obj = (
            '{"company": "Gobias Industries", "price": null, "product": "Coffee"}'
        )

        assert hash_from_str(serialized_obj) == hash_from_dict(obj, ignore_nan=True)
        assert hash_from_str(serialized_obj) == "40e87d61f6add03816bccdeac5713b9f"


def test_ignore_nan_sha256():
    """Test NaN handling with SHA-256."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="sha256"):
        obj = {
            "product": "Coffee",
            "company": "Gobias Industries",
            "price": math.nan,
        }

        serialized_obj = (
            '{"company": "Gobias Industries", "price": NaN, "product": "Coffee"}'
        )

        assert hash_from_str(serialized_obj) == hash_from_dict(obj)
        assert (
            hash_from_str(serialized_obj)
            == "efff87146d137b2d0392eff94b74e7644c3a6b135b91563400029995b9236820"
        )

        serialized_obj = (
            '{"company": "Gobias Industries", "price": null, "product": "Coffee"}'
        )

        assert hash_from_str(serialized_obj) == hash_from_dict(obj, ignore_nan=True)
        assert (
            hash_from_str(serialized_obj)
            == "9b66e0af1cb74aa58c3ab08654c086ebfdada14b1e6312b4002edc854d99d24d"
        )

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
from base64 import b85encode
from hashlib import md5
from inspect import (
    getmembers,
    getsourcefile,
    getsourcelines,
    isclass,
    isfunction,
    isroutine,
    signature,
)
from textwrap import indent
from typing import Any, Callable


def compute_hash(decorated: Callable[..., Any]) -> str:
    if isfunction(decorated):
        return compute_func_hash(decorated)

    if isclass(decorated):
        return compute_class_hash(decorated)

    raise Exception(f"Invalid decorated object: {decorated}")


def compute_func_hash(function: Callable[..., Any]) -> str:
    hashed = md5()
    hashed.update(function.__name__.encode())
    hashed.update(str(signature(function)).encode())
    return b85encode(hashed.digest()).decode("utf-8")


def compute_class_hash(class_: Callable[..., Any]) -> str:
    hashed = md5()
    public_methods = {
        method
        for name, method in getmembers(class_, predicate=isroutine)
        if not name.startswith("_") or name == "__init__"
    }
    for method in public_methods:
        hashed.update(method.__name__.encode())
        hashed.update(str(signature(method)).encode())
    return b85encode(hashed.digest()).decode("utf-8")


def get_warning_message(decorated: Callable[..., Any], expected_hash: str) -> str:
    sourcefile = getsourcefile(decorated)
    sourcelines = getsourcelines(decorated)
    code = indent("".join(sourcelines[0]), "    ")
    lineno = sourcelines[1]
    return (
        f"The decorated object `{decorated.__name__}` (in {sourcefile} "
        f"line {lineno}) has a public interface which has currently been "
        "modified. This MUST only be released in a new major version of "
        "Superset according to SIP-57. To remove this warning message "
        f"update the associated hash to '{expected_hash}'.\n\n{code}"
    )

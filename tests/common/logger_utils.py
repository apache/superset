#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.
from __future__ import annotations

import logging
from functools import wraps
from inspect import (
    getcallargs,
    getmembers,
    getmodule,
    isclass,
    isfunction,
    ismethod,
    Signature,
    signature,
)
from logging import Logger
from typing import Any, Callable, cast, Union

_DEFAULT_ENTER_MSG_PREFIX = "enter to "
_DEFAULT_ENTER_MSG_SUFFIX = ""
_DEFAULT_WITH_ARGUMENTS_MSG_PART = " with: "
_DEFAULT_EXIT_MSG_PREFIX = "exit from "
_DEFAULT_EXIT_MSG_SUFFIX = ""
_DEFAULT_RETURN_VALUE_MSG_PART = " with return value: "

_CLS_PARAM = "cls"
_SELF_PARAM = "self"
_PRIVATE_PREFIX_SYMBOL = "_"
_FIXTURE_ATTRIBUTE = "_pytestfixturefunction"
_LOGGER_VAR_NAME = "logger"

empty_and_none = {Signature.empty, "None"}


Function = Callable[..., Any]
Decorated = Union[type[Any], Function]


def log(
    decorated: Decorated | None = None,
    *,
    prefix_enter_msg: str = _DEFAULT_ENTER_MSG_PREFIX,
    suffix_enter_msg: str = _DEFAULT_ENTER_MSG_SUFFIX,
    with_arguments_msg_part=_DEFAULT_WITH_ARGUMENTS_MSG_PART,
    prefix_exit_msg: str = _DEFAULT_EXIT_MSG_PREFIX,
    suffix_exit_msg: str = _DEFAULT_EXIT_MSG_SUFFIX,
    return_value_msg_part=_DEFAULT_RETURN_VALUE_MSG_PART,
) -> Decorated:
    decorator: Decorated = _make_decorator(
        prefix_enter_msg,
        suffix_enter_msg,
        with_arguments_msg_part,
        prefix_exit_msg,
        suffix_exit_msg,
        return_value_msg_part,
    )
    if decorated is None:
        return decorator
    return decorator(decorated)


def _make_decorator(
    prefix_enter_msg: str,
    suffix_enter_msg: str,
    with_arguments_msg_part,
    prefix_out_msg: str,
    suffix_out_msg: str,
    return_value_msg_part,
) -> Decorated:
    def decorator(decorated: Decorated):
        decorated_logger = _get_logger(decorated)

        def decorator_class(clazz: type[Any]) -> type[Any]:
            _decorate_class_members_with_logs(clazz)
            return clazz

        def _decorate_class_members_with_logs(clazz: type[Any]) -> None:
            members = getmembers(
                clazz, predicate=lambda val: ismethod(val) or isfunction(val)
            )
            for member_name, member in members:
                setattr(clazz, member_name, decorator_func(member, f"{clazz.__name__}"))

        def decorator_func(func: Function, prefix_name: str = "") -> Function:
            func_name = func.__name__
            func_signature: Signature = signature(func)
            is_fixture = hasattr(func, _FIXTURE_ATTRIBUTE)
            has_return_value = func_signature.return_annotation not in empty_and_none
            is_private = func_name.startswith(_PRIVATE_PREFIX_SYMBOL)
            full_func_name = f"{prefix_name}.{func_name}"
            under_info = None
            debug_enable = None

            @wraps(func)
            def _wrapper_func(*args, **kwargs) -> Any:
                _log_enter_to_function(*args, **kwargs)
                val = func(*args, **kwargs)
                _log_exit_of_function(val)
                return val

            def _log_enter_to_function(*args, **kwargs) -> None:
                if _is_log_info():
                    decorated_logger.info(
                        f"{prefix_enter_msg}'{full_func_name}'{suffix_enter_msg}"
                    )
                elif _is_debug_enable():
                    _log_debug(*args, **kwargs)

            def _is_log_info() -> bool:
                return not (_is_under_info() or is_private or is_fixture)

            def _is_under_info() -> bool:
                nonlocal under_info
                if under_info is None:
                    under_info = decorated_logger.getEffectiveLevel() < logging.INFO
                return under_info

            def _is_debug_enable() -> bool:
                nonlocal debug_enable
                if debug_enable is None:
                    debug_enable = decorated_logger.isEnabledFor(logging.DEBUG)
                return debug_enable

            def _log_debug(*args, **kwargs) -> None:
                used_parameters = getcallargs(func, *args, **kwargs)
                _SELF_PARAM in used_parameters and used_parameters.pop(_SELF_PARAM)
                _CLS_PARAM in used_parameters and used_parameters.pop(_CLS_PARAM)
                if used_parameters:
                    decorated_logger.debug(
                        f"{prefix_enter_msg}'{full_func_name}'{with_arguments_msg_part}"
                        f"{used_parameters}{suffix_enter_msg}"
                    )
                else:
                    decorated_logger.debug(
                        f"{prefix_enter_msg}'{full_func_name}'{suffix_enter_msg}"
                    )

            def _log_exit_of_function(return_value: Any) -> None:
                if _is_debug_enable() and has_return_value:
                    decorated_logger.debug(
                        f"{prefix_out_msg}'{full_func_name}'{return_value_msg_part}"
                        f"'{return_value}'{suffix_out_msg}"
                    )

            return _wrapper_func

        if isclass(decorated):
            return decorator_class(cast(type[Any], decorated))
        return decorator_func(cast(Function, decorated))

    return decorator


def _get_logger(decorated: Decorated) -> Logger:
    module = getmodule(decorated)
    return module.__dict__.get(
        _LOGGER_VAR_NAME,
        logging.getLogger(module.__name__),  # type: ignore
    )

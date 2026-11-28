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
from pathlib import PureWindowsPath

from werkzeug.datastructures import FileStorage

from superset.commands.importers.exceptions import IncorrectFormatError

CSS_FILE_EXTENSION = ".css"

# Upper bound, in bytes, on a single imported CSS file. Dashboard CSS is
# typically a few kilobytes, so this leaves ample headroom while keeping the
# memory used by one upload bounded.
CSS_FILE_MAX_SIZE_BYTES = 1024 * 1024

# Upper bound on the files accepted by one import. Together with
# ``CSS_FILE_MAX_SIZE_BYTES`` it bounds the memory held by a single request.
CSS_IMPORT_MAX_FILES = 20


def get_base_name(file_name: str) -> str:
    """
    Return the final component of an uploaded file's name.

    Some clients send the full client-side path rather than the bare file name;
    ``PureWindowsPath`` splits on both ``/`` and ``\\`` so either form is handled.

    :param file_name: The file name as sent by the client
    :returns: The file name without any directory components
    """
    return PureWindowsPath(file_name).name


def is_css_file(file_name: str) -> bool:
    """
    Check whether a file name has a ``.css`` extension (case-insensitive).

    :param file_name: The file name as sent by the client
    :returns: Whether the file name ends with ``.css``
    """
    return get_base_name(file_name).lower().endswith(CSS_FILE_EXTENSION)


def get_template_name(file_name: str) -> str:
    """
    Derive a CSS template name from an uploaded file's name.

    The template name is the file's base name with the ``.css`` extension
    removed, e.g. ``dark_mode.css`` becomes ``dark_mode``.

    :param file_name: The file name as sent by the client
    :returns: The template name
    """
    base_name = get_base_name(file_name)
    if base_name.lower().endswith(CSS_FILE_EXTENSION):
        return base_name[: -len(CSS_FILE_EXTENSION)]
    return base_name


def read_css_file(upload: FileStorage) -> str:
    """
    Read an uploaded CSS file into a string.

    :param upload: The uploaded file
    :returns: The file's contents, decoded as UTF-8
    :raises IncorrectFormatError: If the file is not a ``.css`` file, is larger
        than ``CSS_FILE_MAX_SIZE_BYTES``, or is not valid UTF-8
    """
    file_name = get_base_name(upload.filename or "")
    if not is_css_file(file_name):
        raise IncorrectFormatError(f"File {file_name} is not a CSS file")

    # Read one byte past the limit so an oversized file is detected without
    # buffering all of it.
    data = upload.stream.read(CSS_FILE_MAX_SIZE_BYTES + 1)
    if len(data) > CSS_FILE_MAX_SIZE_BYTES:
        raise IncorrectFormatError(
            f"File {file_name} exceeds the maximum size of "
            f"{CSS_FILE_MAX_SIZE_BYTES // 1024} KB"
        )

    try:
        # ``utf-8-sig`` drops a leading byte order mark, if present.
        return data.decode("utf-8-sig")
    except UnicodeDecodeError as ex:
        raise IncorrectFormatError(f"File {file_name} is not valid UTF-8") from ex

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
import logging
from collections.abc import Generator
from io import BytesIO
from pathlib import Path
from typing import Any, IO, Optional
from zipfile import BadZipfile, is_zipfile, ZipFile

import pandas as pd
import pyarrow.parquet as pq
from flask_babel import lazy_gettext as _
from pyarrow.lib import ArrowException
from werkzeug.datastructures import FileStorage

from superset.commands.database.exceptions import DatabaseUploadFailed
from superset.commands.database.uploaders.base import (
    BaseDataReader,
    FileMetadata,
    ReaderOptions,
)

logger = logging.getLogger(__name__)


class ColumnarReaderOptions(ReaderOptions, total=False):
    columns_read: list[str]


class ColumnarReader(BaseDataReader):
    def __init__(
        self,
        options: Optional[ColumnarReaderOptions] = None,
    ) -> None:
        options = options or {}
        super().__init__(
            options=dict(options),
        )

    def _read_buffer_to_dataframe(self, buffer: IO[bytes]) -> pd.DataFrame:
        kwargs: dict[str, Any] = {
            "path": buffer,
        }
        if self._options.get("columns_read"):
            kwargs["columns"] = self._options.get("columns_read")
        try:
            return pd.read_parquet(**kwargs)
        except (
            pd.errors.ParserError,
            pd.errors.EmptyDataError,
            UnicodeDecodeError,
            ValueError,
        ) as ex:
            raise DatabaseUploadFailed(
                message=_("Parsing error: %(error)s", error=str(ex))
            ) from ex
        except Exception as ex:
            raise DatabaseUploadFailed(_("Error reading Columnar file")) from ex

    @staticmethod
    def _yield_files(file: FileStorage) -> Generator[IO[bytes], None, None]:
        """
        Yields files from the provided file. If the file is a zip file, it yields each
        file within the zip file. If it's a single file, it yields the file itself.

        :param file: The file to yield files from.
        :return: A generator that yields files.
        """
        file_suffix = Path(file.filename).suffix
        if not file_suffix:
            raise DatabaseUploadFailed(_("Unexpected no file extension found"))
        file_suffix = file_suffix[1:]  # remove the dot
        if file_suffix == "zip":
            if not is_zipfile(file):
                raise DatabaseUploadFailed(_("Not a valid ZIP file"))
            try:
                with ZipFile(file) as zip_file:
                    # check if all file types are of the same extension
                    file_suffixes = {Path(name).suffix for name in zip_file.namelist()}
                    if len(file_suffixes) > 1:
                        raise DatabaseUploadFailed(
                            _("ZIP file contains multiple file types")
                        )
                    for filename in zip_file.namelist():
                        with zip_file.open(filename) as file_in_zip:
                            yield BytesIO(file_in_zip.read())
            except BadZipfile as ex:
                raise DatabaseUploadFailed(_("Not a valid ZIP file")) from ex
        else:
            yield file

    def file_to_dataframe(self, file: FileStorage) -> pd.DataFrame:
        """
        Read Columnar file into a DataFrame

        :return: pandas DataFrame
        :throws DatabaseUploadFailed: if there is an error reading the file
        """
        return pd.concat(
            self._read_buffer_to_dataframe(buffer) for buffer in self._yield_files(file)
        )

    def file_metadata(self, file: FileStorage) -> FileMetadata:
        column_names = set()
        try:
            for file_item in self._yield_files(file):
                parquet_file = pq.ParquetFile(file_item)
                column_names.update(parquet_file.metadata.schema.names)  # pylint: disable=no-member
        except ArrowException as ex:
            raise DatabaseUploadFailed(
                message=_("Parsing error: %(error)s", error=str(ex))
            ) from ex
        return {
            "items": [
                {
                    "column_names": list(column_names),
                    "sheet_name": None,
                }
            ]
        }

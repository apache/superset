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
# pylint: disable=C,R,W


class SupersetException(Exception):
    status = 500

    def __init__(self, msg):
        super(SupersetException, self).__init__(msg)


class SupersetTimeoutException(SupersetException):
    pass


class SupersetSecurityException(SupersetException):
    status = 401

    def __init__(self, msg, link=None):
        super(SupersetSecurityException, self).__init__(msg)
        self.link = link


class NoDataException(SupersetException):
    status = 400


class NullValueException(SupersetException):
    status = 400


class SupersetTemplateException(SupersetException):
    pass


class SpatialException(SupersetException):
    pass


class CsvException(SupersetException):
    def __init__(self, msg, orig_e):
        super(CsvException, self).__init__(msg)
        self.orig = orig_e


class DatabaseFileAlreadyExistsException(CsvException):
    status = 400


class DatabaseAlreadyExistException(CsvException):
    status = 400


class DatabaseNotFoundException(CsvException):
    status = 400


class DatabaseCreationException(CsvException):
    status = 400


class DatabaseDeletionException(CsvException):
    status = 500


class FileSaveException(CsvException):
    status = 500


class NameNotAllowedException(CsvException):
    status = 400


class NoPasswordSuppliedException(CsvException):
    status = 400


class NoUsernameSuppliedException(CsvException):
    status = 400


class GetDatabaseException(CsvException):
    status = 400


class SchemaNotAllowedCsvUploadException(CsvException):
    status = 400


class TableCreationException(CsvException):
    status = 400


class InvalidURIException(SupersetException):
    status = 400


class SqlException(SupersetException):
    def __init__(self, msg, orig_e):
        super(SqlException, self).__init__(msg)
        self.orig = orig_e

    status = 500


class TableNotFoundException(SupersetException):
    status = 400


class SqlSelectException(SqlException):
    status = 500


class SqlAddColumnException(SqlException):
    status = 500


class SqlUpdateException(SqlException):
    status = 500


class NoAPIKeySuppliedException(SupersetException):
    status = 400

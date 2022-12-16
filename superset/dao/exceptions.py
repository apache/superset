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
from superset.exceptions import SupersetException


class DAOException(SupersetException):
    """
    Base DAO exception class
    """


class DAOCreateFailedError(DAOException):
    """
    DAO Create failed
    """

    message = "Create failed"


class DAOUpdateFailedError(DAOException):
    """
    DAO Update failed
    """

    message = "Updated failed"


class DAODeleteFailedError(DAOException):
    """
    DAO Delete failed
    """

    message = "Delete failed"


class DAOConfigError(DAOException):
    """
    DAO is miss configured
    """

    message = "DAO is not configured correctly missing model definition"


class DatasourceTypeNotSupportedError(DAOException):
    """
    DAO datasource query source type is not supported
    """

    status = 422
    message = "DAO datasource query source type is not supported"


class DatasourceNotFound(DAOException):
    status = 404
    message = "Datasource does not exist"

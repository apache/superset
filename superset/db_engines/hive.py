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


# TODO: contribute back to pyhive.
def fetch_logs(self, max_rows=1024, orientation=None):
    """Mocked. Retrieve the logs produced by the execution of the query.
    Can be called multiple times to fetch the logs produced after
    the previous call.
    :returns: list<str>
    :raises: ``ProgrammingError`` when no query has been started
    .. note::
        This is not a part of DB-API.
    """
    from pyhive import hive  # noqa
    from TCLIService import ttypes  # noqa
    from thrift import Thrift  # pylint: disable=import-error

    orientation = orientation or ttypes.TFetchOrientation.FETCH_NEXT
    try:
        req = ttypes.TGetLogReq(operationHandle=self._operationHandle)
        logs = self._connection.client.GetLog(req).log
        return logs
    # raised if Hive is used
    except (ttypes.TApplicationException, Thrift.TApplicationException):
        if self._state == self._STATE_NONE:
            raise hive.ProgrammingError("No query yet")
        logs = []
        while True:
            req = ttypes.TFetchResultsReq(
                operationHandle=self._operationHandle,
                orientation=ttypes.TFetchOrientation.FETCH_NEXT,
                maxRows=self.arraysize,
                fetchType=1,  # 0: results, 1: logs
            )
            response = self._connection.client.FetchResults(req)
            hive._check_status(response)
            assert not response.results.rows, "expected data in columnar format"
            assert len(response.results.columns) == 1, response.results.columns
            new_logs = hive._unwrap_column(response.results.columns[0])
            logs += new_logs
            if not new_logs:
                break
        return "\n".join(logs)

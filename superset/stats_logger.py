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

from colorama import Fore, Style


class BaseStatsLogger:
    """Base class for logging realtime events"""

    def __init__(self, prefix="superset"):
        self.prefix = prefix

    def key(self, key):
        if self.prefix:
            return self.prefix + key
        return key

    def incr(self, key):
        """Increment a counter"""
        raise NotImplementedError()

    def decr(self, key):
        """Decrement a counter"""
        raise NotImplementedError()

    def timing(self, key, value):
        raise NotImplementedError()

    def gauge(self, key):
        """Setup a gauge"""
        raise NotImplementedError()


class DummyStatsLogger(BaseStatsLogger):
    def incr(self, key):
        logging.debug(Fore.CYAN + "[stats_logger] (incr) " + key + Style.RESET_ALL)

    def decr(self, key):
        logging.debug((Fore.CYAN + "[stats_logger] (decr) " + key + Style.RESET_ALL))

    def timing(self, key, value):
        logging.debug(
            (Fore.CYAN + f"[stats_logger] (timing) {key} | {value} " + Style.RESET_ALL)
        )

    def gauge(self, key):
        logging.debug(
            (Fore.CYAN + "[stats_logger] (gauge) " + f"{key}" + Style.RESET_ALL)
        )


try:
    from statsd import StatsClient

    class StatsdStatsLogger(BaseStatsLogger):
        def __init__(  # pylint: disable=super-init-not-called
            self, host="localhost", port=8125, prefix="superset", statsd_client=None
        ):
            """
            Initializes from either params or a supplied, pre-constructed statsd client.

            If statsd_client argument is given, all other arguments are ignored and the
            supplied client will be used to emit metrics.
            """
            if statsd_client:
                self.client = statsd_client
            else:
                self.client = StatsClient(host=host, port=port, prefix=prefix)

        def incr(self, key):
            self.client.incr(key)

        def decr(self, key):
            self.client.decr(key)

        def timing(self, key, value):
            self.client.timing(key, value)

        def gauge(self, key):
            # pylint: disable=no-value-for-parameter
            self.client.gauge(key)


except Exception:  # pylint: disable=broad-except
    pass

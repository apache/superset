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

"""
TODO: Clean this up! The current pattern of accessing app props on package init means
    that we need to ensure the creation of our Flask app BEFORE any tests load
"""
from os import environ
environ.setdefault("SUPERSET_CONFIG", "tests.superset_test_config")

from superset.app import create_app
app = create_app()
# ctx = app.test_request_context()
# ctx.push()

..  Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

..    http://www.apache.org/licenses/LICENSE-2.0

..  Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.

Issue Code Reference
====================

This page lists issue codes that may be displayed in Superset and provides additional context.

Issue 1000
""""""""""

.. code-block:: text

    The datasource is too large to query.

It's likely your datasource has grown too large to run the current query, and is timing out. You can resolve this by reducing the size of your datasource or by modifying your query to only process a subset of your data.

Issue 1001
""""""""""

.. code-block:: text

    The database is under an unusual load.

Your query may have timed out because of unusually high load on the database engine. You can make your query simpler, or wait until the database is under less load and try again.

Issue 1002
""""""""""

.. code-block:: text

    The database returned an unexpected error.

Your query failed because of an error that occurred on the database. This may be due to a syntax error, a bug in your query, or some other internal failure within the database. This is usually not an issue within Superset, but instead a problem with the underlying database that serves your query.

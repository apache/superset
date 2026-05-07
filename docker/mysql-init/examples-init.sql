-- Licensed to the Apache Software Foundation (ASF) under one
-- or more contributor license agreements.  See the NOTICE file
-- distributed with this work for additional information
-- regarding copyright ownership.  The ASF licenses this file
-- to you under the Apache License, Version 2.0 (the
-- "License"); you may not use this file except in compliance
-- with the License.  You may obtain a copy of the License at
--
--   http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing,
-- software distributed under the License is distributed on an
-- "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
-- KIND, either express or implied.  See the License for the
-- specific language governing permissions and limitations
-- under the License.

-- MySQL counterpart to docker/docker-entrypoint-initdb.d/examples-init.sh.
-- Creates the analytics-examples database and user that Superset's
-- ``load-examples`` command writes to. Mounted by docker-compose-mysql.yml
-- at /docker-entrypoint-initdb.d/ so the MySQL image's first-boot
-- entrypoint runs it automatically. (The Postgres init scripts under
-- docker/docker-entrypoint-initdb.d/ are NOT mounted on the MySQL
-- service — they invoke psql, which doesn't exist in the MySQL image.)

CREATE DATABASE IF NOT EXISTS examples
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'examples'@'%' IDENTIFIED BY 'examples';
GRANT ALL PRIVILEGES ON examples.* TO 'examples'@'%';
FLUSH PRIVILEGES;

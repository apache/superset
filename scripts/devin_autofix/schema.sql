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

CREATE TABLE IF NOT EXISTS automation_runs (
  run_id TEXT PRIMARY KEY,
  issue_number INTEGER NOT NULL,
  issue_type TEXT,
  issue_title TEXT,
  issue_url TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  status TEXT NOT NULL,
  devin_session_url TEXT,
  pr_number INTEGER,
  pr_url TEXT,
  acceptance_criteria_source TEXT,
  reviewer_login TEXT,
  review_requested INTEGER,
  checks_total INTEGER,
  checks_passed INTEGER,
  checks_failed INTEGER,
  review_outcome TEXT,
  return_reason TEXT,
  triggered_at TEXT,
  pr_created_at TEXT,
  merged_at TEXT,
  reverted_at TEXT,
  time_to_pr_seconds INTEGER,
  time_to_merge_seconds INTEGER
);

CREATE TABLE IF NOT EXISTS automation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_time TEXT NOT NULL,
  github_url TEXT,
  payload_json TEXT
);

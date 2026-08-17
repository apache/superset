/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import type { chat as chatApi } from '@apache-superset/core';

type ClientTool = chatApi.ClientTool;

// Not yet implemented — see the client MCP tools SIP's "SQL Lab" candidate
// core actions table (get_current_editor_id, update_editor_sql,
// run_current_query, save_current_query_as_saved_query).
const sqlLabTools: ClientTool[] = [];

export default sqlLabTools;

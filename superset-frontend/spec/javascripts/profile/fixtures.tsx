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
export const user = {
  username: 'alpha',
  roles: {
    Alpha: [
      ['can_this_form_post', 'ResetMyPasswordView'],
      ['can_this_form_get', 'ResetMyPasswordView'],
      ['can_this_form_post', 'UserInfoEditView'],
      ['can_this_form_get', 'UserInfoEditView'],
    ],
    sql_lab: [
      ['menu_access', 'SQL Lab'],
      ['can_sql_json', 'Superset'],
      ['can_search_queries', 'Superset'],
      ['can_csv', 'Superset'],
    ],
  },
  firstName: 'alpha',
  lastName: 'alpha',
  createdOn: '2016-11-11T12:34:17',
  userId: 5,
  email: 'alpha@alpha.com',
  isActive: true,
  permissions: {
    datasource_access: ['table1', 'table2'],
    database_access: ['db1', 'db2', 'db3'],
  },
};
export const userNoPerms = { ...user, permissions: {} };

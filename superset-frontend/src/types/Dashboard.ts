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

/**
 * The Dashboard model as returned from the API
 */

import Owner from './Owner';

export default interface Dashboard {
  changed_by_name: string;
  changed_by_url: string;
  changed_by: string;
  changed_on_delta_humanized: string;
  created_by: object;
  dashboard_title: string;
  id: number;
  loading?: boolean;
  owners: Owner[];
  published: boolean;
  slice_name?: string;
  thumbnail_url: string;
  url: string;
}

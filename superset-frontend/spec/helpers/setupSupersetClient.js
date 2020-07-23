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
import fetchMock from 'fetch-mock';
import { SupersetClient } from '@superset-ui/connection';

export default function setupSupersetClient() {
  // The following is needed to mock out SupersetClient requests
  // including CSRF authentication and initialization
  global.FormData = window.FormData; // used by SupersetClient
  fetchMock.get('glob:*superset/csrf_token/*', { csrf_token: '1234' });
  SupersetClient.configure({ protocol: 'http', host: 'localhost' }).init();
}

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
import MultiChartPlugin from './index';

test('suppresses the no-results empty state since it self-fetches its layers', () => {
  // The multi-layer chart issues no query of its own, so its empty query
  // response must not trigger "No results were returned for this query" (which
  // would hide the map). Regression guard for the drop of useLegacyApi.
  const plugin = new MultiChartPlugin();
  expect(plugin.metadata.enableNoResults).toBe(false);
});

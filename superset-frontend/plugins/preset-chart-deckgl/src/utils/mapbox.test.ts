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

import { getMapboxApiKey, hasMapboxApiKey } from './mapbox';

const setBootstrap = (conf: Record<string, unknown>) => {
  document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify({
    common: { conf },
  })}'></div>`;
};

test('deck.gl Mapbox helpers read key presence from bootstrap data', () => {
  setBootstrap({ MAPBOX_API_KEY: 'pk.test' });

  expect(getMapboxApiKey()).toBe('pk.test');
  expect(hasMapboxApiKey()).toBe(true);

  setBootstrap({});

  expect(getMapboxApiKey()).toBe('');
  expect(hasMapboxApiKey()).toBe(false);
});

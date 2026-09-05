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
 * @deck.gl/mapbox's terrain-camera path (used by DeckGLOverlayMapLibre) reads
 * maplibre-gl's internal `map.transform` property directly. maplibre-gl 6
 * removed that property, so this package's maplibre-gl range stays pinned
 * below 6 (see package.json) independent of the rest of the monorepo, which
 * moved to maplibre-gl 6 in #42608.
 *
 * This is a tripwire, not a feature test: it fails loudly if the pin is ever
 * lifted (package.json's maplibre-gl range bumped past ^5) without first
 * confirming @deck.gl/mapbox no longer needs the removed property.
 */
test('maplibre-gl stays pinned below 6 until @deck.gl/mapbox drops its map.transform usage', () => {
  // eslint-disable-next-line global-require
  const { version } = require('maplibre-gl/package.json');
  const [major] = version.split('.').map(Number);
  expect(major).toBeLessThan(6);
});

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
import { render } from '@superset-ui/core/spec';
import { TelemetryPixel } from '.';

const OLD_ENV = process.env;

// restor the process after messing with it!
afterAll(() => {
  process.env = OLD_ENV;
});

test('should render', () => {
  const { container } = render(<TelemetryPixel />);
  expect(container).toBeInTheDocument();
});

test('should render the pixel link when FF is on', () => {
  process.env.SCARF_ANALYTICS = 'true';
  render(<TelemetryPixel version="1.2.3" sha="abc" build="42" />);

  // Hits Scarf's static pixel directly, not the gateway redirect that browsers flag
  const image = document.querySelector('img[src^="https://static.scarf.sh/"]');
  expect(image).toBeInTheDocument();
  expect(image?.getAttribute('src')).toContain('version=1.2.3');
  expect(image?.getAttribute('src')).toContain('sha=abc');
  expect(image?.getAttribute('src')).toContain('build=42');
  expect(document.querySelector('img[src*="gateway.scarf.sh"]')).toBeNull();
});

test('should NOT render the pixel link when FF is off', () => {
  process.env.SCARF_ANALYTICS = 'false';
  render(<TelemetryPixel />);

  const image = document.querySelector('img[src*="scarf.sh"]');
  expect(image).not.toBeInTheDocument();
});

test('should NOT render the pixel link when disabled at runtime', () => {
  process.env.SCARF_ANALYTICS = 'true';
  render(<TelemetryPixel enabled={false} />);

  const image = document.querySelector('img[src*="scarf.sh"]');
  expect(image).not.toBeInTheDocument();
});

test('should render the pixel link when enabled at runtime', () => {
  process.env.SCARF_ANALYTICS = 'true';
  render(<TelemetryPixel enabled />);

  const image = document.querySelector('img[src*="scarf.sh"]');
  expect(image).toBeInTheDocument();
});

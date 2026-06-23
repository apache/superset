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
import controlPanel from '../src/plugin/controlPanel';
import React, { ReactElement } from 'react';

const isNameControl = (
  item: unknown,
  name: string,
): item is ReactElement<{ name: string }> =>
  React.isValidElement<{ name: string }>(item) && item.props.name === name;

test('control panel has rotation and color_scheme controls', () => {
  const optionsSection = controlPanel.controlPanelSections.find(
    (section): section is NonNullable<typeof section> =>
      Boolean(section && section.label === 'Options'),
  );
  expect(optionsSection).toBeDefined();
  if (!optionsSection) {
    throw new Error('Options section missing');
  }

  const rotationRow = optionsSection.controlSetRows.find(row =>
    row.some(item => isNameControl(item, 'rotation')),
  );
  expect(rotationRow).toBeDefined();

  const colorSchemeRow = optionsSection.controlSetRows.find(row =>
    row.some(item => isNameControl(item, 'color_scheme')),
  );
  expect(colorSchemeRow).toBeDefined();
});

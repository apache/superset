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
import { controlPanel as controlPanelConfig } from './controlPanel';

describe('TimeTable Control Panel', () => {
  test('should have required control panel structure', () => {
    expect(controlPanelConfig).toBeDefined();
    expect(controlPanelConfig.controlPanelSections).toBeDefined();
    expect(Array.isArray(controlPanelConfig.controlPanelSections)).toBe(true);
  });

  test('should have time series time section', () => {
    const sections = controlPanelConfig.controlPanelSections;

    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0]).toBeDefined();
  });

  test('should have query section with required controls', () => {
    const querySection = controlPanelConfig.controlPanelSections[1];
    const { controlSetRows } = querySection!;

    expect(querySection).toBeDefined();
    expect(querySection!.label).toBe('Query');
    expect(querySection!.expanded).toBe(true);
    expect(querySection!.controlSetRows).toBeDefined();
    expect(controlSetRows).toContainEqual(['metrics']);
    expect(controlSetRows).toContainEqual(['adhoc_filters']);
    expect(controlSetRows).toContainEqual(['groupby']);
    expect(controlSetRows).toContainEqual(['limit']);
    expect(controlSetRows).toContainEqual(['row_limit']);
  });

  test('should have column collection control', () => {
    const querySection = controlPanelConfig.controlPanelSections[1];
    const columnCollectionRow = querySection!.controlSetRows.find(
      (row: any) =>
        Array.isArray(row) &&
        row.length === 1 &&
        row[0].name === 'column_collection',
    );

    expect(columnCollectionRow).toBeDefined();
    expect((columnCollectionRow as any)![0].config.type).toBe(
      'CollectionControl',
    );
    expect((columnCollectionRow as any)![0].config.label).toBe(
      'Time series columns',
    );
    expect((columnCollectionRow as any)![0].config.controlName).toBe(
      'TimeSeriesColumnControl',
    );
  });

  test('should have URL control', () => {
    const querySection = controlPanelConfig.controlPanelSections[1];
    const urlRow = querySection!.controlSetRows.find(
      (row: any) =>
        Array.isArray(row) && row.length === 1 && row[0].name === 'url',
    );

    expect(urlRow).toBeDefined();
    expect((urlRow as any)![0].config.type).toBe('TextControl');
    expect((urlRow as any)![0].config.label).toBe('URL');
  });

  test('should have control overrides for groupby', () => {
    expect(controlPanelConfig.controlOverrides).toBeDefined();
    expect(controlPanelConfig.controlOverrides!.groupby).toBeDefined();
    expect(controlPanelConfig.controlOverrides!.groupby!.multiple).toBe(false);
  });

  test('should have form data overrides function', () => {
    expect(controlPanelConfig.formDataOverrides).toBeDefined();
    expect(typeof controlPanelConfig.formDataOverrides).toBe('function');
  });
});

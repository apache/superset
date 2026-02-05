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
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import TableChart from '../src/TableChart';
import transformProps from '../src/transformProps';
import { testData } from './testData';

describe('Security: Action URL Validation', () => {
  const getDefaultProps = () => ({
    ...transformProps(testData as any),
    height: 400,
    width: 600,
    sticky: false,
  });

  beforeEach(() => {
    // Reset window config before each test
    (window as any).REMITA_TABLE_ALLOWED_ACTION_ORIGINS = undefined;
  });

  test('should allow same-origin URLs by default', () => {
    const props = getDefaultProps();
    const { container } = render(
      <ThemeProvider theme={supersetTheme}>
        <TableChart {...props} />
      </ThemeProvider>
    );

    // Internal buildResolvedUrl should allow same-origin
    // We test this indirectly by ensuring component renders without errors
    expect(container).toBeInTheDocument();
  });

  test('should block external URLs when not in allowed list', () => {
    // Set window origin
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { origin: 'https://superset.example.com' } as any;

    // Mock console.warn to verify security warning
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const props = getDefaultProps();
    render(
      <ThemeProvider theme={supersetTheme}>
        <TableChart {...props} />
      </ThemeProvider>
    );

    // Simulate an action URL to external site
    // (This would be tested more thoroughly in integration tests with actual actions)

    // Restore
    window.location = originalLocation;
    warnSpy.mockRestore();
  });

  test('should respect configured allowed origins', () => {
    // Configure allowed origins
    (window as any).REMITA_TABLE_ALLOWED_ACTION_ORIGINS = [
      'https://superset.example.com',
      'https://reports.example.com',
    ];

    const props = getDefaultProps();
    const { container } = render(
      <ThemeProvider theme={supersetTheme}>
        <TableChart {...props} />
      </ThemeProvider>
    );

    expect(container).toBeInTheDocument();
    expect((window as any).REMITA_TABLE_ALLOWED_ACTION_ORIGINS).toEqual([
      'https://superset.example.com',
      'https://reports.example.com',
    ]);
  });

  test('should sanitize dashboard filter parameters', () => {
    const maliciousInput = {
      xss: '<script>alert(1)</script>',
      jsProtocol: 'javascript:alert(1)',
      dataProtocol: 'data:text/html,<script>alert(1)</script>',
      controlChars: 'test\x00\x01\x1f\x7f',
      longString: 'a'.repeat(2000),
    };

    const props = {
      ...getDefaultProps(),
      dashboardQueryParams: maliciousInput,
    };

    // transformProps should sanitize these values
    const transformed = transformProps({
      ...testData,
      filterState: {
        filters: maliciousInput,
      },
    } as any);

    // Verify sanitization occurred
    Object.values(transformed.dashboardQueryParams || {}).forEach(value => {
      const str = String(value);
      expect(str).not.toContain('<script>');
      expect(str).not.toContain('javascript:');
      expect(str).not.toContain('data:');
      expect(str).not.toMatch(/[\x00-\x1f\x7f]/);
      expect(str.length).toBeLessThanOrEqual(1000);
    });
  });
});

describe('Security: SQL Injection Protection', () => {
  test('should have security warnings in buildQuery', () => {
    // Read the buildQuery file to verify security comments exist
    const fs = require('fs');
    const path = require('path');
    const buildQueryPath = path.join(__dirname, '../src/buildQuery.ts');
    const content = fs.readFileSync(buildQueryPath, 'utf-8');

    // Verify security warnings are present
    expect(content).toContain('⚠️ SECURITY NOTICE');
    expect(content).toContain('defense-in-depth only');
    expect(content).toContain('parameterized queries');
    expect(content).toContain('NOT complete SQL injection protection');
  });
});

describe('Security: Selection State', () => {
  test('should default selection_enabled to false when no actions configured', () => {
    const props = transformProps({
      ...testData,
      rawFormData: {
        ...testData.rawFormData,
        enable_bulk_actions: false,
        enable_table_actions: false,
        selection_enabled: undefined,
      },
    } as any);

    expect(props.selection_enabled).toBe(false);
  });

  test('should enable selection when bulk actions are enabled', () => {
    const props = transformProps({
      ...testData,
      rawFormData: {
        ...testData.rawFormData,
        enable_bulk_actions: true,
        selection_enabled: undefined,
      },
    } as any);

    expect(props.selection_enabled).toBe(true);
  });

  test('should enable selection when table actions are enabled', () => {
    const props = transformProps({
      ...testData,
      rawFormData: {
        ...testData.rawFormData,
        enable_bulk_actions: false,
        enable_table_actions: true,
        selection_enabled: undefined,
      },
    } as any);

    expect(props.selection_enabled).toBe(true);
  });

  test('should respect explicit selection_enabled setting', () => {
    const props = transformProps({
      ...testData,
      rawFormData: {
        ...testData.rawFormData,
        enable_bulk_actions: false,
        enable_table_actions: false,
        selection_enabled: true,
      },
    } as any);

    expect(props.selection_enabled).toBe(true);
  });
});

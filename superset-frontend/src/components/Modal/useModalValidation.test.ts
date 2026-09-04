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
import { renderHook } from '@testing-library/react';
import { act } from 'spec/helpers/testing-library';
import {
  useModalValidation,
  buildErrorTooltipMessage,
} from './useModalValidation';

const mockSections = [
  {
    key: 'section1',
    name: 'Section One',
    validator: jest.fn<string[], []>(() => []),
  },
  {
    key: 'section2',
    name: 'Section Two',
    validator: jest.fn<string[], []>(() => []),
  },
];

beforeEach(() => {
  jest.clearAllMocks();
});

test('initializes with no errors', () => {
  const { result } = renderHook(() =>
    useModalValidation({ sections: mockSections }),
  );

  expect(result.current.hasErrors).toBe(false);
  expect(result.current.validationStatus.section1.hasErrors).toBe(false);
  expect(result.current.validationStatus.section2.hasErrors).toBe(false);
  expect(result.current.errorTooltip).toBe('');
});

test('validates individual section with no errors', () => {
  mockSections[0].validator.mockReturnValue([]);

  const { result } = renderHook(() =>
    useModalValidation({ sections: mockSections }),
  );

  act(() => {
    result.current.validateSection('section1');
  });

  expect(mockSections[0].validator).toHaveBeenCalled();
  expect(result.current.validationStatus.section1.hasErrors).toBe(false);
  expect(result.current.hasErrors).toBe(false);
});

test('validates individual section with errors', () => {
  mockSections[0].validator.mockReturnValue(['Error 1', 'Error 2']);

  const { result } = renderHook(() =>
    useModalValidation({ sections: mockSections }),
  );

  act(() => {
    result.current.validateSection('section1');
  });

  expect(result.current.validationStatus.section1.hasErrors).toBe(true);
  expect(result.current.validationStatus.section1.errors).toEqual([
    'Error 1',
    'Error 2',
  ]);
  expect(result.current.hasErrors).toBe(true);
});

test('validates all sections', () => {
  mockSections[0].validator.mockReturnValue([]);
  mockSections[1].validator.mockReturnValue(['Section 2 error']);

  const { result } = renderHook(() =>
    useModalValidation({ sections: mockSections }),
  );

  let isValid;
  act(() => {
    isValid = result.current.validateAll();
  });

  expect(mockSections[0].validator).toHaveBeenCalled();
  expect(mockSections[1].validator).toHaveBeenCalled();
  expect(isValid).toBe(false);
  expect(result.current.hasErrors).toBe(true);
});

test('returns true when all sections are valid', () => {
  mockSections[0].validator.mockReturnValue([]);
  mockSections[1].validator.mockReturnValue([]);

  const { result } = renderHook(() =>
    useModalValidation({ sections: mockSections }),
  );

  let isValid;
  act(() => {
    isValid = result.current.validateAll();
  });

  expect(isValid).toBe(true);
  expect(result.current.hasErrors).toBe(false);
});

test('calls onValidationChange when validation state changes', () => {
  const onValidationChange = jest.fn();
  mockSections[0].validator.mockReturnValue(['Error']);

  const { result } = renderHook(() =>
    useModalValidation({ sections: mockSections, onValidationChange }),
  );

  act(() => {
    result.current.validateSection('section1');
  });

  expect(onValidationChange).toHaveBeenCalledWith(true);
});

test('updates validation status directly', () => {
  const { result } = renderHook(() =>
    useModalValidation({ sections: mockSections }),
  );

  act(() => {
    result.current.updateValidationStatus('section1', ['Direct error']);
  });

  expect(result.current.validationStatus.section1.hasErrors).toBe(true);
  expect(result.current.validationStatus.section1.errors).toEqual([
    'Direct error',
  ]);
});

test('builds error tooltip message correctly', () => {
  const validationStatus = {
    section1: {
      hasErrors: true,
      errors: ['Error 1', 'Error 2'],
      name: 'Section One',
    },
    section2: {
      hasErrors: false,
      errors: [],
      name: 'Section Two',
    },
  };

  const tooltip = buildErrorTooltipMessage(validationStatus);
  expect(tooltip).not.toBe('');
});

test('returns empty tooltip when no errors', () => {
  const validationStatus = {
    section1: {
      hasErrors: false,
      errors: [],
      name: 'Section One',
    },
  };

  const tooltip = buildErrorTooltipMessage(validationStatus);
  expect(tooltip).toBe('');
});

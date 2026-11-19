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
import {
  ChartMetadata,
  getChartMetadataRegistry,
  VizType,
} from '@superset-ui/core';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import AnnotationLayerControl, { mapStateToProps } from './index';
import { ANNOTATION_TYPES } from './AnnotationTypes';

type State = Parameters<typeof mapStateToProps>[0];

const buildState = (user: unknown): State =>
  ({
    charts: {},
    explore: {
      controls: {
        viz_type: { value: 'line' },
        color_scheme: { value: 'supersetColors' },
      },
    },
    user,
  }) as unknown as State;

test('grants canReadAnnotation when a role holds can_read on Annotation', () => {
  const state = buildState({
    roles: { Gamma: [['can_read', 'Annotation']] },
  });
  expect(mapStateToProps(state).canReadAnnotation).toBe(true);
});

test('denies canReadAnnotation when no role holds the permission', () => {
  const state = buildState({
    roles: { Gamma: [['can_read', 'Chart']] },
  });
  expect(mapStateToProps(state).canReadAnnotation).toBe(false);
});

test('denies canReadAnnotation when the user has no roles', () => {
  expect(mapStateToProps(buildState({})).canReadAnnotation).toBe(false);
  expect(mapStateToProps(buildState(undefined)).canReadAnnotation).toBe(false);
});

afterEach(() => {
  getChartMetadataRegistry().remove(VizType.Line);
});

test('adds a formula annotation layer through the control and lists it by name', async () => {
  getChartMetadataRegistry().registerValue(
    VizType.Line,
    new ChartMetadata({
      name: 'Line',
      thumbnail: '',
      supportedAnnotationTypes: [
        ANNOTATION_TYPES.FORMULA,
        ANNOTATION_TYPES.TIME_SERIES,
      ],
    }),
  );
  const onChange = jest.fn();
  const props = {
    name: 'annotation_layers',
    value: [],
    validationErrors: [],
    actions: { setControlValue: jest.fn() },
    onChange,
  };
  const initialState = {
    charts: { 1: { latestQueryFormData: {} } },
    common: { conf: {} },
    explore: {
      form_data: { slice_id: 1 },
      controls: {
        viz_type: { value: VizType.Line },
        color_scheme: { value: 'supersetColors' },
      },
    },
    user: {},
  };
  const { rerender } = render(<AnnotationLayerControl {...props} />, {
    useRedux: true,
    initialState,
  });

  await userEvent.click(screen.getByText('Add annotation layer'));
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Name' }),
    'Goal line',
  );
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Formula' }),
    'y=140000',
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled(),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  expect(onChange).toHaveBeenCalledWith([
    expect.objectContaining({
      name: 'Goal line',
      annotationType: ANNOTATION_TYPES.FORMULA,
      value: 'y=140000',
    }),
  ]);

  rerender(
    <AnnotationLayerControl {...props} value={onChange.mock.calls[0][0]} />,
  );
  expect(screen.getByText('Goal line')).toBeInTheDocument();
});

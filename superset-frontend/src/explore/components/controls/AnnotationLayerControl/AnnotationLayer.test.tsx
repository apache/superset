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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { getChartMetadataRegistry, ChartMetadata } from '@superset-ui/core';
import fetchMock from 'fetch-mock';
import setupColors from 'src/setup/setupColors';
import { ANNOTATION_TYPES_METADATA } from 'src/modules/AnnotationTypes';
import AnnotationLayer from './AnnotationLayer';

const defaultProps = {
  value: '',
  vizType: 'table',
  annotationType: ANNOTATION_TYPES_METADATA.FORMULA.value,
};

beforeAll(() => {
  const supportedAnnotationTypes = Object.values(ANNOTATION_TYPES_METADATA).map(
    value => value.value,
  );

  fetchMock.get('glob:*/annotationlayermodelview/api/read?*', {
    result: [{ label: 'Chart A', value: 'a' }],
  });

  fetchMock.get('glob:*/superset/user_slices*', [
    { id: 'a', title: 'Chart A', viz_type: 'table', data: {} },
  ]);

  setupColors();

  getChartMetadataRegistry().registerValue(
    'table',
    new ChartMetadata({
      name: 'Table',
      thumbnail: '',
      supportedAnnotationTypes,
      canBeAnnotationTypes: ['EVENT'],
    }),
  );
});

test('renders with default props', () => {
  const { container } = render(<AnnotationLayer {...defaultProps} />);
  expect(container).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
});

test('renders extra checkboxes when type is time series', () => {
  render(<AnnotationLayer {...defaultProps} />);
  expect(
    screen.queryByRole('button', { name: 'Show Markers' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Hide Line' }),
  ).not.toBeInTheDocument();
  userEvent.click(screen.getAllByText('Formula')[0]);
  userEvent.click(screen.getByText('Time series'));
  expect(
    screen.getByRole('button', { name: 'Show Markers' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Hide Line' })).toBeInTheDocument();
});

test('enables apply and ok buttons', async () => {
  render(<AnnotationLayer {...defaultProps} />);
  userEvent.type(screen.getByLabelText('Name'), 'Test');
  userEvent.type(screen.getByLabelText('Formula'), '2x');
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'OK' })).toBeEnabled();
  });
});

test('triggers addAnnotationLayer when apply button is clicked', () => {
  const addAnnotationLayer = jest.fn();
  render(
    <AnnotationLayer
      {...defaultProps}
      name="Test"
      value="2x"
      addAnnotationLayer={addAnnotationLayer}
    />,
  );
  userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(addAnnotationLayer).toHaveBeenCalled();
});

test('triggers addAnnotationLayer and close when ok button is clicked', () => {
  const addAnnotationLayer = jest.fn();
  const close = jest.fn();
  render(
    <AnnotationLayer
      {...defaultProps}
      name="Test"
      value="2x"
      addAnnotationLayer={addAnnotationLayer}
      close={close}
    />,
  );
  userEvent.click(screen.getByRole('button', { name: 'OK' }));
  expect(addAnnotationLayer).toHaveBeenCalled();
  expect(close).toHaveBeenCalled();
});

test('triggers close when cancel button is clicked', () => {
  const close = jest.fn();
  render(<AnnotationLayer {...defaultProps} close={close} />);
  userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(close).toHaveBeenCalled();
});

test('triggers removeAnnotationLayer and close when remove button is clicked', () => {
  const removeAnnotationLayer = jest.fn();
  const close = jest.fn();
  render(
    <AnnotationLayer
      {...defaultProps}
      name="Test"
      value="2x"
      removeAnnotationLayer={removeAnnotationLayer}
      close={close}
    />,
  );
  userEvent.click(screen.getByRole('button', { name: 'Remove' }));
  expect(removeAnnotationLayer).toHaveBeenCalled();
  expect(close).toHaveBeenCalled();
});

test('renders chart options', async () => {
  render(
    <AnnotationLayer
      {...defaultProps}
      annotationType={ANNOTATION_TYPES_METADATA.EVENT.value}
    />,
  );
  userEvent.click(screen.getByText('2 option(s)'));
  userEvent.click(screen.getByText('Superset annotation'));
  expect(await screen.findByLabelText('Annotation layer')).toBeInTheDocument();
  userEvent.click(screen.getByText('Superset annotation'));
  userEvent.click(screen.getByText('Table'));
  expect(await screen.findByLabelText('Chart')).toBeInTheDocument();
});

test('keeps apply disabled when missing required fields', async () => {
  render(
    <AnnotationLayer
      {...defaultProps}
      annotationType={ANNOTATION_TYPES_METADATA.EVENT.value}
      sourceType="Table"
    />,
  );
  userEvent.click(await screen.findByText('1 option(s)'));
  userEvent.click(screen.getByText('Chart A'));
  expect(
    screen.getByText('Annotation Slice Configuration'),
  ).toBeInTheDocument();

  userEvent.click(screen.getByRole('button', { name: 'Automatic Color' }));
  userEvent.click(screen.getByLabelText('Title Column'));
  userEvent.click(screen.getByText('None'));
  userEvent.click(screen.getByLabelText('Style'));
  userEvent.click(screen.getByText('Dashed'));
  userEvent.click(screen.getByLabelText('Opacity'));
  userEvent.click(screen.getByText('0.5'));

  const checkboxes = screen.getAllByRole('checkbox');
  checkboxes.forEach(checkbox => userEvent.click(checkbox));

  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
});

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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { getChartMetadataRegistry, ChartMetadata } from '@superset-ui/core';
import fetchMock from 'fetch-mock';
import setupColors from 'src/setup/setupColors';
import { ANNOTATION_TYPES_METADATA } from './AnnotationTypes';
import AnnotationLayer from './AnnotationLayer';

const defaultProps = {
  value: '',
  vizType: 'table',
  annotationType: ANNOTATION_TYPES_METADATA.FORMULA.value,
};

const nativeLayerApiRoute = 'glob:*/api/v1/annotation_layer/*';
const chartApiRoute = /\/api\/v1\/chart\/\?q=.+/;
const chartApiWithIdRoute = /\/api\/v1\/chart\/\w+\?q=.+/;

const withIdResult = {
  result: {
    slice_name: 'Mocked Slice',
    query_context: JSON.stringify({
      form_data: {
        groupby: ['country'],
      },
    }),
    viz_type: 'line',
  },
};

beforeAll(() => {
  const supportedAnnotationTypes = Object.values(ANNOTATION_TYPES_METADATA).map(
    value => value.value,
  );

  fetchMock.get(nativeLayerApiRoute, {
    result: [{ name: 'Chart A', id: 'a' }],
  });

  fetchMock.get(chartApiRoute, {
    result: [{ id: 'a', slice_name: 'Chart A', viz_type: 'table' }],
  });

  fetchMock.get(chartApiWithIdRoute, withIdResult);

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

const waitForRender = (props?: any) =>
  waitFor(() => render(<AnnotationLayer {...defaultProps} {...props} />));

test('renders with default props', async () => {
  await waitForRender();
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
});

test('renders extra checkboxes when type is time series', async () => {
  await waitForRender();
  expect(
    screen.queryByRole('button', { name: 'Show Markers' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Hide Line' }),
  ).not.toBeInTheDocument();
  userEvent.click(screen.getAllByText('Formula')[0]);
  userEvent.click(screen.getByText('Time series'));
  expect(
    await screen.findByRole('button', { name: 'Show Markers' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Hide Line' })).toBeInTheDocument();
});

test('enables apply and ok buttons', async () => {
  const { container } = render(<AnnotationLayer {...defaultProps} />);

  await waitFor(() => {
    expect(container).toBeInTheDocument();
  });

  const nameInput = screen.getByRole('textbox', { name: 'Name' });
  const formulaInput = screen.getByRole('textbox', { name: 'Formula' });

  expect(nameInput).toBeInTheDocument();
  expect(formulaInput).toBeInTheDocument();

  userEvent.type(nameInput, 'Name');
  userEvent.type(formulaInput, '2x');

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'OK' })).toBeEnabled();
  });
});

test('triggers addAnnotationLayer when apply button is clicked', async () => {
  const addAnnotationLayer = jest.fn();
  await waitForRender({ name: 'Test', value: '2x', addAnnotationLayer });
  userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(addAnnotationLayer).toHaveBeenCalled();
});

test('triggers addAnnotationLayer and close when ok button is clicked', async () => {
  const addAnnotationLayer = jest.fn();
  const close = jest.fn();
  await waitForRender({ name: 'Test', value: '2x', addAnnotationLayer, close });
  userEvent.click(screen.getByRole('button', { name: 'OK' }));
  expect(addAnnotationLayer).toHaveBeenCalled();
  expect(close).toHaveBeenCalled();
});

test('triggers close when cancel button is clicked', async () => {
  const close = jest.fn();
  await waitForRender({ close });
  userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(close).toHaveBeenCalled();
});

test('triggers removeAnnotationLayer and close when remove button is clicked', async () => {
  const removeAnnotationLayer = jest.fn();
  const close = jest.fn();
  await waitForRender({
    name: 'Test',
    value: '2x',
    removeAnnotationLayer,
    close,
  });
  userEvent.click(screen.getByRole('button', { name: 'Remove' }));
  expect(removeAnnotationLayer).toHaveBeenCalled();
  expect(close).toHaveBeenCalled();
});

test('fetches Superset annotation layer options', async () => {
  await waitForRender({
    annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
  });
  userEvent.click(
    screen.getByRole('combobox', { name: 'Annotation source type' }),
  );
  userEvent.click(screen.getByText('Superset annotation'));
  expect(await screen.findByText('Annotation layer')).toBeInTheDocument();
  userEvent.click(
    screen.getByRole('combobox', { name: 'Annotation layer value' }),
  );
  expect(await screen.findByText('Chart A')).toBeInTheDocument();
  expect(fetchMock.calls(nativeLayerApiRoute).length).toBe(1);
});

test('fetches chart options', async () => {
  await waitForRender({
    annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
  });
  userEvent.click(
    screen.getByRole('combobox', { name: 'Annotation source type' }),
  );
  userEvent.click(screen.getByText('Table'));
  expect(await screen.findByText('Chart')).toBeInTheDocument();
  userEvent.click(
    screen.getByRole('combobox', { name: 'Annotation layer value' }),
  );
  expect(await screen.findByText('Chart A')).toBeInTheDocument();
  expect(fetchMock.calls(chartApiRoute).length).toBe(1);
});

test('fetches chart on mount if value present', async () => {
  await waitForRender({
    name: 'Test',
    value: 'a',
    annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
    sourceType: 'Table',
  });
  expect(fetchMock.calls(chartApiWithIdRoute).length).toBe(1);
});

test('keeps apply disabled when missing required fields', async () => {
  await waitForRender({
    annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
    sourceType: 'Table',
  });
  userEvent.click(
    screen.getByRole('combobox', { name: 'Annotation layer value' }),
  );
  expect(await screen.findByText('Chart A')).toBeInTheDocument();
  userEvent.click(screen.getByText('Chart A'));
  await screen.findByText(/title column/i);
  userEvent.click(screen.getByRole('button', { name: 'Automatic Color' }));
  userEvent.click(
    screen.getByRole('combobox', { name: 'Annotation layer title column' }),
  );
  expect(await screen.findByText(/none/i)).toBeInTheDocument();
  userEvent.click(screen.getByText('None'));
  userEvent.click(screen.getByText('Style'));
  userEvent.click(
    screen.getByRole('combobox', { name: 'Annotation layer stroke' }),
  );
  expect(await screen.findByText('Dashed')).toBeInTheDocument();
  userEvent.click(screen.getByText('Dashed'));
  userEvent.click(screen.getByText('Opacity'));
  userEvent.click(
    screen.getByRole('combobox', { name: 'Annotation layer opacity' }),
  );
  expect(await screen.findByText(/0.5/i)).toBeInTheDocument();
  userEvent.click(screen.getByText('0.5'));

  const checkboxes = screen.getAllByRole('checkbox');
  checkboxes.forEach(checkbox => userEvent.click(checkbox));

  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
});

test('Disable apply button if formula is incorrect', async () => {
  await waitForRender({ name: 'test' });

  const formulaInput = screen.getByRole('textbox', { name: 'Formula' });
  const applyButton = screen.getByRole('button', { name: 'Apply' });
  const okButton = screen.getByRole('button', { name: 'OK' });

  userEvent.type(formulaInput, 'x+1');
  expect(formulaInput).toHaveValue('x+1');
  await waitFor(() => {
    expect(okButton).toBeEnabled();
    expect(applyButton).toBeEnabled();
  });

  userEvent.clear(formulaInput);
  await waitFor(() => {
    expect(formulaInput).toHaveValue('');
  });
  userEvent.type(formulaInput, 'y = x*2+1');
  expect(formulaInput).toHaveValue('y = x*2+1');
  await waitFor(() => {
    expect(okButton).toBeEnabled();
    expect(applyButton).toBeEnabled();
  });

  userEvent.clear(formulaInput);
  await waitFor(() => {
    expect(formulaInput).toHaveValue('');
  });
  userEvent.type(formulaInput, 'y+1');
  expect(formulaInput).toHaveValue('y+1');
  await waitFor(() => {
    expect(okButton).toBeDisabled();
    expect(applyButton).toBeDisabled();
  });

  userEvent.clear(formulaInput);
  await waitFor(() => {
    expect(formulaInput).toHaveValue('');
  });
  userEvent.type(formulaInput, 'x+');
  expect(formulaInput).toHaveValue('x+');
  await waitFor(() => {
    expect(okButton).toBeDisabled();
    expect(applyButton).toBeDisabled();
  });

  userEvent.clear(formulaInput);
  await waitFor(() => {
    expect(formulaInput).toHaveValue('');
  });
  userEvent.type(formulaInput, 'y = z+1');
  expect(formulaInput).toHaveValue('y = z+1');
  await waitFor(() => {
    expect(okButton).toBeDisabled();
    expect(applyButton).toBeDisabled();
  });
});

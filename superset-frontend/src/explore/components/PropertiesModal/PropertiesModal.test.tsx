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
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import PropertiesModal, { PropertiesModalProps } from '.';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const createProps = () =>
  ({
    slice: {
      cache_timeout: null,
      certified_by: 'John Doe',
      certification_details: 'Sample certification',
      description: null,
      slice_id: 318,
      slice_name: 'Age distribution of respondents',
      is_managed_externally: false,
    },
    show: true,
    onHide: jest.fn(),
    onSave: jest.fn(),
    addSuccessToast: jest.fn(),
  }) as PropertiesModalProps;

fetchMock.get('glob:*/api/v1/chart/318*', {
  body: {
    description_columns: {},
    id: 318,
    label_columns: {
      'owners.first_name': 'Owners First Name',
      'owners.id': 'Owners Id',
      'owners.last_name': 'Owners Last Name',
      'tags.id': 'Tags Id',
      'tags.name': 'Tags Name',
      'tags.type': 'Tags Type',
    },
    result: {
      owners: [
        {
          first_name: 'Superset',
          id: 1,
          last_name: 'Admin',
        },
      ],
      tags: [
        {
          id: 1,
          name: 'type:chart',
          type: 2,
        },
        {
          id: 2,
          name: 'owner:1',
          type: 3,
        },
        {
          id: 3,
          name: 'my test tag',
          type: 1,
        },
      ],
      show_title: 'Show Slice',
      certification_details: 'Test certification details',
      certified_by: 'Test certified by',
      description: 'Test description',
      cache_timeout: 1000,
      slice_name: 'Test chart new name',
    },
    show_columns: [
      'owners.id',
      'owners.first_name',
      'owners.last_name',
      'tags.id',
      'tags.name',
      'tags.type',
    ],
    show_title: 'Show Slice',
  },
});

fetchMock.get('glob:*/api/v1/chart/related/owners?q=(filter:%27%27)', {
  body: {
    count: 1,
    result: [
      {
        text: 'Superset Admin',
        value: 1,
      },
    ],
  },
  sendAsJson: true,
});

fetchMock.put('glob:*/api/v1/chart/318', {
  body: {
    id: 318,
    result: {
      cache_timeout: null,
      certified_by: 'John Doe',
      certification_details: 'Sample certification',
      description: null,
      owners: [],
      slice_name: 'Age distribution of respondents',
    },
  },
  sendAsJson: true,
});

afterAll(() => {
  fetchMock.resetBehavior();
});

const renderModal = (props: PropertiesModalProps) =>
  render(<PropertiesModal {...props} />, { useRedux: true });

test('Should render null when show:false', async () => {
  const props = createProps();
  props.show = false;
  renderModal(props);

  await waitFor(() => {
    expect(
      screen.queryByRole('dialog', { name: 'Edit Chart Properties' }),
    ).not.toBeInTheDocument();
  });
});

// Add cleanup after each test
afterEach(async () => {
  // Wait for any pending effects to complete
  await new Promise(resolve => setTimeout(resolve, 0));
});

test('Should render when show:true', async () => {
  const props = createProps();
  renderModal(props);

  await waitFor(
    () => {
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveTextContent('Edit Chart Properties');
      expect(modal).not.toHaveClass('ant-zoom-appear');
    },
    { timeout: 3000 },
  );
});

test('Should have modal header', async () => {
  const props = createProps();
  renderModal(props);

  await waitFor(() => {
    expect(screen.getByText('Edit Chart Properties')).toBeVisible();
    expect(screen.getByTestId('close-modal-btn')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible();
  });
});

test('"Close" button should call "onHide"', async () => {
  const props = createProps();
  renderModal(props);

  await waitFor(() => {
    expect(props.onHide).toHaveBeenCalledTimes(0);
  });

  userEvent.click(screen.getByRole('button', { name: 'Close' }));

  await waitFor(() => {
    expect(props.onHide).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledTimes(0);
  });
});

test('Should render all elements inside modal', async () => {
  const props = createProps();
  renderModal(props);

  await waitFor(
    () => {
      expect(screen.getAllByRole('textbox')).toHaveLength(5);
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Basic information' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();

      expect(
        screen.getByRole('heading', { name: 'Configuration' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Cache timeout')).toBeInTheDocument();

      expect(
        screen.getByRole('heading', { name: 'Access' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Owners')).toBeInTheDocument();

      expect(
        screen.getByRole('heading', { name: 'Configuration' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Certified by')).toBeInTheDocument();
      expect(screen.getByText('Certification details')).toBeInTheDocument();
    },
    { timeout: 10000 },
  );
});

test('Should have modal footer', async () => {
  const props = createProps();
  renderModal(props);

  await waitFor(() => {
    expect(screen.getByText('Cancel')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();

    expect(screen.getByText('Save')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});

test('"Cancel" button should call "onHide"', async () => {
  const props = createProps();
  renderModal(props);

  await waitFor(() => {
    expect(props.onHide).toHaveBeenCalledTimes(0);
  });

  userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  await waitFor(() => {
    expect(props.onHide).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledTimes(0);
  });
});

test('"Save" button should call only "onSave"', async () => {
  const props = createProps();
  renderModal(props);
  await waitFor(() => {
    expect(props.onSave).toHaveBeenCalledTimes(0);
    expect(props.onHide).toHaveBeenCalledTimes(0);

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onHide).toHaveBeenCalledTimes(1);
  });
});

test('Empty "Certified by" should clear "Certification details"', async () => {
  const props = createProps();
  const noCertifiedByProps = {
    ...props,
    slice: {
      ...props.slice,
      certified_by: '',
    },
  };
  renderModal(noCertifiedByProps);

  expect(
    await screen.findByRole('textbox', { name: 'Certification details' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('textbox', { name: 'Certification details' }),
  ).toHaveValue('');
});

test('"Name" should not be empty', async () => {
  const props = createProps();
  renderModal(props);

  const name = screen.getByRole('textbox', { name: 'Name' });

  userEvent.clear(name);

  expect(name).toHaveValue('');

  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(props.onSave).toHaveBeenCalledTimes(0);
  });
});

test('"Name" should not be empty when saved', async () => {
  const props = createProps();
  renderModal(props);

  const name = screen.getByRole('textbox', { name: 'Name' });

  userEvent.clear(name);
  userEvent.type(name, 'Test chart new name');

  expect(name).toHaveValue('Test chart new name');

  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ slice_name: 'Test chart new name' }),
    );
  });
});

test('"Cache timeout" should not be empty when saved', async () => {
  const props = createProps();
  renderModal(props);

  const cacheTimeout = screen.getByRole('textbox', { name: 'Cache timeout' });

  await userEvent.clear(cacheTimeout);
  await userEvent.type(cacheTimeout, '1000');

  expect(cacheTimeout).toHaveValue('1000');

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ cache_timeout: 1000 }),
    );
  });
});

test('"Description" should not be empty when saved', async () => {
  const props = createProps();
  renderModal(props);

  const description = screen.getByRole('textbox', { name: 'Description' });

  userEvent.clear(description);
  userEvent.type(description, 'Test description');

  expect(description).toHaveValue('Test description');

  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Test description' }),
    );
  });
});

test('"Certified by" should not be empty when saved', async () => {
  const props = createProps();
  renderModal(props);

  const certifiedBy = screen.getByRole('textbox', { name: 'Certified by' });

  userEvent.clear(certifiedBy);
  userEvent.type(certifiedBy, 'Test certified by');

  expect(certifiedBy).toHaveValue('Test certified by');

  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ certified_by: 'Test certified by' }),
    );
  });
});

test('"Certification details" should not be empty when saved', async () => {
  const props = createProps();
  renderModal(props);

  const certificationDetails = screen.getByRole('textbox', {
    name: 'Certification details',
  });

  userEvent.clear(certificationDetails);
  userEvent.type(certificationDetails, 'Test certification details');

  expect(certificationDetails).toHaveValue('Test certification details');

  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        certification_details: 'Test certification details',
      }),
    );
  });
});

test('Should display only custom tags when tagging system is enabled', async () => {
  const mockIsFeatureEnabled = isFeatureEnabled as jest.MockedFunction<
    typeof isFeatureEnabled
  >;
  mockIsFeatureEnabled.mockImplementation(
    flag => flag === FeatureFlag.TaggingSystem,
  );

  const props = createProps();
  renderModal(props);

  await waitFor(async () => {
    expect(
      await screen.findByRole('heading', { name: 'Tags' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('combobox', { name: 'Tags' }),
    ).toBeInTheDocument();
  });

  await waitFor(async () => {
    expect(await screen.findByText('my test tag')).toBeInTheDocument();
    expect(screen.queryByText('type:chart')).not.toBeInTheDocument();
    expect(screen.queryByText('owner:1')).not.toBeInTheDocument();
  });

  mockIsFeatureEnabled.mockRestore();
});

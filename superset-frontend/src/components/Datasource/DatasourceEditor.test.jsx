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
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import DatasourceEditor from 'src/components/Datasource/DatasourceEditor';
import mockDatasource from 'spec/fixtures/mockDatasource';
import { isFeatureEnabled } from '@superset-ui/core';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const props = {
  datasource: mockDatasource['7__table'],
  addSuccessToast: () => {},
  addDangerToast: () => {},
  onChange: jest.fn(),
  columnLabels: {
    state: 'State',
  },
  columnLabelTooltips: {
    state: 'This is a tooltip for `state`',
  },
};
const DATASOURCE_ENDPOINT = 'glob:*/datasource/external_metadata_by_name/*';

const asyncRender = props =>
  waitFor(() =>
    render(<DatasourceEditor {...props} />, {
      useRedux: true,
      initialState: { common: { currencies: ['USD', 'GBP', 'EUR'] } },
    }),
  );

describe('DatasourceEditor', () => {
  fetchMock.get(DATASOURCE_ENDPOINT, []);

  beforeEach(async () => {
    await asyncRender({
      ...props,
      datasource: { ...props.datasource, table_name: 'Vehicle Sales +' },
    });
  });

  it('renders Tabs', () => {
    expect(screen.getByTestId('edit-dataset-tabs')).toBeInTheDocument();
  });

  it('can sync columns from source', () =>
    new Promise(done => {
      const columnsTab = screen.getByTestId('collection-tab-Columns');

      userEvent.click(columnsTab);
      const syncButton = screen.getByText(/sync columns from source/i);
      expect(syncButton).toBeInTheDocument();

      userEvent.click(syncButton);

      setTimeout(() => {
        expect(fetchMock.calls(DATASOURCE_ENDPOINT)).toHaveLength(1);
        expect(fetchMock.calls(DATASOURCE_ENDPOINT)[0][0]).toContain(
          'Vehicle+Sales%20%2B',
        );
        fetchMock.reset();
        done();
      }, 0);
    }));

  // to add, remove and modify columns accordingly
  it('can modify columns', async () => {
    const columnsTab = screen.getByTestId('collection-tab-Columns');
    userEvent.click(columnsTab);

    const getToggles = screen.getAllByRole('button', {
      name: /toggle expand/i,
    });
    userEvent.click(getToggles[0]);
    const getTextboxes = screen.getAllByRole('textbox');
    expect(getTextboxes.length).toEqual(5);

    const inputLabel = screen.getByPlaceholderText('Label');
    const inputDescription = screen.getByPlaceholderText('Description');
    const inputDtmFormat = screen.getByPlaceholderText('%Y-%m-%d');
    const inputCertifiedBy = screen.getByPlaceholderText('Certified by');
    const inputCertDetails = screen.getByPlaceholderText(
      'Certification details',
    );

    userEvent.type(await inputLabel, 'test_label');
    userEvent.type(await inputDescription, 'test');
    userEvent.type(await inputDtmFormat, 'test');
    userEvent.type(await inputCertifiedBy, 'test');
    userEvent.type(await inputCertDetails, 'test');
  });

  it('can delete columns', async () => {
    const columnsTab = screen.getByTestId('collection-tab-Columns');
    userEvent.click(columnsTab);

    const getToggles = screen.getAllByRole('button', {
      name: /toggle expand/i,
    });

    userEvent.click(getToggles[0]);
    const deleteButtons = screen.getAllByRole('button', {
      name: /delete item/i,
    });
    expect(deleteButtons.length).toEqual(7);
    userEvent.click(deleteButtons[0]);
    const countRows = screen.getAllByRole('button', { name: /delete item/i });
    expect(countRows.length).toEqual(6);
  });

  it('can add new columns', async () => {
    const calcColsTab = screen.getByTestId('collection-tab-Calculated columns');
    userEvent.click(calcColsTab);
    const addBtn = screen.getByRole('button', {
      name: /add item/i,
    });
    expect(addBtn).toBeInTheDocument();
    userEvent.click(addBtn);
    // newColumn (Column name) is the first textbox in the tab
    const newColumn = screen.getAllByRole('textbox', { name: '' })[0];
    expect(newColumn).toHaveValue('<new column>');
  });

  it('renders isSqla fields', () => {
    const columnsTab = screen.getByRole('tab', {
      name: /settings/i,
    });
    userEvent.click(columnsTab);
    const extraField = screen.getAllByText(/extra/i);
    expect(extraField.length).toEqual(2);
    expect(
      screen.getByText(/autocomplete query predicate/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/template parameters/i)).toBeInTheDocument();
  });

  describe('enable edit Source tab', () => {
    beforeAll(() => {
      isFeatureEnabled.mockImplementation(() => false);
    });

    afterAll(() => {
      isFeatureEnabled.mockRestore();
    });

    it('Source Tab: edit mode', () => {
      const getLockBtn = screen.getByRole('img', { name: /lock-locked/i });
      userEvent.click(getLockBtn);
      const physicalRadioBtn = screen.getByRole('radio', {
        name: /physical \(table or view\)/i,
      });
      const virtualRadioBtn = screen.getByRole('radio', {
        name: /virtual \(sql\)/i,
      });
      expect(physicalRadioBtn).toBeEnabled();
      expect(virtualRadioBtn).toBeEnabled();
    });

    it('Source Tab: readOnly mode', () => {
      const getLockBtn = screen.getByRole('img', { name: /lock-locked/i });
      expect(getLockBtn).toBeInTheDocument();
      const physicalRadioBtn = screen.getByRole('radio', {
        name: /physical \(table or view\)/i,
      });
      const virtualRadioBtn = screen.getByRole('radio', {
        name: /virtual \(sql\)/i,
      });
      expect(physicalRadioBtn).toBeDisabled();
      expect(virtualRadioBtn).toBeDisabled();
    });
  });
});

describe('DatasourceEditor RTL', () => {
  jest.setTimeout(15000); // Extend timeout to 15s for this test

  it('properly renders the metric information', async () => {
    await asyncRender(props);
    const metricButton = screen.getByTestId('collection-tab-Metrics');
    userEvent.click(metricButton);
    const expandToggle = await screen.findAllByLabelText(/toggle expand/i);
    userEvent.click(expandToggle[0]);
    const certificationDetails = await screen.findByPlaceholderText(
      /certification details/i,
    );
    expect(certificationDetails.value).toEqual('foo');
    const warningMarkdown = await screen.findByPlaceholderText(/certified by/i);
    expect(warningMarkdown.value).toEqual('someone');
  });
  it('renders currency controls', async () => {
    const propsWithCurrency = {
      ...props,
      datasource: {
        ...props.datasource,
        metrics: [
          {
            ...props.datasource.metrics[0],
            currency: { symbol: 'USD', symbolPosition: 'prefix' },
          },
          ...props.datasource.metrics.slice(1),
        ],
      },
    };
    await asyncRender(propsWithCurrency);
    const metricButton = screen.getByTestId('collection-tab-Metrics');
    userEvent.click(metricButton);
    const expandToggle = await screen.findAllByLabelText(/toggle expand/i);
    userEvent.click(expandToggle[0]);

    expect(await screen.findByText('Metric currency')).toBeVisible();
    expect(
      await waitFor(() =>
        document.querySelector(
          `[aria-label='Currency prefix or suffix'] .ant-select-selection-item`,
        ),
      ),
    ).toHaveTextContent('Prefix');
    await userEvent.click(
      screen.getByRole('combobox', { name: 'Currency prefix or suffix' }),
    );
    const positionOptions = await waitFor(() =>
      document.querySelectorAll(
        `[aria-label='Currency prefix or suffix'] .ant-select-item-option-content`,
      ),
    );
    expect(positionOptions[0]).toHaveTextContent('Prefix');
    expect(positionOptions[1]).toHaveTextContent('Suffix');

    propsWithCurrency.onChange.mockClear();
    await userEvent.click(positionOptions[1]);
    expect(propsWithCurrency.onChange.mock.calls[0][0]).toMatchObject(
      expect.objectContaining({
        metrics: expect.arrayContaining([
          expect.objectContaining({
            currency: { symbolPosition: 'suffix', symbol: 'USD' },
          }),
        ]),
      }),
    );

    expect(
      await waitFor(() =>
        document.querySelector(
          `[aria-label='Currency symbol'] .ant-select-selection-item`,
        ),
      ),
    ).toHaveTextContent('$ (USD)');

    propsWithCurrency.onChange.mockClear();
    await userEvent.click(
      screen.getByRole('combobox', { name: 'Currency symbol' }),
    );
    const symbolOptions = await waitFor(() =>
      document.querySelectorAll(
        `[aria-label='Currency symbol'] .ant-select-item-option-content`,
      ),
    );
    expect(symbolOptions[0]).toHaveTextContent('$ (USD)');
    expect(symbolOptions[1]).toHaveTextContent('£ (GBP)');
    expect(symbolOptions[2]).toHaveTextContent('€ (EUR)');

    await userEvent.click(symbolOptions[1]);
    expect(propsWithCurrency.onChange.mock.calls[0][0]).toMatchObject(
      expect.objectContaining({
        metrics: expect.arrayContaining([
          expect.objectContaining({
            currency: { symbolPosition: 'suffix', symbol: 'GBP' },
          }),
        ]),
      }),
    );
  });
  it('properly updates the metric information', async () => {
    await asyncRender(props);
    const metricButton = screen.getByTestId('collection-tab-Metrics');
    userEvent.click(metricButton);
    const expandToggle = await screen.findAllByLabelText(/toggle expand/i);
    userEvent.click(expandToggle[1]);
    const certifiedBy = await screen.findByPlaceholderText(/certified by/i);
    userEvent.type(certifiedBy, 'I am typing a new name');
    const certificationDetails = await screen.findByPlaceholderText(
      /certification details/i,
    );
    expect(certifiedBy.value).toEqual('I am typing a new name');
    userEvent.type(certificationDetails, 'I am typing something new');
    expect(certificationDetails.value).toEqual('I am typing something new');
  });
  it('shows the default datetime column', async () => {
    await asyncRender(props);
    const metricButton = screen.getByTestId('collection-tab-Columns');
    userEvent.click(metricButton);
    const dsDefaultDatetimeRadio = screen.getByTestId('radio-default-dttm-ds');
    expect(dsDefaultDatetimeRadio).toBeChecked();
    const genderDefaultDatetimeRadio = screen.getByTestId(
      'radio-default-dttm-gender',
    );
    expect(genderDefaultDatetimeRadio).not.toBeChecked();
  });
  it('allows choosing only temporal columns as the default datetime', async () => {
    await asyncRender(props);
    const metricButton = screen.getByTestId('collection-tab-Columns');
    userEvent.click(metricButton);
    const dsDefaultDatetimeRadio = screen.getByTestId('radio-default-dttm-ds');
    expect(dsDefaultDatetimeRadio).toBeEnabled();
    const genderDefaultDatetimeRadio = screen.getByTestId(
      'radio-default-dttm-gender',
    );
    expect(genderDefaultDatetimeRadio).toBeDisabled();
  });
});

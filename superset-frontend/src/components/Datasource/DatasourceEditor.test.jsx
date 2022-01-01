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
import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import DatasourceEditor from 'src/components/Datasource/DatasourceEditor';
import mockDatasource from 'spec/fixtures/mockDatasource';
import * as featureFlags from 'src/featureFlags';

const props = {
  datasource: mockDatasource['7__table'],
  addSuccessToast: () => {},
  addDangerToast: () => {},
  onChange: () => {},
};
const DATASOURCE_ENDPOINT = 'glob:*/datasource/external_metadata_by_name/*';

describe('DatasourceEditor', () => {
  fetchMock.get(DATASOURCE_ENDPOINT, []);

  let el;
  let isFeatureEnabledMock;

  beforeEach(() => {
    el = <DatasourceEditor {...props} />;
    render(el, { useRedux: true });
  });

  it('is valid', () => {
    expect(React.isValidElement(el)).toBe(true);
  });

  it('renders Tabs', () => {
    expect(screen.getByTestId('edit-dataset-tabs')).toBeInTheDocument();
  });

  it('makes an async request', () =>
    new Promise(done => {
      const columnsTab = screen.getByTestId('collection-tab-Columns');

      userEvent.click(columnsTab);
      const syncButton = screen.getByText(/sync columns from source/i);
      expect(syncButton).toBeInTheDocument();

      userEvent.click(syncButton);

      setTimeout(() => {
        expect(fetchMock.calls(DATASOURCE_ENDPOINT)).toHaveLength(1);
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
    expect(getTextboxes.length).toEqual(12);

    const inputLabel = screen.getByPlaceholderText('Label');
    const inputDescription = screen.getByPlaceholderText('Description');
    const inputDtmFormat = screen.getByPlaceholderText('%Y/%m/%d');
    const inputCertifiedBy = screen.getByPlaceholderText('Certified by');
    const inputCertDetails = screen.getByPlaceholderText(
      'Certification details',
    );

    userEvent.type(await inputLabel, 'test_lable');
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
    screen.logTestingPlaygroundURL();
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
      isFeatureEnabledMock = jest
        .spyOn(featureFlags, 'isFeatureEnabled')
        .mockImplementation(() => false);
    });

    afterAll(() => {
      isFeatureEnabledMock.mockRestore();
    });

    it('Source Tab: edit mode', () => {
      const getLockBtn = screen.getByRole('img', { name: /lock-locked/i });
      userEvent.click(getLockBtn);
      const physicalRadioBtn = screen.getByRole('radio', {
        name: /physical \(table or view\)/i,
      });
      const vituralRadioBtn = screen.getByRole('radio', {
        name: /virtual \(sql\)/i,
      });
      expect(physicalRadioBtn).toBeEnabled();
      expect(vituralRadioBtn).toBeEnabled();
    });

    it('Source Tab: readOnly mode', () => {
      const getLockBtn = screen.getByRole('img', { name: /lock-locked/i });
      expect(getLockBtn).toBeInTheDocument();
      const physicalRadioBtn = screen.getByRole('radio', {
        name: /physical \(table or view\)/i,
      });
      const vituralRadioBtn = screen.getByRole('radio', {
        name: /virtual \(sql\)/i,
      });
      expect(physicalRadioBtn).toBeDisabled();
      expect(vituralRadioBtn).toBeDisabled();
    });
  });

  describe('render editor with feature flag false', () => {
    beforeAll(() => {
      isFeatureEnabledMock = jest
        .spyOn(featureFlags, 'isFeatureEnabled')
        .mockImplementation(() => true);
    });

    beforeEach(() => {
      render(el, { useRedux: true });
    });

    it('disable edit Source tab', () => {
      expect(
        screen.queryByRole('img', { name: /lock-locked/i }),
      ).not.toBeInTheDocument();
      isFeatureEnabledMock.mockRestore();
    });
  });
});

describe('DatasourceEditor RTL', () => {
  it('properly renders the metric information', async () => {
    render(<DatasourceEditor {...props} />, { useRedux: true });
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
  it('properly updates the metric information', async () => {
    render(<DatasourceEditor {...props} />, {
      useRedux: true,
    });
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
    render(<DatasourceEditor {...props} />, { useRedux: true });
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
    render(<DatasourceEditor {...props} />, { useRedux: true });
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

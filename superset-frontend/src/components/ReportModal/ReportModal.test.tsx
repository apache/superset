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
import * as React from 'react';
import userEvent from '@testing-library/user-event';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import * as featureFlags from 'src/featureFlags';
import * as actions from 'src/reports/actions/reports';
import { FeatureFlag } from '@superset-ui/core';
import ReportModal from '.';

let isFeatureEnabledMock: jest.MockInstance<boolean, [string]>;

const REPORT_ENDPOINT = 'glob:*/api/v1/report*';
fetchMock.get(REPORT_ENDPOINT, {});

const NOOP = () => {};

jest.mock('src/components/Icons/Icon', () => () => <span />);

const defaultProps = {
  addDangerToast: NOOP,
  addSuccessToast: NOOP,
  addReport: NOOP,
  onHide: NOOP,
  onReportAdd: NOOP,
  show: true,
  userId: 1,
  userEmail: 'test@test.com',
  dashboardId: 1,
  creationMethod: 'dashboards',
  chart: {
    sliceFormData: {
      viz_type: 'table',
    },
  },
};

describe('Email Report Modal', () => {
  beforeAll(() => {
    isFeatureEnabledMock = jest
      .spyOn(featureFlags, 'isFeatureEnabled')
      .mockImplementation(
        (featureFlag: FeatureFlag) => featureFlag === FeatureFlag.ALERT_REPORTS,
      );
  });

  beforeEach(() => {
    render(<ReportModal {...defaultProps} />, { useRedux: true });
  });

  afterAll(() => {
    // @ts-ignore
    isFeatureEnabledMock.restore();
  });

  it('inputs respond correctly', () => {
    // ----- Report name textbox
    // Initial value
    const reportNameTextbox = screen.getByTestId('report-name-test');
    expect(reportNameTextbox).toHaveDisplayValue('Weekly Report');
    // Type in the textbox and assert that it worked
    userEvent.type(reportNameTextbox, 'Report name text test');
    expect(reportNameTextbox).toHaveDisplayValue('Report name text test');

    // ----- Report description textbox
    // Initial value
    const reportDescriptionTextbox = screen.getByTestId(
      'report-description-test',
    );
    expect(reportDescriptionTextbox).toHaveDisplayValue('');
    // Type in the textbox and assert that it worked
    userEvent.type(reportDescriptionTextbox, 'Report description text test');
    expect(reportDescriptionTextbox).toHaveDisplayValue(
      'Report description text test',
    );

    // ----- Crontab
    const crontabInputs = screen.getAllByRole('combobox');
    expect(crontabInputs).toHaveLength(5);
  });

  it('does not allow user to create a report without a name', () => {
    // Grab name textbox and add button
    const reportNameTextbox = screen.getByTestId('report-name-test');
    const addButton = screen.getByRole('button', { name: /add/i });

    // Add button should be enabled while name textbox has text
    expect(reportNameTextbox).toHaveDisplayValue('Weekly Report');
    expect(addButton).toBeEnabled();

    // Clear the text from the name textbox
    userEvent.clear(reportNameTextbox);

    // Add button should now be disabled, blocking user from creation
    expect(reportNameTextbox).toHaveDisplayValue('');
    expect(addButton).toBeDisabled();
  });

  describe('Email Report Modal', () => {
    let isFeatureEnabledMock: any;
    let dispatch: any;

    beforeEach(async () => {
      isFeatureEnabledMock = jest
        .spyOn(featureFlags, 'isFeatureEnabled')
        .mockImplementation(() => true);
      dispatch = sinon.spy();
    });

    afterAll(() => {
      isFeatureEnabledMock.mockRestore();
    });

    it('creates a new email report', async () => {
      // ---------- Render/value setup ----------
      const reportValues = {
        id: 1,
        result: {
          active: true,
          creation_method: 'dashboards',
          crontab: '0 12 * * 1',
          dashboard: 1,
          name: 'Weekly Report',
          owners: [1],
          recipients: [
            {
              recipient_config_json: {
                target: 'test@test.com',
              },
              type: 'Email',
            },
          ],
          type: 'Report',
        },
      };
      // This is needed to structure the reportValues to match the fetchMock return
      const stringyReportValues = `{"id":1,"result":{"active":true,"creation_method":"dashboards","crontab":"0 12 * * 1","dashboard":${1},"name":"Weekly Report","owners":[${1}],"recipients":[{"recipient_config_json":{"target":"test@test.com"},"type":"Email"}],"type":"Report"}}`;
      // Watch for report POST
      fetchMock.post(REPORT_ENDPOINT, reportValues);

      // Click "Add" button to create a new email report
      const addButton = screen.getByRole('button', { name: /add/i });
      await waitFor(() => userEvent.click(addButton));

      // Mock addReport from Redux
      const makeRequest = () => {
        const request = actions.addReport(reportValues);
        return request(dispatch);
      };

      await makeRequest();

      // 🐞 ----- There are 2 POST calls at this point ----- 🐞

      // addReport's mocked POST return should match the mocked values
      expect(fetchMock.lastOptions()?.body).toEqual(stringyReportValues);
      expect(dispatch.callCount).toBe(2);
      const reportCalls = fetchMock.calls(REPORT_ENDPOINT);
      expect(reportCalls).toHaveLength(2);
    });
  });
});

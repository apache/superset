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
import {
  getByPlaceholderText,
  queryByPlaceholderText,
  render,
  waitFor,
} from 'spec/helpers/testing-library';
import { screen, fireEvent as rootFireEvent } from '@testing-library/react';
import * as uiCore from '@superset-ui/core';
import * as actions from 'src/features/reports/ReportModal/actions';
import { FeatureFlag } from '@superset-ui/core';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import ReportModal from '.';
// import { Store, AnyAction } from 'redux';

let isFeatureEnabledMock: jest.MockInstance<boolean, [string]>;

const REPORT_ENDPOINT = 'glob:*/api/v1/report*';
fetchMock.get(REPORT_ENDPOINT, {});

const mockStore = configureStore([]);
// const store = mockStore({});

const NOOP = () => {};

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

describe('S3 ReportModal Component', () => {
  beforeAll(() => {
    isFeatureEnabledMock = jest
      .spyOn(featureFlags, 'isFeatureEnabled')
      .mockImplementation(
        (featureFlag: FeatureFlag) => featureFlag === FeatureFlag.ALERT_REPORTS,
      );
  });

  beforeEach(() => {
    render(<ReportModal method="S3" {...defaultProps} />, { useRedux: true });
  });

  afterAll(() => {
    // @ts-ignore
    isFeatureEnabledMock.restore();
  });

  it('makes a selection in single mode', async () => {
    const { getByTestId } = render(
      <ReportModal show type="s3 report" s3Method="AWS_S3_credentials" />,
      { useRedux: true },
    );
    waitFor(() => {
      userEvent.click(getByTestId('select-s3-method'));
      const inputElement = getByTestId('select-s3-method').querySelector(
        '.ant-select-selection-search-input',
      ) as HTMLInputElement;
      rootFireEvent.select(inputElement, {
        target: { value: 'AWS_S3_credentials' },
      });
      expect(inputElement).toHaveValue('AWS_S3_credentials');
    });

    // Checking for bucket name,acess key,secret key
    waitFor(async () => {
      // expect(screen.findByTestId("test-bucket")).toBeInTheDocument();
      const bucketInput = await screen.findByTestId('test-bucket');
      const accessInput = await screen.findByTestId('test-access');
      const secretInput = await screen.findByTestId('test-secret');
      expect(bucketInput).toBeInTheDocument();
      expect(accessInput).toBeInTheDocument();
      expect(secretInput).toBeInTheDocument();

      // checking for input value
      userEvent.type(bucketInput, 'test-bucket-value');
      userEvent.type(accessInput, 'test-access-value');
      userEvent.type(secretInput, 'test-secret-value');

      expect(bucketInput).toHaveValue('test-bucket-value');
      expect(accessInput).toHaveValue('test-access-value');
      expect(secretInput).toHaveValue('test-secret-value');
    });
  });

  it('when s3Method is AWS_S3_pyconfig or AWS_S3_IAM', async () => {
    const { getByTestId } = render(
      <ReportModal show type="s3 report" s3Method="AWS_S3_credentials" />,
      { useRedux: true },
    );

    waitFor(async () => {
      userEvent.click(getByTestId('select-s3-method'));
      const inputElement = getByTestId('select-s3-method').querySelector(
        '.ant-select-selection-search-input',
      ) as HTMLInputElement;
      rootFireEvent.select(inputElement, {
        target: { value: 'AWS_S3_IAM' || 'AWS_S3_pyconfig' },
      });
      expect(inputElement).toHaveValue('AWS_S3_IAM' || 'AWS_S3_pyconfig');
    });

    // Checking for bucket name
    waitFor(async () => {
      const bucketInput = await screen.findByTestId('test-bucket');
      const accessInput = await screen.findByTestId('test-access');
      const secretInput = await screen.findByTestId('test-secret');
      expect(bucketInput).toBeInTheDocument();
      expect(accessInput).toBeInTheDocument();
      expect(secretInput).toBeInTheDocument();

      // checking for input value
      userEvent.type(bucketInput, 'test-bucket-value');
      expect(bucketInput).toHaveValue('test-bucket-value');
      expect(accessInput).not.toBeInTheDocument();
      expect(secretInput).not.toBeInTheDocument();
    });
  });

  describe('S3 Report Modal', () => {
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
      fetchMock.reset();
    });

    test('creates a new s3 report', async () => {
      // ---------- Render/value setup ----------
      const reportValues = {
        id: 1,
        result: {
          active: true,
          aws_S3_types: 'AWS_S3_credentials',
          aws_key: 'gg',
          aws_secretKey: 'ggj',
          chart: 164,
          creation_method: 'charts',
          crontab: '0 12 * * 1',
          description: 'aws',
          force_screenshot: false,
          name: 'Weekly Report Aws',
          owners: [1],
          recipients: [
            {
              recipient_config_json: {
                target: 'demo bucket name',
              },
              type: 'S3',
            },
          ],
          report_format: 'PNG',
          timezone: 'Asia/Kolkata',
          type: 'Report',
        },
      };
      // This is needed to structure the reportValues to match the fetchMock return
      const stringyReportValues = `{"id":1,"result":{"active":true,"aws_S3_types":"AWS_S3_credentials","aws_key":"gg","aws_secretKey":"ggj","chart":164,"creation_method":"charts","crontab":"0 12 * * 1","description":"aws","force_screenshot":false,"name":"Weekly Report Aws","owners":[1],"recipients":[{"recipient_config_json":{"target":"demo bucket name"},"type":"S3"}],"report_format":"PNG","timezone":"Asia/Kolkata","type":"Report"}}`;
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

describe('Email Report Modal', () => {
  beforeAll(() => {
    isFeatureEnabledMock = jest
      .spyOn(uiCore, 'isFeatureEnabled')
      .mockImplementation(
        (featureFlag: FeatureFlag) => featureFlag === FeatureFlag.AlertReports,
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
        .spyOn(uiCore, 'isFeatureEnabled')
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
      const stringyReportValues = `{"id":1,"result":{"active":true,"creation_method":"dashboards","crontab":"0 12 * * 1","dashboard":1,"name":"Weekly Report","owners":[1],"recipients":[{"recipient_config_json":{"target":"test@test.com"},"type":"Email"}],"type":"Report"}}`;
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

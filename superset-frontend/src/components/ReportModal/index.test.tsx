/* eslint-disable no-only-tests/no-only-tests */
/* eslint-disable jest/no-focused-tests */
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
import * as featureFlags from 'src/featureFlags';
import { FeatureFlag } from '@superset-ui/core';
import Button from 'src/components/Button';
import ReportModal, { ReportObject } from '.';

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
  creationMethod: 'charts_dashboards',
};

const mockEmailReport: ReportObject = {
  active: true,
  creation_method: defaultProps.creationMethod,
  crontab: '0 12 * * 1',
  dashboard: defaultProps.dashboardId,
  name: 'Weekly Report',
  owners: [defaultProps.userId],
  recipients: [
    {
      recipient_config_json: {
        target: defaultProps.userEmail,
      },
      type: 'Email',
    },
  ],
  type: 'Report',
  log_retention: 90,
  report_format: '',
  timezone: '',
  validator_config_json: {},
  validator_type: '',
  working_timeout: 1000,
};

// const mockReportModal = jest.createMockFromModule<any>('.').default;
// mockReportModal.onSave = jest.fn(() =>
//   fetchMock.post('glob:*/api/v1/report/', mockEmailReport),
// );

let isFeatureEnabledMock: jest.MockInstance<boolean, [string]>;

describe('Email Report Modal', () => {
  beforeAll(() => {
    isFeatureEnabledMock = jest
      .spyOn(featureFlags, 'isFeatureEnabled')
      .mockImplementation(
        (featureFlag: FeatureFlag) => featureFlag === FeatureFlag.ALERT_REPORTS,
      );
  });

  afterAll(() => {
    // @ts-ignore
    isFeatureEnabledMock.restore();
  });

  it('inputs respond correctly', () => {
    render(<ReportModal {...defaultProps} />, { useRedux: true });

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

  it.only('creates a new email report', () => {
    const mockOnSave = jest.fn().mockImplementation(() => {
      fetchMock.post('glob:*/api/v1/report/', mockEmailReport, {
        overwriteRoutes: true,
      });
      // defaultProps.addReport(mockEmailReport);
    });
    render(
      <ReportModal {...defaultProps}>
        <Button onClick={mockOnSave()}>Add</Button>
      </ReportModal>,
      { useRedux: true },
    );

    // ----- Click "Add" to create a new email report
    const addButton = screen.getByRole('button', { name: /add/i });
    userEvent.click(addButton);

    // fetchMock.post('glob:*/api/v1/report/', mockEmailReport);

    expect(mockOnSave).toHaveBeenCalled();
    expect(mockOnSave).toHaveReturnedWith(
      fetchMock.post('glob:*/api/v1/report/', mockEmailReport, {
        overwriteRoutes: true,
      }),
    );

    // screen.logTestingPlaygroundURL();
    // expect.anything();
  });
});

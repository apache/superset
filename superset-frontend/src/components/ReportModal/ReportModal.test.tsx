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
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import * as featureFlags from 'src/featureFlags';
import { FeatureFlag } from '@superset-ui/core';
import ReportModal from '.';

let isFeatureEnabledMock: jest.MockInstance<boolean, [string]>;

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
  props: {
    chart: {
      sliceFormData: {
        viz_type: 'table',
      },
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
});

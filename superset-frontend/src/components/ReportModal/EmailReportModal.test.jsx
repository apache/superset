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
import ReportModal from '.';

describe('Email Report Modal', () => {
  it('inputs respond correctly', () => {
    render(<ReportModal show />, { useRedux: true });

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
});

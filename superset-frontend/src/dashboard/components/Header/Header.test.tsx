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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { HeaderProps } from './types';
import Header from '.';

const mockedProps = {
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  addWarningToast: jest.fn(),
  dashboardInfo: {
    id: 1,
    dash_edit_perm: true,
    dash_save_perm: true,
    userId: 1,
    metadata: {},
    common: {
      conf: {},
    },
  },
  dashboardTitle: 'Title',
  charts: {},
  layout: {},
  expandedSlices: {},
  css: '',
  customCss: '',
  isStarred: false,
  isLoading: false,
  lastModifiedTime: 0,
  refreshFrequency: 0,
  shouldPersistRefreshFrequency: false,
  onSave: jest.fn(),
  onChange: jest.fn(),
  fetchFaveStar: jest.fn(),
  fetchCharts: jest.fn(),
  saveFaveStar: jest.fn(),
  savePublished: jest.fn(),
  isPublished: false,
  updateDashboardTitle: jest.fn(),
  editMode: false,
  setEditMode: jest.fn(),
  showBuilderPane: jest.fn(),
  updateCss: jest.fn(),
  setColorSchemeAndUnsavedChanges: jest.fn(),
  logEvent: jest.fn(),
  setRefreshFrequency: jest.fn(),
  hasUnsavedChanges: false,
  maxUndoHistoryExceeded: false,
  onUndo: jest.fn(),
  onRedo: jest.fn(),
  undoLength: 0,
  redoLength: 0,
  setMaxUndoHistoryExceeded: jest.fn(),
  maxUndoHistoryToast: jest.fn(),
  dashboardInfoChanged: jest.fn(),
  dashboardTitleChanged: jest.fn(),
};

fetchMock.get('glob:*/csstemplateasyncmodelview/api/read', {});

function setup(props: HeaderProps) {
  return <Header {...props} />;
}

test('should render', () => {
  const { container } = render(setup(mockedProps));
  expect(container).toBeInTheDocument();
});

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
import { shallow } from 'enzyme';
import Header from '../../../../src/dashboard/components/Header';
import EditableTitle from '../../../../src/components/EditableTitle';
import FaveStar from '../../../../src/components/FaveStar';
import PublishedStatus from '../../../../src/dashboard/components/PublishedStatus';
import HeaderActionsDropdown from '../../../../src/dashboard/components/HeaderActionsDropdown';
import Button from '../../../../src/components/Button';
import UndoRedoKeylisteners from '../../../../src/dashboard/components/UndoRedoKeylisteners';
import { BUILDER_PANE_TYPE } from '../../../../src/dashboard/util/constants';

describe('Header', () => {
  const props = {
    addSuccessToast: () => {},
    addDangerToast: () => {},
    dashboardInfo: {
      id: 1,
      dash_edit_perm: true,
      dash_save_perm: true,
      userId: 1,
    },
    dashboardTitle: 'title',
    charts: {},
    layout: {},
    filters: {},
    expandedSlices: {},
    css: '',
    isStarred: false,
    onSave: () => {},
    onChange: () => {},
    fetchFaveStar: () => {},
    fetchCharts: () => {},
    saveFaveStar: () => {},
    savePublished: () => {},
    isPublished: () => {},
    startPeriodicRender: () => {},
    updateDashboardTitle: () => {},
    editMode: false,
    setEditMode: () => {},
    showBuilderPane: () => {},
    builderPaneType: BUILDER_PANE_TYPE.NONE,
    updateCss: () => {},
    hasUnsavedChanges: false,
    maxUndoHistoryExceeded: false,

    // redux
    onUndo: () => {},
    onRedo: () => {},
    undoLength: 0,
    redoLength: 0,
    setMaxUndoHistoryExceeded: () => {},
    maxUndoHistoryToast: () => {},
    dashboardInfoChanged: () => {},
    dashboardTitleChanged: () => {},
  };

  function setup(overrideProps) {
    const wrapper = shallow(<Header {...props} {...overrideProps} />);
    return wrapper;
  }

  describe('read-only-user', () => {
    const overrideProps = {
      dashboardInfo: {
        id: 1,
        dash_edit_perm: false,
        dash_save_perm: false,
        userId: 1,
      },
    };

    it('should render the EditableTitle', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(EditableTitle)).toHaveLength(1);
    });

    it('should render the PublishedStatus', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(PublishedStatus)).toHaveLength(1);
    });

    it('should render the FaveStar', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(FaveStar)).toHaveLength(1);
    });

    it('should render the HeaderActionsDropdown', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(HeaderActionsDropdown)).toHaveLength(1);
    });

    it('should render one Button', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(Button)).toHaveLength(1);
    });

    it('should not set up undo/redo', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(UndoRedoKeylisteners)).toHaveLength(0);
    });
  });

  describe('write-user', () => {
    const overrideProps = {
      editMode: false,
      dashboardInfo: {
        id: 1,
        dash_edit_perm: true,
        dash_save_perm: true,
        userId: 1,
      },
    };

    it('should render the EditableTitle', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(EditableTitle)).toHaveLength(1);
    });

    it('should render the PublishedStatus', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(PublishedStatus)).toHaveLength(1);
    });

    it('should render the FaveStar', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(FaveStar)).toHaveLength(1);
    });

    it('should render the HeaderActionsDropdown', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(HeaderActionsDropdown)).toHaveLength(1);
    });

    it('should render one Button', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(Button)).toHaveLength(1);
    });

    it('should not set up undo/redo', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(UndoRedoKeylisteners)).toHaveLength(0);
    });
  });

  describe('write-user-with-edit-mode', () => {
    const overrideProps = {
      editMode: true,
      dashboardInfo: {
        id: 1,
        dash_edit_perm: true,
        dash_save_perm: true,
        userId: 1,
      },
    };

    it('should render the EditableTitle', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(EditableTitle)).toHaveLength(1);
    });

    it('should render the FaveStar', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(FaveStar)).toHaveLength(1);
    });

    it('should render the PublishedStatus', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(PublishedStatus)).toHaveLength(1);
    });

    it('should render the HeaderActionsDropdown', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(HeaderActionsDropdown)).toHaveLength(1);
    });

    it('should render five Buttons', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(Button)).toHaveLength(5);
    });

    it('should set up undo/redo', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(UndoRedoKeylisteners)).toHaveLength(1);
    });
  });

  describe('logged-out-user', () => {
    const overrideProps = {
      dashboardInfo: {
        id: 1,
        dash_edit_perm: false,
        dash_save_perm: false,
        userId: null,
      },
    };

    it('should render the EditableTitle', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(EditableTitle)).toHaveLength(1);
    });

    it('should render the PublishedStatus', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(PublishedStatus)).toHaveLength(1);
    });

    it('should not render the FaveStar', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(FaveStar)).toHaveLength(0);
    });

    it('should render the HeaderActionsDropdown', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(HeaderActionsDropdown)).toHaveLength(1);
    });

    it('should render one Button', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(Button)).toHaveLength(1);
    });

    it('should not set up undo/redo', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(UndoRedoKeylisteners)).toHaveLength(0);
    });
  });
});

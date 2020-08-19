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
import Header from 'src/dashboard/components/Header';
import EditableTitle from 'src/components/EditableTitle';
import FaveStar from 'src/components/FaveStar';
import PublishedStatus from 'src/dashboard/components/PublishedStatus';
import HeaderActionsDropdown from 'src/dashboard/components/HeaderActionsDropdown';
import Button from 'src/components/Button';
import UndoRedoKeylisteners from 'src/dashboard/components/UndoRedoKeylisteners';

describe('Header', () => {
  const props = {
    addSuccessToast: () => {},
    addDangerToast: () => {},
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
    updateDashboardTitle: () => {},
    editMode: false,
    setEditMode: () => {},
    showBuilderPane: () => {},
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
        ...props.dashboardInfo,
        id: 1,
        dash_edit_perm: false,
        dash_save_perm: false,
        userId: 1,
      },
    };

    it('should render the EditableTitle', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(EditableTitle)).toExist();
    });

    it('should render the PublishedStatus', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(PublishedStatus)).toExist();
    });

    it('should render the FaveStar', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(FaveStar)).toExist();
    });

    it('should render the HeaderActionsDropdown', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(HeaderActionsDropdown)).toExist();
    });

    it('should not set up undo/redo', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(UndoRedoKeylisteners)).not.toExist();
    });
  });

  describe('write-user', () => {
    const overrideProps = {
      editMode: false,
      dashboardInfo: {
        ...props.dashboardInfo,
        id: 1,
        dash_edit_perm: true,
        dash_save_perm: true,
        userId: 1,
      },
    };

    it('should render the EditableTitle', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(EditableTitle)).toExist();
    });

    it('should render the PublishedStatus', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(PublishedStatus)).toExist();
    });

    it('should render the FaveStar', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(FaveStar)).toExist();
    });

    it('should render the HeaderActionsDropdown', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(HeaderActionsDropdown)).toExist();
    });

    it('should not set up undo/redo', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(UndoRedoKeylisteners)).not.toExist();
    });
  });

  describe('write-user-with-edit-mode', () => {
    const overrideProps = {
      editMode: true,
      dashboardInfo: {
        ...props.dashboardInfo,
        id: 1,
        dash_edit_perm: true,
        dash_save_perm: true,
        userId: 1,
      },
    };

    it('should render the EditableTitle', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(EditableTitle)).toExist();
    });

    it('should render the FaveStar', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(FaveStar)).toExist();
    });

    it('should render the PublishedStatus', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(PublishedStatus)).toExist();
    });

    it('should render the HeaderActionsDropdown', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(HeaderActionsDropdown)).toExist();
    });

    it('should render five Buttons', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(Button)).toHaveLength(4);
    });

    it('should set up undo/redo', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(UndoRedoKeylisteners)).toExist();
    });
  });

  describe('logged-out-user', () => {
    const overrideProps = {
      dashboardInfo: {
        ...props.dashboardInfo,
        id: 1,
        dash_edit_perm: false,
        dash_save_perm: false,
        userId: null,
      },
    };

    it('should render the EditableTitle', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(EditableTitle)).toExist();
    });

    it('should render the PublishedStatus', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(PublishedStatus)).toExist();
    });

    it('should not render the FaveStar', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(FaveStar)).not.toExist();
    });

    it('should render the HeaderActionsDropdown', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(HeaderActionsDropdown)).toExist();
    });

    it('should not set up undo/redo', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(UndoRedoKeylisteners)).not.toExist();
    });
  });
});

import React from 'react';
import { expect } from 'chai';
import { shallow } from 'enzyme';
import Header from '../../../../src/dashboard/components/Header';
import EditableTitle from '../../../../src/components/EditableTitle';
import FaveStar from '../../../../src/components/FaveStar';
import HeaderActionsDropdown from '../../../../src/dashboard/components/HeaderActionsDropdown';
import Button from '../../../../src/components/Button';
import UndoRedoKeylisteners from '../../../../src/dashboard/components/UndoRedoKeylisteners';

describe('Header', () => {
  const props = {
    addSuccessToast: () => {},
    addDangerToast: () => {},
    dashboardInfo: { id: 1, dash_edit_perm: true, dash_save_perm: true },
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
    startPeriodicRender: () => {},
    updateDashboardTitle: () => {},
    editMode: false,
    setEditMode: () => {},
    showBuilderPane: false,
    toggleBuilderPane: () => {},
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
  };

  function setup(overrideProps) {
    const wrapper = shallow(<Header {...props} {...overrideProps} />);
    return wrapper;
  }

  describe('read-only-user', () => {
    const overrideProps = {
      dashboardInfo: { id: 1, dash_edit_perm: false, dash_save_perm: false },
    };

    it('should render the EditableTitle', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(EditableTitle)).to.have.lengthOf(1);
    });

    it('should render the FaveStar', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(FaveStar)).to.have.lengthOf(1);
    });

    it('should render the HeaderActionsDropdown', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(HeaderActionsDropdown)).to.have.lengthOf(1);
    });

    it('should render one Button', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(Button)).to.have.lengthOf(1);
    });

    it('should not set up undo/redo', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(UndoRedoKeylisteners)).to.have.lengthOf(0);
    });
  });

  describe('write-user', () => {
    const overrideProps = {
      editMode: false,
      dashboardInfo: { id: 1, dash_edit_perm: true, dash_save_perm: true },
    };

    it('should render the EditableTitle', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(EditableTitle)).to.have.lengthOf(1);
    });

    it('should render the FaveStar', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(FaveStar)).to.have.lengthOf(1);
    });

    it('should render the HeaderActionsDropdown', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(HeaderActionsDropdown)).to.have.lengthOf(1);
    });

    it('should render one Button', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(Button)).to.have.lengthOf(1);
    });

    it('should not set up undo/redo', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(UndoRedoKeylisteners)).to.have.lengthOf(0);
    });
  });

  describe('write-user-with-edit-mode', () => {
    const overrideProps = {
      editMode: true,
      dashboardInfo: { id: 1, dash_edit_perm: true, dash_save_perm: true },
    };

    it('should render the EditableTitle', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(EditableTitle)).to.have.lengthOf(1);
    });

    it('should render the FaveStar', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(FaveStar)).to.have.lengthOf(1);
    });

    it('should render the HeaderActionsDropdown', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(HeaderActionsDropdown)).to.have.lengthOf(1);
    });

    it('should render four Buttons', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(Button)).to.have.lengthOf(4);
    });

    it('should set up undo/redo', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(UndoRedoKeylisteners)).to.have.lengthOf(1);
    });
  });
});

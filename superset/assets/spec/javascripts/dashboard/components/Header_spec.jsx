import React from 'react';
import { describe, it } from 'mocha';
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

  it('read-only user sees minimal header', () => {
    const overrideProps = {
      dashboardInfo: { id: 1, dash_edit_perm: false, dash_save_perm: false },
    };

    const wrapper = setup(overrideProps);
    expect(wrapper.find(EditableTitle)).to.have.lengthOf(1);
    expect(wrapper.find(FaveStar)).to.have.lengthOf(1);
    expect(wrapper.find(HeaderActionsDropdown)).to.have.lengthOf(1);

    expect(wrapper.find(Button)).to.have.lengthOf(1);
    expect(wrapper.find(UndoRedoKeylisteners)).to.have.lengthOf(0);
  });

  it('write user sees single edit button header', () => {
    const overrideProps = {
      editMode: false,
      dashboardInfo: { id: 1, dash_edit_perm: true, dash_save_perm: true },
    };

    const wrapper = setup(overrideProps);
    expect(wrapper.find(EditableTitle)).to.have.lengthOf(1);
    expect(wrapper.find(FaveStar)).to.have.lengthOf(1);
    expect(wrapper.find(HeaderActionsDropdown)).to.have.lengthOf(1);
    expect(wrapper.find(UndoRedoKeylisteners)).to.have.lengthOf(0);

    expect(wrapper.find(Button)).to.have.lengthOf(1);
  });

  it('edit mode sees button list', () => {
    const overrideProps = {
      editMode: true,
      dashboardInfo: { id: 1, dash_edit_perm: true, dash_save_perm: true },
    };

    const wrapper = setup(overrideProps);
    expect(wrapper.find(EditableTitle)).to.have.lengthOf(1);
    expect(wrapper.find(FaveStar)).to.have.lengthOf(1);
    expect(wrapper.find(HeaderActionsDropdown)).to.have.lengthOf(1);
    expect(wrapper.find(UndoRedoKeylisteners)).to.have.lengthOf(1);

    const buttons = wrapper.find(Button);
    expect(buttons).to.have.lengthOf(4);
  });
});

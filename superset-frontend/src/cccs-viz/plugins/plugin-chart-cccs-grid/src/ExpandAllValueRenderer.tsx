import { GroupCellRenderer } from '@ag-grid-enterprise/all-modules';
import React, { Component } from 'react';
import './Buttons.css';

// Show a button to collapse all of the JSON blobs in the row
function collapseJSON(this: any, reverseState: any) {
  return (
    <button className="Row-Expand" type="button" onClick={reverseState}>
      Collapse Row
    </button>
  );
}

// Show a button to expand all of the JSON blobs in the row
function expandJSON(this: any, reverseState: any) {
  return (
    <>
      <button className="Row-Expand" type="button" onClick={reverseState}>
        Expand Row
      </button>
    </>
  );
}

export default class ExpandAllValueRenderer extends Component<
  {},
  { api: any; expanded: boolean; rowIndex: number }
> {
  constructor(props: any) {
    super(props);

    this.state = {
      api: props.api,
      expanded: false,
      rowIndex: props.rowIndex,
    };
  }

  // Get all of the cells in the AG Grid and only keep the ones that
  // are in the same row as the current expand all button, and make
  // sure that they have a JSON blob
  getJSONCells = () => {
    const instances = this.state.api.getCellRendererInstances();

    // Make sure row grouping is not enabled, but if it is, don't
    // try to find all of the JSON blobs in the row
    if (
      instances.filter((instance: any) => instance instanceof GroupCellRenderer)
        .length === 0
    ) {
      const newInstances = instances.filter(
        (instance: any) =>
          instance.params.rowIndex === this.state.rowIndex &&
          instance.params.column.colDef.cellRenderer === 'jsonValueRenderer',
      );

      return newInstances;
    }
    return [];
  };

  // Set the current `expanded` field to the opposite of what it currently is
  // as well as go through each cell renderer and if it's in the same row &
  // it's a cell with a JSON blob, update whether it is expanded or not
  reverseState = () => {
    this.setState(prevState => ({
      ...prevState,
      expanded: !prevState.expanded,
    }));

    const newInstances = this.getJSONCells();

    newInstances.map((instance: any) =>
      instance.componentInstance.updateState(!this.state.expanded),
    );
  };

  // Set the current `expanded` field to be equal to the boolean being passed in
  // as well as go through each cell renderer and if it's in the same row &
  // it's a cell with a JSON blob, update whether it is expanded or not
  updateState = (newFlag: any) => {
    this.setState(prevState => ({ ...prevState, expanded: newFlag }));

    const newInstances = this.getJSONCells();

    newInstances.map((instance: any) =>
      instance.componentInstance.updateState(newFlag),
    );
  };

  // Get all of the cells in the AG Grid and only keep the ones
  // that are in the same row as the current expand all button and
  // make sure that they have a JSON blob (and see whether they are
  // expanded or not)
  checkState = () => {
    const newInstances = this.getJSONCells();

    const jsonCellExpandedValues = newInstances.map((instance: any) =>
      instance.componentInstance.getExpandedValue(),
    );

    // If there is at least one cell that can expand, the expand all
    // button for the row should show 'Expand'
    this.setState(prevState => ({
      ...prevState,
      expanded: !jsonCellExpandedValues.includes(false),
    }));
  };

  // Show either the expand or collapse button dependent
  // on the value of the `expanded` field
  render() {
    if (this.state.expanded === false) {
      return expandJSON(this.reverseState);
    }
    return collapseJSON(this.reverseState);
  }
}

import { GroupCellRenderer } from '@ag-grid-enterprise/all-modules';
import React, { Component } from 'react';
import { JSONTree } from 'react-json-tree';

import './Buttons.css';

function safeJsonObjectParse(
  data: unknown,
): null | unknown[] | Record<string, unknown> {
  // First perform a cheap proxy to avoid calling JSON.parse on data that is clearly not a
  // JSON object or an array
  if (
    typeof data !== 'string' ||
    ['{', '['].indexOf(data.substring(0, 1)) === -1
  ) {
    return null;
  }

  // We know 'data' is a string starting with '{' or '[', so try to parse it as a valid object
  try {
    const jsonData = JSON.parse(data);
    if (jsonData && typeof jsonData === 'object') {
      return jsonData;
    }
    return null;
  } catch (_) {
    return null;
  }
}

// JSX which shows the JSON tree inline, and a button to collapse it
function collapseJSON(this: any, reverseState: any, jsonObject: any) {
  return (
    <>
      <div style={{ float: 'left' }}>
        <button
          className="Button Collapse"
          type="button"
          title="Collapse"
          onClick={reverseState}
        >
          {' '}
        </button>
      </div>
      <div style={{ float: 'left' }}>
        <JSONTree
          data={jsonObject}
          theme="default"
          shouldExpandNode={() => true}
        />
      </div>
    </>
  );
}

// JSX which shows the JSON data on one line, and a button to open the JSON tree
function expandJSON(this: any, reverseState: any, cellData: any) {
  return (
    <>
      <button
        className="Button Expand"
        type="button"
        title="Expand"
        onClick={reverseState}
      >
        {' '}
      </button>
      {cellData}
    </>
  );
}

export default class JsonValueRenderer extends Component<
  {},
  { api: any; cellValue: any; expanded: boolean; rowIndex: number }
> {
  constructor(props: any) {
    super(props);

    this.state = {
      api: props.api,
      cellValue: JsonValueRenderer.getValueToDisplay(props),
      expanded: false,
      rowIndex: props.rowIndex,
    };
  }

  // update cellValue when the cell's props are updated
  static getDerivedStateFromProps(nextProps: any) {
    return {
      cellValue: JsonValueRenderer.getValueToDisplay(nextProps),
    };
  }

  // Set the current `expanded` field to the opposite of what it currently is
  // and trigger the 'checkState` function in the expand all button for the row
  reverseState = () => {
    this.setState(
      prevState => ({ ...prevState, expanded: !prevState.expanded }),
      () => {
        const instances = this.state.api.getCellRendererInstances();

        // Make sure row grouping is not enabled, but if it is, don't
        // trigger the 'checkState` function in the expand all button for the row
        if (
          instances.filter(
            (instance: any) => instance instanceof GroupCellRenderer,
          ).length === 0
        ) {
          instances
            .filter(
              (instance: any) =>
                instance.params.rowIndex === this.state.rowIndex &&
                instance.params.column.colDef.cellRenderer ===
                  'expandAllValueRenderer',
            )
            .map((instance: any) => instance.componentInstance.checkState());
        }
      },
    );
  };

  // Take the boolean value passed in and set the `expanded` field equal to it
  updateState = (newFlag: any) => {
    this.setState(prevState => ({ ...prevState, expanded: newFlag }));
  };

  // Return whether 'expanded' is set to true or false
  getExpandedValue = () => this.state.expanded;

  render() {
    const cellData = this.state.cellValue;
    const jsonObject = safeJsonObjectParse(this.state.cellValue);

    // If there is a JSON object, either show it expanded or collapsed based
    // on the value which the `expanded` field is set to
    if (jsonObject) {
      if (this.state.expanded === false) {
        return expandJSON(this.reverseState, cellData);
      }
      return collapseJSON(this.reverseState, jsonObject);
    }
    // If the cellData is set to 'null' or undefined, return null
    return cellData !== 'null' && cellData !== undefined ? cellData : null;
  }

  static getValueToDisplay(params: { valueFormatted: any; value: any }) {
    return params.valueFormatted ? params.valueFormatted : params.value;
  }
}

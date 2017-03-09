import React from 'react';
import { Table, Column, Cell } from 'fixed-data-table';
import shortid from 'shortid';

require('../../node_modules/fixed-data-table/dist/fixed-data-table.min.css');

class MyCell extends React.Component {
  render() {
    const {rowIndex, data, field, ...props} = this.props;
    console.log('MyCell this.props', this.props)
    return (
      <Cell {...props}>
        {data[rowIndex][field]}
      </Cell>
    );
  }
}

export default class FilterTable extends React.Component {
  constructor(props) {
    console.log('props', props)
    super(props);
  }

  renderColumns() {
    const columnNames = Object.keys(this.props.data[0]);
    return columnNames.map((colName) => {
      return (
        <Column
          key={shortid.generate()}
          header={<Cell>{colName}</Cell>}
          cell={<MyCell data={this.props.data} field={colName} />}
          width={200}
        />
      );
    });
  }

  render() {
    // todo: get dynamic width of container
    // todo: get dynamic height of cell
    return (
      <div>
        <Table
          rowsCount={this.props.data.length}
          rowHeight={30}
          width={1037}
          height={this.props.height}
          headerHeight={30}
        >
          {this.renderColumns()}
        </Table>
      </div>
    );
  }
}

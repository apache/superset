import React, {Component} from 'react';
import {render} from 'react-dom';
import {Table, Column} from 'react-virtualized';
import {SortableContainer, SortableElement, arrayMove} from 'react-sortable-hoc';
import 'react-virtualized/styles.css';

const ROW_HEIGHT = 30;
const HEADER_ROW_HEIGHT = 20;
const COL_WIDTH = 100;

const SortableHeader = SortableElement(({children, ...props}) =>
  React.cloneElement(children, props)
);

const SortableHeaderRowRenderer = SortableContainer(
  ({className, columns, style}) => (
    <div className={className} role="row" style={style}>
      {React.Children.map(columns, (column, index) => (
        <SortableHeader index={index}>
          {column}
        </SortableHeader>
      ))}
    </div>
  )
);

class TableWithSortableColumns extends Component {
  state = {
    cols: [
      {dataKey: 'col1', label: 'Column 1'},
      {dataKey: 'col2', label: 'Column 2'},
      {dataKey: 'col3', label: 'Column 3'},
    ],
    rows: [
      {col1: 'row1 col1', col2: 'row1 col2', col3: 'row1 col3'},
      {col1: 'row2 col1', col2: 'row2 col2', col3: 'row2 col3'},
      {col1: 'row3 col1', col2: 'row3 col2', col3: 'row3 col3'},
    ],
  };
  onSortEnd = ({oldIndex, newIndex}) => {
    this.setState(state => ({
      cols: arrayMove(state.cols, oldIndex, newIndex),
    }));
  };
  render() {
    const {rows, cols} = this.state;
    return (
      <Table
        width={COL_WIDTH * rows.length}
        height={HEADER_ROW_HEIGHT + (ROW_HEIGHT * rows.length)}
        headerHeight={ROW_HEIGHT}
        rowHeight={ROW_HEIGHT}
        rowCount={rows.length}
        rowGetter={({index}) => rows[index]}
        headerRowRenderer={params => (
          <SortableHeaderRowRenderer
            {...params}
            axis="x"
            lockAxis="x"
            onSortEnd={this.onSortEnd}
          />
        )}
      >
        {cols.map(col => (
          <Column
            {...col}
            key={col.dataKey}
            width={COL_WIDTH}
          />
        ))}
      </Table>
    );
  }
}

render(<TableWithSortableColumns />, document.getElementById('root'));

import React from 'react';
import { BootstrapTable, TableHeaderColumn } from 'react-bootstrap-table';

const TableMetadata = function (props) {
  return (
    <BootstrapTable
      condensed
      data={props.table.columns}
    >
      <TableHeaderColumn dataField="id" isKey hidden>
        id
      </TableHeaderColumn>
      <TableHeaderColumn dataField="name">Name</TableHeaderColumn>
      <TableHeaderColumn dataField="type">Type</TableHeaderColumn>
    </BootstrapTable>
  );
};

TableMetadata.propTypes = {
  table: React.PropTypes.object,
};

export default TableMetadata;

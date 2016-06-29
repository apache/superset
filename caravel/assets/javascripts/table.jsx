import React from 'react';
import { render } from 'react-dom';

import { Button, ButtonGroup, Tab, Tabs } from 'react-bootstrap';

import brace from 'brace';
import AceEditor from 'react-ace';
import 'brace/mode/sql';
import 'brace/theme/chrome';


var ReactGridLayout = require('react-grid-layout');
var FixedDataTable = require('fixed-data-table');

require('../stylesheets/carapal.css')
require('../stylesheets/fixed-data-table.css')

const MyTextCell = React.createClass({
  render: function() {
    const {rowIndex, field, data, ...props} = this.props;
    return (
      <FixedDataTable.Cell {...props}>
        {data[rowIndex][field]}
      </FixedDataTable.Cell>
    );
  }
});

const QueryResultSetV2 = React.createClass({
  getInitialState: function() {
    return {
      myTableData: [
        {name: 'Rylan', email: 'Angelita_Weimann42@gmail.com'},
        {name: 'Amelia', email: 'Dexter.Trantow57@hotmail.com'},
        {name: 'Estevan', email: 'Aimee7@hotmail.com'},
        {name: 'Florence', email: 'Jarrod.Bernier13@yahoo.com'},
        {name: 'Tressa', email: 'Yadira1@hotmail.com'},
      ],
    };
  },
  render: function () {
  return (
      <FixedDataTable.Table
      rowHeight={40}
      rowsCount={5}
      width={390}
      height={390}
      headerHeight={40}>
        <FixedDataTable.Column
          header={<FixedDataTable.Cell>Name</FixedDataTable.Cell>}
          cell={
            <MyTextCell
              data={this.state.myTableData}
              field="name"
            />
          }
          width={100}
          height={30}
        />
        <FixedDataTable.Column
          header={<FixedDataTable.Cell>Email</FixedDataTable.Cell>}
          cell={
            <MyTextCell
              data={this.state.myTableData}
              field="email"
            />
          }
          width={100}
          height={30}
        />
    </FixedDataTable.Table>
    );
  }
});

const App = React.createClass({
  render: function () {
    return (
        <QueryResultSetV2 name="qry2V2"/>
    )
  }
});

render(
  <App/>,
  document.getElementById('app')
);

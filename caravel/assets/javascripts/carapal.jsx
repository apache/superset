import React from 'react';
import { render } from 'react-dom';

import { Button, ButtonGroup } from 'react-bootstrap';
import { Table } from 'reactable';

import brace from 'brace';
import AceEditor from 'react-ace';
import 'brace/mode/sql';
import 'brace/theme/chrome';


var ReactGridLayout = require('react-grid-layout');

require('../stylesheets/carapal.css')

const GridItem = React.createClass({
  getDefaultProps: function() {
    return {
      nopadding: false
    };
  },
  render: function () {
    return (
      <div className="panel panel-default">
        <div className="panel-heading">{this.props.header}</div>
        <div className={"panel-body " + (this.props.nopadding ? 'nopadding': '')}>
          {this.props.children}
        </div>
      </div>
    )
  }
});

const SqlEditor = React.createClass({
  render: function () {
    return (
      <GridItem
        nopadding={true}
        header={
          <div>Query
            <span className="pull-right">
              <Button bsSize="small">Run</Button>
            </span>
          </div>
        }>
      <div className="sqleditor">
        <AceEditor
          mode="sql"
          name={this.props.name}
          theme="chrome"
          minLines={10}
          maxLines={50}
          editorProps={{$blockScrolling: true}}
          value="SELECT * FROM users"
        />
      </div>
    </GridItem>
    )
  }
});

const ResultSet = React.createClass({
  render: function () {
    return (
    <GridItem
        header={(
          <div>
            Result Set
            <span className="pull-right">
              <ButtonGroup>
                <Button bsSize="small">.csv</Button>
                <Button bsSize="small">.json</Button>
              </ButtonGroup>
            </span>
          </div>
        )}
        nopadding={true}>
      <Table
        className="table table-condensed table-striped table-bordered small"
        sortable={true}
        data={[
            {'State': 'New York', 'Description': 'this is some text', 'Tag': 'new'},
            {'State': 'New Mexico', 'Description': 'lorem ipsum', 'Tag': 'old'},
            {'State': 'Colorado',
             'Description': 'new description that shouldn\'t match filter',
             'Tag': 'old'},
            {'State': 'Alaska', 'Description': 'bacon', 'Tag': 'renewed'},
            {'State': 'New York', 'Description': 'this is some text', 'Tag': 'new'},
            {'State': 'New Mexico', 'Description': 'lorem ipsum', 'Tag': 'old'},
            {'State': 'Colorado',
             'Description': 'new description that shouldn\'t match filter',
             'Tag': 'old'},
            {'State': 'Alaska', 'Description': 'bacon', 'Tag': 'renewed'},
            {'State': 'New York', 'Description': 'this is some text', 'Tag': 'new'},
            {'State': 'New Mexico', 'Description': 'lorem ipsum', 'Tag': 'old'},
            {'State': 'Colorado',
             'Description': 'new description that shouldn\'t match filter',
             'Tag': 'old'},
            {'State': 'Alaska', 'Description': 'bacon', 'Tag': 'renewed'},
        ]}/>
    </GridItem>
    )
  }
});


const Workspace = React.createClass({
  render: function () {
    return (
      <GridItem header="Workspace Browser">
        <strong>
          Tables <Button bsSize="small"><a className="fa fa-plus"></a></Button>
        </strong>
        <ul>
          <li><a href="#">fct_bookings</a></li>
          <li><a href="#">dim_users</a></li>
          <li><a href="#">dim_markets</a></li>
        </ul>
        <strong>
          Queries <Button bsSize="small"><a className="fa fa-plus"></a></Button>
        </strong>
        <ul>
          <li><a href="#">bookings by market</a></li>
          <li><a href="#">bookings time series</a></li>
          <li><a href="#">hour hot spots</a></li>
        </ul>
      </GridItem>
    )
  }
});

const App = React.createClass({
  render: function () {
    return (
      <ReactGridLayout
          className="layout"
          cols={12} rowHeight={30}
          width={window.innerWidth}>
        <div key="qry1" _grid={{x: 3, y: 0, w: 5, h: 5}}>
          <SqlEditor name="qry1"/>
        </div>
        <div key="qry2" _grid={{x: 8, y: 0, w: 4, h: 5}}>
          <SqlEditor name="qry2"/>
        </div>
        <div key="results" _grid={{x: 3, y: 6, w: 9, h: 10}}>
          <ResultSet/>
        </div>
        <div key="workspace" _grid={{x: 0, y: 0, w: 3, h: 15, maxW:4, minW: 4}}>
          <Workspace/>
        </div>
      </ReactGridLayout>
    )
  }
});

render(
  <App/>,
  document.getElementById('app')
);

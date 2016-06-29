import React from 'react';
import { render } from 'react-dom';

import { Button, ButtonGroup, Tab, Tabs } from 'react-bootstrap';
import { Table } from 'reactable';

import brace from 'brace';
import AceEditor from 'react-ace';
import 'brace/mode/sql';
import 'brace/theme/chrome';

var ReactGridLayout = require('react-grid-layout');
require('../stylesheets/carapal.css')

// Data Model
var query_result_data=[
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
         ]

var table_preview_data=[
             {'id': '1', 'State': 'New York', 'Description': 'this is some text', 'Tag': 'new'},
             {'id': '2', 'State': 'New Mexico', 'Description': 'lorem ipsum', 'Tag': 'old'},
             {'id': '3', 'State': 'Colorado',
              'Description': 'new description that shouldn\'t match filter',
              'Tag': 'old'},
             {'id': '4', 'State': 'Alaska', 'Description': 'bacon', 'Tag': 'renewed'},
             {'id': '5', 'State': 'New York', 'Description': 'this is some text', 'Tag': 'new'},
             {'id': '6', 'State': 'New Mexico', 'Description': 'lorem ipsum', 'Tag': 'old'},
             {'id': '7', 'State': 'Colorado',
              'Description': 'new description that shouldn\'t match filter',
              'Tag': 'old'},
         ]

var table_schema_data=[
     {'column': 'id', 'type': 'Integer'},
     {'column': 'State', 'type': 'String'},
     {'column': 'Description', 'type': 'String'},
 ]

var saved_queries_data=[]
var query_history_data=[]


// Componenst
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

const TabbedSqlEditor = React.createClass({
  render: function () {
    return (
      <GridItem nopadding={true}
          header={
          <div>Tabbed Query "Bla Bla Bla"
            <span className="pull-right">
              <Button bsSize="small">Run</Button>
            </span>
          </div>
        }>
        <div className="tabbedsqleditor">
          <Tabs defaultActiveKey={2} id="uncontrolled-tab-example">
            <Tab eventKey={1} title="Query 1">
              <SqlEditor name="qry1"/>
            </Tab>
            <Tab eventKey={2} title="Query 2">
              <SqlEditor name="qry2"/>
            </Tab>
            <Tab eventKey={3} title="Query 3">
              <SqlEditor name="qry3"/>
            </Tab>
          </Tabs>
        </div>
      </GridItem>
    )
  }
});

const SqlEditor = React.createClass({
  render: function () {
    return (
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
    )
  }
});

const QueryResultSet = React.createClass({
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
        data={this.props.data}
      />
    </GridItem>
    )
  }
});

const TabbedResultsSet = React.createClass({
  render: function () {
    return (
      <GridItem nopadding={true}>
        <div className="tabbedsqleditor">
          <Tabs defaultActiveKey={2} id="uncontrolled-tab-example">
            <Tab eventKey={1} title="Table preview">
              <QueryResultSet name="table_preview" data={this.props.table_preview_data}/>
            </Tab>
            <Tab eventKey={2} title="Query result">
              <QueryResultSet name="query_result_set" data={this.props.query_result_data}/>
            </Tab>
            <Tab eventKey={3} title="Table schema">
              <QueryResultSet name="table_schema" data={this.props.table_schema_data}/>
            </Tab>
            <Tab eventKey={4} title="Saved Queries">
              <div className="saved_queries" data={this.props.saved_queries_data}/>
            </Tab>
            <Tab eventKey={5} title="Query History">
              <div className="query_history" data={this.props.query_history_data}/>
            </Tab>
          </Tabs>
        </div>
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
        <div key="qry2" _grid={{x: 8, y: 0, w: 4, h: 5}}>
          <TabbedSqlEditor name="qry2"/>
        </div>
        <div key="results" _grid={{x: 6, y: 12, w: 9, h: 10}}>
          <TabbedResultsSet
            name="results"
            table_preview_data={table_preview_data}
            query_result_data={query_result_data}
            table_schema_data={table_schema_data}
            saved_queries_data={saved_queries_data}
            query_history_data={query_history_data}
          />
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

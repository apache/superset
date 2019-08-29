/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import shortid from 'shortid';
import { Alert, Label, Tab, Tabs } from 'react-bootstrap';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { t } from '@superset-ui/translation';

import * as Actions from '../actions/sqlLab';
import QueryHistory from './QueryHistory';
import ResultSet from './ResultSet';
import { STATUS_OPTIONS, STATE_BSSTYLE_MAP, LOCALSTORAGE_MAX_QUERY_AGE_MS } from '../constants';

const TAB_HEIGHT = 44;

/*
    editorQueries are queries executed by users passed from SqlEditor component
    dataPrebiewQueries are all queries executed for preview of table data (from SqlEditorLeft)
*/
const propTypes = {
  editorQueries: PropTypes.array.isRequired,
  latestQueryId: PropTypes.string,
  dataPreviewQueries: PropTypes.array.isRequired,
  actions: PropTypes.object.isRequired,
  activeSouthPaneTab: PropTypes.string,
  height: PropTypes.number,
  databases: PropTypes.object.isRequired,
  offline: PropTypes.bool,
};

const defaultProps = {
  activeSouthPaneTab: 'Results',
  offline: false,
};

export class SouthPane extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      height: props.height,
    };
    this.southPaneRef = React.createRef();
    this.getSouthPaneHeight = this.getSouthPaneHeight.bind(this);
    this.switchTab = this.switchTab.bind(this);
  }
  UNSAFE_componentWillReceiveProps() {
    // south pane expands the entire height of the tab content on mount
    this.setState({ height: this.getSouthPaneHeight() });
  }
  // One layer of abstraction for easy spying in unit tests
  getSouthPaneHeight() {
    return this.southPaneRef.current ? this.southPaneRef.current.clientHeight : 0;
  }
  switchTab(id) {
    this.props.actions.setActiveSouthPaneTab(id);
  }
  render() {
    if (this.props.offline) {
      return (
        <Label className="m-r-3" bsStyle={STATE_BSSTYLE_MAP[STATUS_OPTIONS.offline]}>
          { STATUS_OPTIONS.offline }
        </Label>);
    }
    const innerTabContentHeight = this.state.height - TAB_HEIGHT;
    let latestQuery;
    const props = this.props;
    if (props.editorQueries.length > 0) {
      // get the latest query
      latestQuery = props.editorQueries.find(q => q.id === this.props.latestQueryId);
    }
    let results;
    if (latestQuery &&
      (Date.now() - latestQuery.startDttm) <= LOCALSTORAGE_MAX_QUERY_AGE_MS) {
      results = (
        <ResultSet
          showControls
          search
          query={latestQuery}
          actions={props.actions}
          height={innerTabContentHeight}
          database={this.props.databases[latestQuery.dbId]}
        />
      );
    } else {
      results = <Alert bsStyle="info">{t('Run a query to display results here')}</Alert>;
    }
    const dataPreviewTabs = props.dataPreviewQueries.map(query => (
      <Tab
        title={t('Preview: `%s`', decodeURIComponent(query.tableName))}
        eventKey={query.id}
        key={query.id}
      >
        <ResultSet
          query={query}
          visualize={false}
          csv={false}
          actions={props.actions}
          cache
          height={innerTabContentHeight}
        />
      </Tab>
    ));

    return (
      <div className="SouthPane" ref={this.southPaneRef}>
        <Tabs
          bsStyle="tabs"
          animation={false}
          className="SouthPaneTabs"
          id={shortid.generate()}
          activeKey={this.props.activeSouthPaneTab}
          onSelect={this.switchTab}
        >
          <Tab
            title={t('Results')}
            eventKey="Results"
          >
            {results}
          </Tab>
          <Tab
            title={t('Query History')}
            eventKey="History"
          >
            <QueryHistory queries={props.editorQueries} actions={props.actions} />
          </Tab>
          {dataPreviewTabs}
        </Tabs>
      </div>
    );
  }
}

function mapStateToProps({ sqlLab }) {
  return {
    activeSouthPaneTab: sqlLab.activeSouthPaneTab,
    databases: sqlLab.databases,
    offline: sqlLab.offline,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

SouthPane.propTypes = propTypes;
SouthPane.defaultProps = defaultProps;

export default connect(mapStateToProps, mapDispatchToProps)(SouthPane);

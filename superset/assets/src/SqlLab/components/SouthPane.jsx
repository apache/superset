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
import { STATUS_OPTIONS, STATE_BSSTYLE_MAP } from '../constants';

/*
    editorQueries are queries executed by users passed from SqlEditor component
    dataPrebiewQueries are all queries executed for preview of table data (from SqlEditorLeft)
*/
const propTypes = {
  editorQueries: PropTypes.array.isRequired,
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

class SouthPane extends React.PureComponent {
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
    const innerTabHeight = this.props.height - 55;
    let latestQuery;
    const props = this.props;
    if (props.editorQueries.length > 0) {
      latestQuery = props.editorQueries[props.editorQueries.length - 1];
    }
    let results;
    if (latestQuery) {
      results = (
        <ResultSet
          showControls
          search
          query={latestQuery}
          actions={props.actions}
          height={innerTabHeight}
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
          height={innerTabHeight}
        />
      </Tab>
    ));

    return (
      <div className="SouthPane">
        <Tabs
          bsStyle="tabs"
          id={shortid.generate()}
          activeKey={this.props.activeSouthPaneTab}
          onSelect={this.switchTab.bind(this)}
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
            <div style={{ height: `${innerTabHeight}px`, overflow: 'auto' }}>
              <QueryHistory queries={props.editorQueries} actions={props.actions} />
            </div>
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

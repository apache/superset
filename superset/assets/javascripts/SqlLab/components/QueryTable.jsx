import React from 'react';
import PropTypes from 'prop-types';

import moment from 'moment';
import { Table } from 'reactable';
import { Label, ProgressBar, Well } from 'react-bootstrap';
import Link from './Link';
import VisualizeModal from './VisualizeModal';
import ResultSet from './ResultSet';
import ModalTrigger from '../../components/ModalTrigger';
import HighlightedSql from './HighlightedSql';
import { fDuration } from '../../modules/dates';
import { storeQuery } from '../../../utils/common';
import QueryStateLabel from './QueryStateLabel';
import { t } from '../../locales';

const propTypes = {
  columns: PropTypes.array,
  actions: PropTypes.object,
  queries: PropTypes.array,
  onUserClicked: PropTypes.func,
  onDbClicked: PropTypes.func,
};
const defaultProps = {
  columns: ['started', 'duration', 'rows'],
  queries: [],
  onUserClicked: () => {},
  onDbClicked: () => {},
};


class QueryTable extends React.PureComponent {
  constructor(props) {
    super(props);
    const uri = window.location.toString();
    const cleanUri = uri.substring(0, uri.indexOf('#'));
    this.state = {
      cleanUri,
      showVisualizeModal: false,
      activeQuery: null,
    };
  }
  callback(url) {
    window.open(url);
  }
  openQuery(dbId, schema, sql) {
    const newQuery = {
      dbId,
      title: t('Untitled Query'),
      schema,
      sql,
    };
    storeQuery(newQuery, this.callback);
  }
  hideVisualizeModal() {
    this.setState({ showVisualizeModal: false });
  }
  showVisualizeModal(query) {
    this.setState({ activeQuery: query, showVisualizeModal: true });
  }
  restoreSql(query) {
    this.props.actions.queryEditorSetSql({ id: query.sqlEditorId }, query.sql);
  }

  openQueryInNewTab(query) {
    this.props.actions.cloneQueryToNewTab(query);
  }
  openAsyncResults(query) {
    this.props.actions.fetchQueryResults(query);
  }
  clearQueryResults(query) {
    this.props.actions.clearQueryResults(query);
  }
  removeQuery(query) {
    this.props.actions.removeQuery(query);
  }
  render() {
    const data = this.props.queries.map((query) => {
      const q = Object.assign({}, query);
      if (q.endDttm) {
        q.duration = fDuration(q.startDttm, q.endDttm);
      }
      const time = moment(q.startDttm).format().split('T');
      q.time = (
        <div>
          <span>
            {time[0]} <br /> {time[1]}
          </span>
        </div>
      );
      q.user = (
        <button
          className="btn btn-link btn-xs"
          onClick={this.props.onUserClicked.bind(this, q.userId)}
        >
          {q.user}
        </button>
      );
      q.db = (
        <button
          className="btn btn-link btn-xs"
          onClick={this.props.onDbClicked.bind(this, q.dbId)}
        >
          {q.db}
        </button>
      );
      q.started = moment(q.startDttm).format('HH:mm:ss');
      q.querylink = (
        <div style={{ width: '100px' }}>
          <button
            className="btn btn-link btn-xs"
            onClick={this.openQuery.bind(this, q.dbId, q.schema, q.sql)}
          >
            <i className="fa fa-external-link" />{t('Open in SQL Editor')}
          </button>
        </div>
      );
      q.sql = (
        <Well>
          <HighlightedSql sql={q.sql} rawSql={q.executedSql} shrink maxWidth={60} />
        </Well>
      );
      if (q.resultsKey) {
        q.output = (
          <ModalTrigger
            bsSize="large"
            className="ResultsModal"
            triggerNode={(
              <Label
                bsStyle="info"
                style={{ cursor: 'pointer' }}
              >
                {t('view results')}
              </Label>
            )}
            modalTitle={t('Data preview')}
            beforeOpen={this.openAsyncResults.bind(this, query)}
            onExit={this.clearQueryResults.bind(this, query)}
            modalBody={
              <ResultSet showSql query={query} actions={this.props.actions} height={400} />
            }
          />
        );
      } else {
        // if query was run using ctas and force_ctas_schema was set
        // tempTable will have the schema
        const schemaUsed = q.ctas && q.tempTable && q.tempTable.includes('.') ? '' : q.schema;
        q.output = [schemaUsed, q.tempTable].filter(v => (v)).join('.');
      }
      q.progress = (
        <ProgressBar
          style={{ width: '75px' }}
          striped
          now={q.progress}
          label={`${q.progress}%`}
        />
      );
      let errorTooltip;
      if (q.errorMessage) {
        errorTooltip = (
          <Link tooltip={q.errorMessage}>
            <i className="fa fa-exclamation-circle text-danger" />
          </Link>
        );
      }
      q.state = (
        <div>
          <QueryStateLabel query={query} />
          {errorTooltip}
        </div>
      );
      q.actions = (
        <div style={{ width: '75px' }}>
          <Link
            className="fa fa-line-chart m-r-3"
            tooltip={t('Visualize the data out of this query')}
            onClick={this.showVisualizeModal.bind(this, query)}
          />
          <Link
            className="fa fa-pencil m-r-3"
            onClick={this.restoreSql.bind(this, query)}
            tooltip={t('Overwrite text in editor with a query on this table')}
            placement="top"
          />
          <Link
            className="fa fa-plus-circle m-r-3"
            onClick={this.openQueryInNewTab.bind(this, query)}
            tooltip={t('Run query in a new tab')}
            placement="top"
          />
          <Link
            className="fa fa-trash m-r-3"
            tooltip={t('Remove query from log')}
            onClick={this.removeQuery.bind(this, query)}
          />
        </div>
      );
      return q;
    }).reverse();
    return (
      <div className="QueryTable">
        <VisualizeModal
          show={this.state.showVisualizeModal}
          query={this.state.activeQuery}
          onHide={this.hideVisualizeModal.bind(this)}
        />
        <Table
          columns={this.props.columns}
          className="table table-condensed"
          data={data}
          itemsPerPage={50}
        />
      </div>
    );
  }
}
QueryTable.propTypes = propTypes;
QueryTable.defaultProps = defaultProps;

export default QueryTable;

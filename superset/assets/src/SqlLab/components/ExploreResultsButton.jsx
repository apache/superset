import moment from 'moment';
import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Alert } from 'react-bootstrap';
import Dialog from 'react-bootstrap-dialog';

import shortid from 'shortid';
import { exportChart } from '../../explore/exploreUtils';
import * as actions from '../actions';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';
import { t } from '../../locales';
import Button from '../../components/Button';

const propTypes = {
  actions: PropTypes.object.isRequired,
  query: PropTypes.object,
  errorMessage: PropTypes.string,
  timeout: PropTypes.number,
  database: PropTypes.object.isRequired,
};
const defaultProps = {
  query: {},
};

class ExploreResultsButton extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      hints: [],
    };
    this.visualize = this.visualize.bind(this);
    this.onClick = this.onClick.bind(this);
    this.getInvalidColumns = this.getInvalidColumns.bind(this);
    this.renderInvalidColumnMessage = this.renderInvalidColumnMessage.bind(this);
  }
  onClick() {
    const timeout = this.props.timeout;
    const msg = this.renderInvalidColumnMessage();
    if (Math.round(this.getQueryDuration()) > timeout) {
      this.dialog.show({
        title: t('Explore'),
        body: this.renderTimeoutWarning(),
        actions: [
          Dialog.CancelAction(),
          Dialog.OKAction(() => {
            this.visualize();
          }),
        ],
        bsSize: 'large',
        onHide: (dialog) => {
          dialog.hide();
        },
      });
    } else if (msg) {
      this.dialog.show({
        title: t('Explore'),
        body: msg,
        actions: [
          Dialog.DefaultAction('Ok', () => {}, 'btn-danger'),
        ],
        bsSize: 'large',
        bsStyle: 'warning',
        onHide: (dialog) => {
          dialog.hide();
        },
      });
    } else {
      this.visualize();
    }
  }
  getColumns() {
    const props = this.props;
    if (props.query && props.query.results && props.query.results.columns) {
      return props.query.results.columns;
    }
    return [];
  }
  getQueryDuration() {
    return moment.duration(this.props.query.endDttm - this.props.query.startDttm).asSeconds();
  }
  getInvalidColumns() {
    const re = /^[A-Za-z_]\w*$/;
    return this.props.query.results.columns.map(col => col.name).filter(col => !re.test(col));
  }
  datasourceName() {
    const { query } = this.props;
    const uniqueId = shortid.generate();
    let datasourceName = uniqueId;
    if (query) {
      datasourceName = query.user ? `${query.user}-` : '';
      datasourceName += `${query.tab}-${uniqueId}`;
    }
    return datasourceName;
  }
  buildVizOptions() {
    const { schema, sql, dbId, templateParams } = this.props.query;
    return {
      dbId,
      schema,
      sql,
      templateParams,
      datasourceName: this.datasourceName(),
      columns: this.getColumns(),
    };
  }
  visualize() {
    this.props.actions.createDatasource(this.buildVizOptions(), this)
      .done((resp) => {
        const columns = this.getColumns();
        const data = JSON.parse(resp);
        const formData = {
          datasource: `${data.table_id}__table`,
          metrics: [],
          groupby: [],
          viz_type: 'table',
          since: '100 years ago',
          all_columns: columns.map(c => c.name),
          row_limit: 1000,
        };
        this.props.actions.addInfoToast(t('Creating a data source and creating a new tab'));

        // open new window for data visualization
        exportChart(formData);
      })
      .fail(() => {
        this.props.actions.addDangerToast(this.props.errorMessage);
      });
  }
  renderTimeoutWarning() {
    return (
      <Alert bsStyle="warning">
        {
          t('This query took %s seconds to run, ', Math.round(this.getQueryDuration())) +
          t('and the explore view times out at %s seconds ', this.props.timeout) +
          t('following this flow will most likely lead to your query timing out. ') +
          t('We recommend your summarize your data further before following that flow. ') +
          t('If activated you can use the ')
        }
        <strong>CREATE TABLE AS </strong>
        {t('feature to store a summarized data set that you can then explore.')}
      </Alert>);
  }
  renderInvalidColumnMessage() {
    const invalidColumns = this.getInvalidColumns();
    if (invalidColumns.length === 0) {
      return null;
    }
    return (
      <div>
        {t('Column name(s) ')}
        <code><strong>{invalidColumns.join(', ')} </strong></code>
        {t('cannot be used as a column name. Please use aliases (as in ')}
        <code>SELECT count(*)
          <strong>AS my_alias</strong>
        </code>){' '}
        {t('limited to alphanumeric characters and underscores')}
      </div>);
  }
  render() {
    return (
      <Button
        bsSize="small"
        onClick={this.onClick}
        disabled={!this.props.database.allows_subquery}
        tooltip={t('Explore the result set in the data exploration view')}
      >
        <Dialog
          ref={(el) => {
            this.dialog = el;
          }}
        />
        <InfoTooltipWithTrigger
          icon="line-chart"
          placement="top"
          label="explore"
        /> {t('Explore')}
      </Button>);
  }
}
ExploreResultsButton.propTypes = propTypes;
ExploreResultsButton.defaultProps = defaultProps;

function mapStateToProps({ sqlLab }) {
  return {
    errorMessage: sqlLab.errorMessage,
    timeout: sqlLab.common ? sqlLab.common.conf.SUPERSET_WEBSERVER_TIMEOUT : null,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { ExploreResultsButton };
export default connect(mapStateToProps, mapDispatchToProps)(ExploreResultsButton);

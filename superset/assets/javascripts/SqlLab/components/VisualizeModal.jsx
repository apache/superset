/* global notify */
import moment from 'moment';
import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Alert, Button, Col, Modal } from 'react-bootstrap';

import Select from 'react-select';
import { Table } from 'reactable';
import shortid from 'shortid';
import { getExploreUrl } from '../../explore/exploreUtils';
import * as actions from '../actions';
import { VISUALIZE_VALIDATION_ERRORS } from '../constants';
import visTypes from '../../explore/stores/visTypes';
import { t } from '../../locales';

const CHART_TYPES = Object.keys(visTypes)
  .filter(typeName => !!visTypes[typeName].showOnExplore)
  .map((typeName) => {
    const vis = visTypes[typeName];
    return {
      value: typeName,
      label: vis.label,
      requiresTime: !!vis.requiresTime,
    };
  });

const propTypes = {
  actions: PropTypes.object.isRequired,
  onHide: PropTypes.func,
  query: PropTypes.object,
  show: PropTypes.bool,
  datasource: PropTypes.string,
  errorMessage: PropTypes.string,
  timeout: PropTypes.number,
};
const defaultProps = {
  show: false,
  query: {},
  onHide: () => {},
};

class VisualizeModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      chartType: CHART_TYPES[0],
      datasourceName: this.datasourceName(),
      columns: this.getColumnFromProps(),
      hints: [],
    };
  }
  componentDidMount() {
    this.validate();
  }
  getColumnFromProps() {
    const props = this.props;
    if (!props ||
        !props.query ||
        !props.query.results ||
        !props.query.results.columns) {
      return {};
    }
    const columns = {};
    props.query.results.columns.forEach((col) => {
      columns[col.name] = col;
    });
    return columns;
  }
  datasourceName() {
    const { query } = this.props;
    const uniqueId = shortid.generate();
    let datasourceName = uniqueId;
    if (query) {
      datasourceName = query.user ? `${query.user}-` : '';
      datasourceName += query.db ? `${query.db}-` : '';
      datasourceName += `${query.tab}-${uniqueId}`;
    }
    return datasourceName;
  }
  validate() {
    const hints = [];
    const cols = this.mergedColumns();
    const re = /^\w+$/;
    Object.keys(cols).forEach((colName) => {
      if (!re.test(colName)) {
        hints.push(
          <div>
            {t('%s is not right as a column name, please alias it ' +
            '(as in SELECT count(*) ', colName)} <strong>{t('AS my_alias')}</strong>) {t('using only ' +
            'alphanumeric characters and underscores')}
          </div>);
      }
    });
    if (this.state.chartType === null) {
      hints.push(VISUALIZE_VALIDATION_ERRORS.REQUIRE_CHART_TYPE);
    } else if (this.state.chartType.requiresTime) {
      let hasTime = false;
      for (const colName in cols) {
        const col = cols[colName];
        if (col.hasOwnProperty('is_date') && col.is_date) {
          hasTime = true;
        }
      }
      if (!hasTime) {
        hints.push(VISUALIZE_VALIDATION_ERRORS.REQUIRE_TIME);
      }
    }
    this.setState({ hints });
  }
  changeChartType(option) {
    this.setState({ chartType: option }, this.validate);
  }
  mergedColumns() {
    const columns = Object.assign({}, this.state.columns);
    if (this.props.query && this.props.query.results.columns) {
      this.props.query.results.columns.forEach((col) => {
        if (columns[col.name] === undefined) {
          columns[col.name] = col;
        }
      });
    }
    return columns;
  }
  buildVizOptions() {
    return {
      chartType: this.state.chartType.value,
      datasourceName: this.state.datasourceName,
      columns: this.state.columns,
      sql: this.props.query.sql,
      dbId: this.props.query.dbId,
    };
  }
  buildVisualizeAdvise() {
    let advise;
    const timeout = this.props.timeout;
    const queryDuration = moment.duration(this.props.query.endDttm - this.props.query.startDttm);
    if (Math.round(queryDuration.asMilliseconds()) > timeout * 1000) {
      advise = (
        <Alert bsStyle="warning">
          This query took {Math.round(queryDuration.asSeconds())} seconds to run,
          and the explore view times out at {timeout} seconds,
          following this flow will most likely lead to your query timing out.
          We recommend your summarize your data further before following that flow.
          If activated you can use the <strong>CREATE TABLE AS</strong> feature
          to store a summarized data set that you can then explore.
        </Alert>);
    }
    return advise;
  }
  visualize() {
    this.props.actions.createDatasource(this.buildVizOptions(), this)
      .done((resp) => {
        const columns = Object.keys(this.state.columns).map(k => this.state.columns[k]);
        const data = JSON.parse(resp);
        const mainGroupBy = columns.filter(d => d.is_dim)[0];
        const formData = {
          datasource: `${data.table_id}__table`,
          viz_type: this.state.chartType.value,
          since: '100 years ago',
          limit: '0',
        };
        if (mainGroupBy) {
          formData.groupby = [mainGroupBy.name];
        }
        notify.info(t('Creating a data source and popping a new tab'));

        window.open(getExploreUrl(formData));
      })
      .fail(() => {
        notify.error(this.props.errorMessage);
      });
  }
  changeDatasourceName(event) {
    this.setState({ datasourceName: event.target.value }, this.validate);
  }
  changeCheckbox(attr, columnName, event) {
    let columns = this.mergedColumns();
    const column = Object.assign({}, columns[columnName], { [attr]: event.target.checked });
    columns = Object.assign({}, columns, { [columnName]: column });
    this.setState({ columns }, this.validate);
  }
  changeAggFunction(columnName, option) {
    let columns = this.mergedColumns();
    const val = (option) ? option.value : null;
    const column = Object.assign({}, columns[columnName], { agg: val });
    columns = Object.assign({}, columns, { [columnName]: column });
    this.setState({ columns }, this.validate);
  }
  render() {
    if (!(this.props.query) || !(this.props.query.results) || !(this.props.query.results.columns)) {
      return (
        <div className="VisualizeModal">
          <Modal show={this.props.show} onHide={this.props.onHide}>
            <Modal.Body>
              {t('No results available for this query')}
            </Modal.Body>
          </Modal>
        </div>
      );
    }
    const tableData = this.props.query.results.columns.map(col => ({
      column: col.name,
      is_dimension: (
        <input
          type="checkbox"
          onChange={this.changeCheckbox.bind(this, 'is_dim', col.name)}
          checked={(this.state.columns[col.name]) ? this.state.columns[col.name].is_dim : false}
          className="form-control"
        />
      ),
      is_date: (
        <input
          type="checkbox"
          className="form-control"
          onChange={this.changeCheckbox.bind(this, 'is_date', col.name)}
          checked={(this.state.columns[col.name]) ? this.state.columns[col.name].is_date : false}
        />
      ),
      agg_func: (
        <Select
          options={[
            { value: 'sum', label: 'SUM(x)' },
            { value: 'min', label: 'MIN(x)' },
            { value: 'max', label: 'MAX(x)' },
            { value: 'avg', label: 'AVG(x)' },
            { value: 'count_distinct', label: 'COUNT(DISTINCT x)' },
          ]}
          onChange={this.changeAggFunction.bind(this, col.name)}
          value={(this.state.columns[col.name]) ? this.state.columns[col.name].agg : null}
        />
      ),
    }));
    const alerts = this.state.hints.map((hint, i) => (
      <Alert bsStyle="warning" key={i}>{hint}</Alert>
    ));
    const modal = (
      <div className="VisualizeModal">
        <Modal show={this.props.show} onHide={this.props.onHide}>
          <Modal.Header closeButton>
            <Modal.Title>{t('Visualize')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {alerts}
            {this.buildVisualizeAdvise()}
            <div className="row">
              <Col md={6}>
                {t('Chart Type')}
                <Select
                  name="select-chart-type"
                  placeholder={t('[Chart Type]')}
                  options={CHART_TYPES}
                  value={(this.state.chartType) ? this.state.chartType.value : null}
                  autosize={false}
                  onChange={this.changeChartType.bind(this)}
                />
              </Col>
              <Col md={6}>
                {t('Datasource Name')}
                <input
                  type="text"
                  className="form-control input-sm"
                  placeholder={t('datasource name')}
                  onChange={this.changeDatasourceName.bind(this)}
                  value={this.state.datasourceName}
                />
              </Col>
            </div>
            <hr />
            <Table
              className="table table-condensed"
              columns={['column', 'is_dimension', 'is_date', 'agg_func']}
              data={tableData}
            />
            <Button
              onClick={this.visualize.bind(this)}
              bsStyle="primary"
              disabled={(this.state.hints.length > 0)}
            >
              {t('Visualize')}
            </Button>
          </Modal.Body>
        </Modal>
      </div>
    );
    return modal;
  }
}
VisualizeModal.propTypes = propTypes;
VisualizeModal.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    datasource: state.datasource,
    errorMessage: state.errorMessage,
    timeout: state.common ? state.common.SUPERSET_WEBSERVER_TIMEOUT : null,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { VisualizeModal };
export default connect(mapStateToProps, mapDispatchToProps)(VisualizeModal);

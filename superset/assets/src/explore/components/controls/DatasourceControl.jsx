/* eslint no-undef: 2 */
import React from 'react';
import PropTypes from 'prop-types';
import {
  Col,
  Collapse,
  Label,
  OverlayTrigger,
  Row,
  Tooltip,
  Well,
} from 'react-bootstrap';
import $ from 'jquery';

import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';
import DatasourceModal from '../../../datasource/DatasourceModal';
import ColumnOption from '../../../components/ColumnOption';
import MetricOption from '../../../components/MetricOption';
import withToasts from '../../../messageToasts/enhancers/withToasts';


const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.string.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  datasource: PropTypes.object.isRequired,
  onDatasourceSave: PropTypes.func,
};

const defaultProps = {
  onChange: () => {},
  onDatasourceSave: () => {},
};

class DatasourceControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showEditDatasourceModal: false,
      filter: '',
      loading: true,
      showDatasource: false,
    };
    this.toggleShowDatasource = this.toggleShowDatasource.bind(this);
    this.toggleEditDatasourceModal = this.toggleEditDatasourceModal.bind(this);
    this.setSearchRef = this.setSearchRef.bind(this);
    this.selectDatasource = this.selectDatasource.bind(this);
  }
  onChange(vizType) {
    this.props.onChange(vizType);
    this.setState({ showModal: false });
  }
  onEnterModal() {
    if (this.searchRef) {
      this.searchRef.focus();
    }
    const url = '/superset/datasources/';
    const that = this;
    if (!this.state.datasources) {
      $.ajax({
        type: 'GET',
        url,
        success: (data) => {
          const datasources = data.map(ds => ({
            rawName: ds.name,
            connection: ds.connection,
            schema: ds.schema,
            name: (
              <a
                href="#"
                onClick={this.selectDatasource.bind(this, ds.uid)}
                className="datasource-link"
              >
                {ds.name}
              </a>
            ),
            type: ds.type,
          }));

          that.setState({ loading: false, datasources });
        },
        error() {
          that.setState({ loading: false });
          this.props.addDangerToast(t('Something went wrong while fetching the datasource list'));
        },
      });
    }
  }
  setSearchRef(searchRef) {
    this.searchRef = searchRef;
  }
  toggleShowDatasource() {
    this.setState({ showDatasource: !this.state.showDatasource });
  }
  toggleModal() {
    this.setState({ showModal: !this.state.showModal });
  }
  changeSearch(event) {
    this.setState({ filter: event.target.value });
  }
  selectDatasource(datasourceId) {
    this.setState({ showModal: false });
    this.props.onChange(datasourceId);
  }
  toggleEditDatasourceModal() {
    this.setState({ showEditDatasourceModal: !this.state.showEditDatasourceModal });
  }
  renderModal() {
  }
  renderDatasource() {
    const datasource = this.props.datasource;
    return (
      <div className="m-t-10">
        <Well className="m-t-0">
          <div className="m-b-10">
            <Label>
              <i className="fa fa-database" /> {datasource.database.backend}
            </Label>
            {` ${datasource.database.name} `}
          </div>
          <Row className="datasource-container">
            <Col md={6}>
              <strong>Columns</strong>
              {datasource.columns.map(col => (
                <div key={col.column_name}>
                  <ColumnOption showType column={col} />
                </div>
              ))}
            </Col>
            <Col md={6}>
              <strong>Metrics</strong>
              {datasource.metrics.map(m => (
                <div key={m.metric_name}>
                  <MetricOption metric={m} showType />
                </div>
              ))}
            </Col>
          </Row>
        </Well>
      </div>
    );
  }
  render() {
    return (
      <div>
        <ControlHeader {...this.props} />
        <OverlayTrigger
          placement="right"
          overlay={
            <Tooltip id={'error-tooltip'}>{t('Click to point to another datasource')}</Tooltip>
          }
        >
          <Label onClick={this.toggleEditDatasourceModal} style={{ cursor: 'pointer' }} className="m-r-5">
            {this.props.datasource.name}
          </Label>
        </OverlayTrigger>
        <OverlayTrigger
          placement="right"
          overlay={
            <Tooltip id={'toggle-datasource-tooltip'}>
              {t('Expand/collapse datasource configuration')}
            </Tooltip>
          }
        >
          <a href="#">
            <i
              className={`fa fa-${this.state.showDatasource ? 'minus' : 'plus'}-square m-r-5`}
              onClick={this.toggleShowDatasource}
            />
          </a>
        </OverlayTrigger>
        {this.props.datasource.type === 'table' &&
          <OverlayTrigger
            placement="right"
            overlay={
              <Tooltip id={'datasource-sqllab'}>
                {t('Run SQL queries against this datasource')}
              </Tooltip>
            }
          >
            <a href={'/superset/sqllab?datasourceKey=' + this.props.value}>
              <i className="fa fa-flask m-r-5" />
            </a>
          </OverlayTrigger>}
        <Collapse in={this.state.showDatasource}>{this.renderDatasource()}</Collapse>
        <DatasourceModal
          datasource={this.props.datasource}
          show={this.state.showEditDatasourceModal}
          onDatasourceSave={this.props.onDatasourceSave}
          onHide={this.toggleEditDatasourceModal}
        />
      </div>
    );
  }
}

DatasourceControl.propTypes = propTypes;
DatasourceControl.defaultProps = defaultProps;

export default withToasts(DatasourceControl);

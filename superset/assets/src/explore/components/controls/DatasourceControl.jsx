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

import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';
import DatasourceModal from '../../../datasource/DatasourceModal';
import ColumnOption from '../../../components/ColumnOption';
import MetricOption from '../../../components/MetricOption';

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.string.isRequired,
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
      loading: true,
      showDatasource: false,
      datasources: null,
    };
    this.toggleShowDatasource = this.toggleShowDatasource.bind(this);
    this.toggleEditDatasourceModal = this.toggleEditDatasourceModal.bind(this);
  }

  onChange(vizType) {
    this.props.onChange(vizType);
    this.setState({ showModal: false });
  }

  toggleShowDatasource() {
    this.setState(({ showDatasource }) => ({ showDatasource: !showDatasource }));
  }

  toggleModal() {
    this.setState(({ showModal }) => ({ showModal: !showModal }));
  }
  toggleEditDatasourceModal() {
    this.setState(({ showEditDatasourceModal }) => ({
      showEditDatasourceModal: !showEditDatasourceModal,
    }));
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
            <Tooltip id={'error-tooltip'}>{t('Click to edit the datasource')}</Tooltip>
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

export default DatasourceControl;

/* eslint no-undef: 2 */
import React from 'react';
import PropTypes from 'prop-types';
import { Table } from 'reactable';
import {
  Row,
  Col,
  Collapse,
  Label,
  FormControl,
  Modal,
  OverlayTrigger,
  Tooltip,
  Well,
} from 'react-bootstrap';
import $ from 'jquery';

import ControlHeader from '../ControlHeader';
import Loading from '../../../components/Loading';
import { t } from '../../../locales';
import ColumnOption from '../../../components/ColumnOption';
import MetricOption from '../../../components/MetricOption';
import withToasts from '../../../messageToasts/enhancers/withToasts';


const propTypes = {
  description: PropTypes.string,
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.string.isRequired,
  datasource: PropTypes.object,
  addDangerToast: PropTypes.func.isRequired,
};

const defaultProps = {
  onChange: () => {},
};

class DatasourceControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showModal: false,
      filter: '',
      loading: true,
      showDatasource: false,
    };
    this.toggleShowDatasource = this.toggleShowDatasource.bind(this);
    this.onChange = this.onChange.bind(this);
    this.onEnterModal = this.onEnterModal.bind(this);
    this.toggleModal = this.toggleModal.bind(this);
    this.changeSearch = this.changeSearch.bind(this);
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
  renderModal() {
    return (
      <Modal
        show={this.state.showModal}
        onHide={this.toggleModal}
        onEnter={this.onEnterModal}
        onExit={this.setSearchRef}
        bsSize="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>{t('Select a datasource')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div>
            <FormControl
              id="formControlsText"
              inputRef={(ref) => {
                this.setSearchRef(ref);
              }}
              type="text"
              bsSize="sm"
              value={this.state.filter}
              placeholder={t('Search / Filter')}
              onChange={this.changeSearch}
            />
          </div>
          {this.state.loading && <Loading />}
          {this.state.datasources && (
            <Table
              columns={['name', 'type', 'schema', 'connection', 'creator']}
              className="table table-condensed"
              data={this.state.datasources}
              itemsPerPage={20}
              filterable={['rawName', 'type', 'connection', 'schema', 'creator']}
              filterBy={this.state.filter}
              hideFilterInput
            />
          )}
        </Modal.Body>
      </Modal>
    );
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
          <Label onClick={this.toggleModal} style={{ cursor: 'pointer' }} className="m-r-5">
            {this.props.datasource.name}
          </Label>
        </OverlayTrigger>
        <OverlayTrigger
          placement="right"
          overlay={
            <Tooltip id={'edit-datasource-tooltip'}>
              {t("Edit the datasource's configuration")}
            </Tooltip>
          }
        >
          <a href={this.props.datasource.edit_url}>
            <i className="fa fa-edit m-r-5" />
          </a>
        </OverlayTrigger>
        <OverlayTrigger
          placement="right"
          overlay={
            <Tooltip id={'toggle-datasource-tooltip'}>{t('Show datasource configuration')}</Tooltip>
          }
        >
          <a href="#">
            <i
              className={`fa fa-${this.state.showDatasource ? 'minus' : 'plus'}-square m-r-5`}
              onClick={this.toggleShowDatasource}
            />
          </a>
        </OverlayTrigger>
        <Collapse in={this.state.showDatasource}>{this.renderDatasource()}</Collapse>
        {this.renderModal()}
      </div>
    );
  }
}

DatasourceControl.propTypes = propTypes;
DatasourceControl.defaultProps = defaultProps;

export default withToasts(DatasourceControl);

/* global notify */
import React from 'react';
import PropTypes from 'prop-types';
import { Table } from 'reactable';
import { Label, FormControl, Modal, OverlayTrigger, Tooltip } from 'react-bootstrap';

import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';

const propTypes = {
  description: PropTypes.string,
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.string.isRequired,
  datasource: PropTypes.object.isRequired,
};

const defaultProps = {
  onChange: () => {},
};

export default class DatasourceControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showModal: false,
      filter: '',
      loading: true,
    };
    this.toggleModal = this.toggleModal.bind(this);
    this.changeSearch = this.changeSearch.bind(this);
    this.setSearchRef = this.setSearchRef.bind(this);
    this.onEnterModal = this.onEnterModal.bind(this);
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
              </a>),
            type: ds.type,
          }));

          that.setState({ loading: false, datasources });
        },
        error() {
          that.setState({ loading: false });
          notify.error(t('Something went wrong while fetching the datasource list'));
        },
      });
    }
  }
  setSearchRef(searchRef) {
    this.searchRef = searchRef;
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
              {t('Edit the datasource\'s configuration')}
            </Tooltip>
          }
        >
          <a href={this.props.datasource.edit_url}>
            <i className="fa fa-edit" />
          </a>
        </OverlayTrigger>
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
                inputRef={(ref) => { this.setSearchRef(ref); }}
                type="text"
                bsSize="sm"
                value={this.state.filter}
                placeholder={t('Search / Filter')}
                onChange={this.changeSearch}
              />
            </div>
            {this.state.loading &&
              <img
                className="loading"
                alt="Loading..."
                src="/static/assets/images/loading.gif"
              />
            }
            {this.state.datasources &&
              <Table
                columns={['name', 'type', 'schema', 'connection', 'creator']}
                className="table table-condensed"
                data={this.state.datasources}
                itemsPerPage={20}
                filterable={['rawName', 'type', 'connection', 'schema', 'creator']}
                filterBy={this.state.filter}
                hideFilterInput
              />
            }
          </Modal.Body>
        </Modal>
      </div>);
  }
}

DatasourceControl.propTypes = propTypes;
DatasourceControl.defaultProps = defaultProps;

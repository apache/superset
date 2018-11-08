import React from 'react';
import PropTypes from 'prop-types';
import {
  Label, Row, Col, FormControl, Modal, OverlayTrigger,
  Tooltip } from 'react-bootstrap';
import { t } from '@superset-ui/translation';

import getChartMetadataRegistry from '../../../visualizations/core/registries/ChartMetadataRegistrySingleton';
import ControlHeader from '../ControlHeader';
import './VizTypeControl.css';

const propTypes = {
  description: PropTypes.string,
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.string.isRequired,
};

const defaultProps = {
  onChange: () => {},
};

export default class VizTypeControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showModal: false,
      filter: '',
    };
    this.toggleModal = this.toggleModal.bind(this);
    this.changeSearch = this.changeSearch.bind(this);
    this.setSearchRef = this.setSearchRef.bind(this);
    this.focusSearch = this.focusSearch.bind(this);
  }
  onChange(vizType) {
    this.props.onChange(vizType);
    this.setState({ showModal: false });
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
  focusSearch() {
    if (this.searchRef) {
      this.searchRef.focus();
    }
  }
  renderItem(entry) {
    const { value } = this.props;
    const { key, value: type } = entry;
    const isSelected = key === value;
    return (
      <div
        className={`viztype-selector-container ${isSelected ? 'selected' : ''}`}
        onClick={this.onChange.bind(this, key)}
      >
        <img
          alt={type.name}
          width="100%"
          className={`viztype-selector ${isSelected ? 'selected' : ''}`}
          src={type.thumbnail}
        />
        <div className="viztype-label">
          {type.name}
        </div>
      </div>);
  }
  render() {
    const { filter, showModal } = this.state;
    const { value } = this.props;

    const registry = getChartMetadataRegistry();

    const types = registry.entries();
    const filteredTypes = filter.length > 0
      ? types.filter(type => type.value.name.toLowerCase().includes(filter))
      : types;

    const selectedType = registry.get(value);

    const imgPerRow = 6;
    const rows = [];
    for (let i = 0; i <= filteredTypes.length; i += imgPerRow) {
      rows.push(
        <Row key={`row-${i}`}>
          {filteredTypes.slice(i, i + imgPerRow).map(entry => (
            <Col md={12 / imgPerRow} key={`grid-col-${entry.key}`}>
              {this.renderItem(entry)}
            </Col>
          ))}
        </Row>);
    }
    return (
      <div>
        <ControlHeader
          {...this.props}
        />
        <OverlayTrigger
          placement="right"
          overlay={
            <Tooltip id={'error-tooltip'}>{t('Click to change visualization type')}</Tooltip>
          }
        >
          <Label onClick={this.toggleModal} style={{ cursor: 'pointer' }}>
            {selectedType.name}
          </Label>
        </OverlayTrigger>
        <Modal
          show={showModal}
          onHide={this.toggleModal}
          onEnter={this.focusSearch}
          onExit={this.setSearchRef}
          bsSize="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>{t('Select a visualization type')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="viztype-control-search-box">
              <FormControl
                inputRef={this.setSearchRef}
                type="text"
                value={filter}
                placeholder={t('Search')}
                onChange={this.changeSearch}
              />
            </div>
            {rows}
          </Modal.Body>
        </Modal>
      </div>
    );
  }
}

VizTypeControl.propTypes = propTypes;
VizTypeControl.defaultProps = defaultProps;

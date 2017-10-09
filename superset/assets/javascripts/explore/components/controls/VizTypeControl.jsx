import React from 'react';
import PropTypes from 'prop-types';
import {
  Label, Row, Col, FormControl, Modal, OverlayTrigger,
  Tooltip } from 'react-bootstrap';
import visTypes from '../../stores/visTypes';
import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';

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
  renderVizType(vizType) {
    const vt = vizType;
    return (
      <div
        className={`viztype-selector-container ${vt === this.props.value ? 'selected' : ''}`}
        onClick={this.onChange.bind(this, vt)}
      >
        <img
          alt={`viz-type-${vt}`}
          width="100%"
          className={`viztype-selector ${this.props.value === vt ? 'selected' : ''}`}
          src={`/static/assets/images/viz_thumbnails/${vt}.png`}
        />
        <div className="viztype-label">
          <strong>{visTypes[vt].label}</strong>
        </div>
      </div>);
  }
  render() {
    const filter = this.state.filter;
    const filteredVizTypes = Object.keys(visTypes)
      .filter(vt => filter.length === 0 || visTypes[vt].label.toLowerCase().includes(filter));

    const imgPerRow = 4;
    const rows = [];
    for (let i = 0; i <= filteredVizTypes.length; i += imgPerRow) {
      rows.push(
        <Row key={`row-${i}`}>
          {filteredVizTypes.slice(i, i + imgPerRow).map(vt => (
            <Col md={3} key={`grid-col-${vt}`}>
              {this.renderVizType(vt)}
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
            <Tooltip id={'error-tooltip'}>Click to change visualization type</Tooltip>
          }
        >
          <Label onClick={this.toggleModal} style={{ cursor: 'pointer' }}>
            {visTypes[this.props.value].label}
          </Label>
        </OverlayTrigger>
        <Modal
          show={this.state.showModal}
          onHide={this.toggleModal}
          onEnter={this.focusSearch}
          onExit={this.setSearchRef}
          bsSize="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>{t('Select a visualization type')}</Modal.Title>
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
            {rows}
          </Modal.Body>
        </Modal>
      </div>);
  }
}

VizTypeControl.propTypes = propTypes;
VizTypeControl.defaultProps = defaultProps;

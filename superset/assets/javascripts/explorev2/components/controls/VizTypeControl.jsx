import React from 'react';
import PropTypes from 'prop-types';
import { Button, Label, FormControl, Modal } from 'react-bootstrap';
import visTypes from '../../stores/visTypes';

const IMG_SIZE = 150;

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
  }
  onChange(vizType) {
    this.props.onChange(vizType);
    this.setState({ showModal: false });
  }
  toggleModal() {
    this.setState({ showModal: !this.state.showModal });
  }
  changeSearch(event) {
    this.setState({ filter: event.target.value });
  }
  render() {
    const filter = this.state.filter;
    return (
      <div>
        <Label>{visTypes[this.props.value].label}</Label>
        <Button onClick={this.toggleModal} bsSize="sm" className="l-m-5">
          <i className="fa fa-line-chart l-m-2" />
          <i className="fa fa-area-chart l-m-2" />
          <i className="fa fa-bar-chart l-m-2" />
          <i className="fa fa-pie-chart l-m-2" />
        </Button>
        <Modal show={this.state.showModal} onHide={this.toggleModal} bsSize="lg">
          <Modal.Header closeButton>
            <Modal.Title>Select a visualization type</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div>
              <FormControl
                id="formControlsText"
                type="text"
                bsSize="sm"
                value={this.state.filter}
                placeholder="Search / Filter"
                onChange={this.changeSearch}
              />
            </div>
            <div className="clearfix">
              {Object.keys(visTypes)
                .filter(vt => (
                  filter.length === 0 || visTypes[vt].label.toLowerCase().includes(filter)))
                .map(vt => (
                  <div
                    className={`viztype-selector-container ${vt === this.props.value ? 'selected' : ''}`}
                    onClick={this.onChange.bind(this, vt)}
                    key={`viztype-img-${vt}`}
                  >
                    <img
                      alt={`viz-type-${vt}`}
                      width={IMG_SIZE}
                      height={IMG_SIZE}
                      className={`viztype-selector ${this.props.value === vt ? 'selected' : ''}`}
                      src={`/static/assets/images/viz_thumbnails/${vt}.png`}
                    />
                    <div className="viztype-label">
                      <Label>{visTypes[vt].label}</Label>
                    </div>
                  </div>))}
            </div>
          </Modal.Body>
        </Modal>
      </div>);
  }
}

VizTypeControl.propTypes = propTypes;
VizTypeControl.defaultProps = defaultProps;

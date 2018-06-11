import React from 'react';
import PropTypes from 'prop-types';
import { Button, Row, Col } from 'react-bootstrap';
import ColorPickerControl from './ColorPickerControl';
import TextControl from './TextControl';
import { t } from '../../../locales';


const propTypes = {
  changeStyleMapping: PropTypes.func,
  removeStyleMapping: PropTypes.func,
  style: PropTypes.object.isRequired,
  valuesLoading: PropTypes.bool,
  valueChoices: PropTypes.array,
};

const defaultProps = {
  changeStyleMapping: () => {},
  removeStyleMapping: () => {},
  style: {},
  valuesLoading: false,
  valueChoices: [],
};

export default class StyleMapping extends React.Component {

  changeValue(event) {
    this.props.changeStyleMapping('val', event);
  }

  changeColor(event) {
    this.props.changeStyleMapping('style', event);
  }

  removeStyleMapping(style) {
    this.props.removeStyleMapping(style);
  }

  render() {
    const style = this.props.style;
    if (!style.style) {
      style.style = {}; // ColorPickerControl likes objects
    }
    return (
      <div>
        <Row className="space-1">
          <Col md={7}>
            <TextControl
              placeholder={t('Field Value')}
              value={style.val}
              onChange={this.changeValue.bind(this)}
            />
          </Col>
          <Col md={3}>
            <ColorPickerControl
              value={style.style}
              onChange={this.changeColor.bind(this)}
            />
          </Col>
          <Col md={2}>
            <Button
              bsSize="small"
              onClick={this.removeStyleMapping.bind(this)}
            >
              <i className="fa fa-minus" />
            </Button>
          </Col>
        </Row>
      </div>
    );
  }
}

StyleMapping.propTypes = propTypes;
StyleMapping.defaultProps = defaultProps;

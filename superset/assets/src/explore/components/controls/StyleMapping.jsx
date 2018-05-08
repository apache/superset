import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import { Button, Row, Col } from 'react-bootstrap';
import ColorPickerControl from './ColorPickerControl';
import TextControl from './TextControl';
import { t } from '../../../locales';


const propTypes = {
  changeStyleMapping: PropTypes.func,
  removeStyleMapping: PropTypes.func,
  style: PropTypes.object.isRequired,
  datasource: PropTypes.object,
  valuesLoading: PropTypes.bool,
  valueChoices: PropTypes.array,
};

const defaultProps = {
  changeStyleMapping: () => {},
  removeStyleMapping: () => {},
  style: {},
  datasource: null,
  valuesLoading: false,
  valueChoices: [],
};

export default class StyleMapping extends React.Component {

  changeValue(event) {
    this.props.changeStyleMapping('val', event.value);
  }

  changeColor(event) {
    this.props.changeStyleMapping('style', event.value);
  }

  removeStyleMapping(style) {
    this.props.removeStyleMapping(style);
  }

  render() {
    const datasource = this.props.datasource;
    const style = this.props.style;
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

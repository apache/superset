import React from 'react';
import PropTypes from 'prop-types';
import { Button, Row, Col } from 'react-bootstrap';
import StyleMapping from './StyleMapping';
import { t } from '../../../locales';

const $ = window.$ = require('jquery');

const propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.array,
  datasource: PropTypes.object,
};

const defaultProps = {
  onChange: () => {},
  value: [],
};

export default class StyleMappingControl extends React.Component {

  constructor(props) {
    super(props);
    const initialStyles = props.value.map(() => ({
      valuesLoading: false,
      valueChoices: [],
    }));
    this.state = {
      styles: initialStyles,
      activeRequest: null,
    };
  }

  componentDidMount() {
    this.state.styles.forEach((style, index) => this.fetchStyleMappingValues(index));
  }

  fetchStyleMappingValues(index, value) {
    const datasource = this.props.datasource;
    const val = value || (this.props.value &&
                          this.props.value[index] &&
                          this.props.value[index].val)
              ? this.props.value[index].val : '';
      if (val && this.props.datasource && this.props.datasource.style_select) {
      this.setState((prevState) => {
        const newStateStyles = Object.assign([], prevState.styles);
        newStateStyles[index].valuesLoading = true;
        return { styles: newStateStyles };
      });
      // if there is an outstanding request to fetch values, cancel it.
      if (this.state.activeRequest) {
        this.state.activeRequest.abort();
      }
      this.setState({
        activeRequest: $.ajax({
          type: 'GET',
          url: `/superset/stylemapping/${datasource.type}/${datasource.id}/${val}/`,
          success: (data) => {
            this.setState((prevState) => {
              const newStateStyles = Object.assign([], prevState.styles);
              newStateStyles[index] = { valuesLoading: false, valueChoices: data };
              return { styles: newStateStyles, activeRequest: null };
            });
          },
        }),
      });
    }
  }

  addStyleMapping() {
    const newStyles = Object.assign([], this.props.value);
    const val = this.props.datasource
             && this.props.datasource.styles
             && this.props.datasource.styles.length > 0 ?
                this.props.datasource.styles[0][0] :
                null;
    newStyles.push({
      val,
      style: {},
    });
    this.props.onChange(newStyles);
    const nextIndex = this.state.styles.length;
    this.setState((prevState) => {
      const newStateStyles = Object.assign([], prevState.styles);
      newStateStyles.push({ valuesLoading: false, valueChoices: [] });
      return { styles: newStateStyles };
    });
    this.fetchStyleMappingValues(nextIndex, val);
  }

  changeStyleMapping(index, control, value) {
    const newStyles = Object.assign([], this.props.value);
    const modifiedStyle = Object.assign({}, newStyles[index]);
    if (typeof control === 'string') {
      modifiedStyle[control] = value;
    } else {
      control.forEach((c, i) => {
        modifiedStyle[c] = value[i];
      });
    }
    newStyles.splice(index, 1, modifiedStyle);
    this.props.onChange(newStyles);
  }

  removeStyleMapping(index) {
    this.props.onChange(this.props.value.filter((s, i) => i !== index));
    this.setState((prevState) => {
      const newStateStyles = Object.assign([], prevState.styles);
      newStateStyles.splice(index, 1);
      return { styles: newStateStyles };
    });
  }

  render() {
    const styles = this.props.value.map((style, i) => (
      <div key={i}>
        <StyleMapping
          style={style}
          datasource={this.props.datasource}
          removeStyleMapping={this.removeStyleMapping.bind(this, i)}
          changeStyleMapping={this.changeStyleMapping.bind(this, i)}
          valuesLoading={this.state.styles[i].valuesLoading}
          valueChoices={this.state.styles[i].valueChoices}
        />
      </div>
    ));
    return (
      <div>
        <Row className="space-1">
          <Col md={7}>Status Column - Value</Col>
          <Col md={3}>Style</Col>
          <Col md={2} />
        </Row>
        {styles}
        <Row className="space-2">
          <Col md={2}>
            <Button
              id="add-button"
              bsSize="sm"
              onClick={this.addStyleMapping.bind(this)}
            >
              <i className="fa fa-plus" /> &nbsp; {t('Add Style Mapping')}
            </Button>
          </Col>
        </Row>
      </div>
    );
  }
}

StyleMappingControl.propTypes = propTypes;
StyleMappingControl.defaultProps = defaultProps;

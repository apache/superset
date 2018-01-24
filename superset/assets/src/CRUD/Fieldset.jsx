import React from 'react';
import PropTypes from 'prop-types';
import { Form } from 'react-bootstrap';

import { recurseReactClone } from './utils';
import Field from './Field';

const propTypes = {
  children: PropTypes.node,
  onChange: PropTypes.func,
  item: PropTypes.object,
  title: PropTypes.node,
  compact: PropTypes.bool,
};
const defaultProps = {
  compact: false,
};

export default class Fieldset extends React.PureComponent {
  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
  }
  onChange(fieldKey, val) {
    return this.props.onChange({
      ...this.props.item,
      [fieldKey]: val,
    });
  }
  render() {
    const { title } = this.props;
    const propExtender = field => ({
      onChange: this.onChange,
      value: this.props.item[field.props.fieldKey],
      compact: this.props.compact,
    });
    return (
      <Form componentClass="fieldset" className="CRUD">
        {title &&
          <legend>{title}</legend>
        }
        {recurseReactClone(this.props.children, Field, propExtender)}
      </Form>
    );
  }
}
Fieldset.propTypes = propTypes;
Fieldset.defaultProps = defaultProps;

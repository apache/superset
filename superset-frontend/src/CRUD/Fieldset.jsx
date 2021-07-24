/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Form } from 'src/components/Form';

import { recurseReactClone } from './utils';
import Field from './Field';

const propTypes = {
  children: PropTypes.node.isRequired,
  onChange: PropTypes.func,
  item: PropTypes.object,
  title: PropTypes.node,
  compact: PropTypes.bool,
};
const defaultProps = {
  compact: false,
  title: null,
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
      <Form componentClass="fieldset" className="CRUD" layout="vertical">
        {title && <legend>{title}</legend>}
        {recurseReactClone(this.props.children, Field, propExtender)}
      </Form>
    );
  }
}
Fieldset.propTypes = propTypes;
Fieldset.defaultProps = defaultProps;

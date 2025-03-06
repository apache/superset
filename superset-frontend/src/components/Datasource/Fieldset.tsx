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
import { ReactNode, PureComponent } from 'react';
import { Form } from 'src/components/Form';

import { recurseReactClone } from './utils';
import Field from './Field';

interface FieldsetProps {
  children: ReactNode;
  onChange: Function;
  item: Record<string, any>;
  title: ReactNode;
  compact: boolean;
}

type fieldKeyType = string | number;

export default class Fieldset extends PureComponent<FieldsetProps> {
  static defaultProps = {
    compact: false,
    title: null,
  };

  constructor(props: FieldsetProps) {
    super(props);
    this.onChange = this.onChange.bind(this);
  }

  onChange(fieldKey: fieldKeyType, val: any) {
    return this.props.onChange({
      ...this.props.item,
      [fieldKey]: val,
    });
  }

  render() {
    const { title } = this.props;
    const propExtender = (field: { props: { fieldKey: fieldKeyType } }) => ({
      onChange: this.onChange,
      value: this.props.item[field.props.fieldKey],
      compact: this.props.compact,
    });
    return (
      <Form className="CRUD" layout="vertical">
        {title && <legend>{title}</legend>}
        {recurseReactClone(this.props.children, Field, propExtender)}
      </Form>
    );
  }
}

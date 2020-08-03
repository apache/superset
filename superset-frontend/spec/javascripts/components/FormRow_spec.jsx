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
import { shallow } from 'enzyme';

import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import { Col, Row } from 'react-bootstrap';
import TextControl from 'src/explore/components/controls/TextControl';
import FormRow from 'src/components/FormRow';

const defaultProps = {
  label: 'Hello',
  tooltip: 'A tooltip',
  control: <TextControl label="test_cbox" />,
};

describe('FormRow', () => {
  let wrapper;

  const getWrapper = (overrideProps = {}) => {
    const props = {
      ...defaultProps,
      ...overrideProps,
    };
    return shallow(<FormRow {...props} />);
  };

  beforeEach(() => {
    wrapper = getWrapper();
  });

  it('renders an InfoTooltipWithTrigger only if needed', () => {
    expect(wrapper.find(InfoTooltipWithTrigger)).toExist();
    wrapper = getWrapper({ tooltip: null });
    expect(wrapper.find(InfoTooltipWithTrigger)).not.toExist();
  });

  it('renders a Row and 2 Cols', () => {
    expect(wrapper.find(Row)).toExist();
    expect(wrapper.find(Col)).toHaveLength(2);
  });
});

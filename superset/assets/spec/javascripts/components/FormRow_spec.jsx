import React from 'react';
import { shallow } from 'enzyme';

import { Col, Row } from 'react-bootstrap';
import TextControl from '../../../src/explore/components/controls/TextControl';
import InfoTooltipWithTrigger from '../../../src/components/InfoTooltipWithTrigger';
import FormRow from '../../../src/components/FormRow';

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
    expect(wrapper.find(InfoTooltipWithTrigger)).toHaveLength(1);
    wrapper = getWrapper({ tooltip: null });
    expect(wrapper.find(InfoTooltipWithTrigger)).toHaveLength(0);
  });

  it('renders a Row and 2 Cols', () => {
    expect(wrapper.find(Row)).toHaveLength(1);
    expect(wrapper.find(Col)).toHaveLength(2);
  });

});

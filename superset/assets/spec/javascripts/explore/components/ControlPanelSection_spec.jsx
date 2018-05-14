import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';
import { Panel } from 'react-bootstrap';

import InfoTooltipWithTrigger from
  '../../../../src/components/InfoTooltipWithTrigger';

import ControlPanelSection from
  '../../../../src/explore/components/ControlPanelSection';

const defaultProps = {
  children: <div>a child element</div>,
};

const optionalProps = {
  label: 'my label',
  description: 'my description',
  tooltip: 'my tooltip',
};

describe('ControlPanelSection', () => {
  let wrapper;
  let props;
  it('is a valid element', () => {
    expect(
      React.isValidElement(<ControlPanelSection {...defaultProps} />),
    ).to.equal(true);
  });

  it('renders a Panel component', () => {
    wrapper = shallow(<ControlPanelSection {...defaultProps} />);
    expect(wrapper.find(Panel)).to.have.length(1);
  });

  describe('with optional props', () => {
    beforeEach(() => {
      props = Object.assign(defaultProps, optionalProps);
      wrapper = shallow(<ControlPanelSection {...props} />);
    });

    it('renders a label if present', () => {
      expect(wrapper.find(Panel).dive().text()).to.contain('my label');
    });

    it('renders a InfoTooltipWithTrigger if label and tooltip is present', () => {
      expect(wrapper.find(Panel).dive().find(InfoTooltipWithTrigger))
        .to.have.length(1);
    });
  });
});

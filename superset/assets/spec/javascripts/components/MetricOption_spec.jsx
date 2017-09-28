import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';

import MetricOption from '../../../javascripts/components/MetricOption';
import InfoTooltipWithTrigger from '../../../javascripts/components/InfoTooltipWithTrigger';

describe('MetricOption', () => {
  const defaultProps = {
    metric: {
      metric_name: 'foo',
      verbose_name: 'Foo',
      expression: 'SUM(foo)',
      description: 'Foo is the greatest metric of all',
      warning_text: 'Be careful when using foo',
    },
  };

  let wrapper;
  let props;
  const factory = o => <MetricOption {...o} />;
  beforeEach(() => {
    wrapper = shallow(factory(defaultProps));
    props = Object.assign({}, defaultProps);
  });
  it('is a valid element', () => {
    expect(React.isValidElement(<MetricOption {...defaultProps} />)).to.equal(true);
  });
  it('shows a label with verbose_name', () => {
    const lbl = wrapper.find('.option-label');
    expect(lbl).to.have.length(1);
    expect(lbl.first().text()).to.equal('Foo');
  });
  it('shows 3 InfoTooltipWithTrigger', () => {
    expect(wrapper.find(InfoTooltipWithTrigger)).to.have.length(3);
  });
  it('shows only 2 InfoTooltipWithTrigger when no descr', () => {
    props.metric.description = null;
    wrapper = shallow(factory(props));
    expect(wrapper.find(InfoTooltipWithTrigger)).to.have.length(2);
  });
  it('shows a label with metric_name when no verbose_name', () => {
    props.metric.verbose_name = null;
    wrapper = shallow(factory(props));
    expect(wrapper.find('.option-label').first().text()).to.equal('foo');
  });
  it('shows only 1 InfoTooltipWithTrigger when no descr and no warning', () => {
    props.metric.warning_text = null;
    wrapper = shallow(factory(props));
    expect(wrapper.find(InfoTooltipWithTrigger)).to.have.length(1);
  });
});

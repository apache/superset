import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';

import ColumnTypeLabel from '../../../../javascripts/components/ColumnTypeLabel';

describe('ColumnOption', () => {
  const defaultProps = {
    type: 'string',
  };

  let wrapper;
  let props;
  const factory = o => <ColumnTypeLabel {...o} />;
  beforeEach(() => {
    wrapper = shallow(factory(defaultProps));
    props = Object.assign({}, defaultProps);
  });
  it('is a valid element', () => {
    expect(React.isValidElement(<ColumnTypeLabel {...defaultProps} />)).to.equal(true);
  });
  it('string type shows ABC icon', () => {
    const lbl = wrapper.find('.type-label');
    expect(lbl).to.have.length(1);
    expect(lbl.first().text()).to.equal('ABC');
  });
  it('int type shows # icon', () => {
    props.type = 'int(164)';
    wrapper = shallow(factory(props));
    const lbl = wrapper.find('.type-label');
    expect(lbl).to.have.length(1);
    expect(lbl.first().text()).to.equal('#');
  });
  it('bool type shows T/F icon', () => {
    props.type = 'BOOL';
    wrapper = shallow(factory(props));
    const lbl = wrapper.find('.type-label');
    expect(lbl).to.have.length(1);
    expect(lbl.first().text()).to.equal('T/F');
  });
  it('expression type shows function icon', () => {
    props.type = 'expression';
    wrapper = shallow(factory(props));
    const lbl = wrapper.find('.type-label');
    expect(lbl).to.have.length(1);
    expect(lbl.first().text()).to.equal('ƒ');
  });
});

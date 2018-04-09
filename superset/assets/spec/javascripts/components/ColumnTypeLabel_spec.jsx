import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';

import ColumnTypeLabel from '../../../javascripts/components/ColumnTypeLabel';

describe('ColumnOption', () => {
  const defaultProps = {
    type: 'string',
  };

  const props = { ...defaultProps };

  function getWrapper(overrides) {
    const wrapper = shallow(<ColumnTypeLabel {...props} {...overrides} />);
    return wrapper;
  }

  it('is a valid element', () => {
    expect(React.isValidElement(<ColumnTypeLabel {...defaultProps} />)).to.equal(true);
  });
  it('string type shows ABC icon', () => {
    const lbl = getWrapper({}).find('.type-label');
    expect(lbl).to.have.length(1);
    expect(lbl.first().text()).to.equal('ABC');
  });
  it('int type shows # icon', () => {
    const lbl = getWrapper({ type: 'int(164)' }).find('.type-label');
    expect(lbl).to.have.length(1);
    expect(lbl.first().text()).to.equal('#');
  });
  it('bool type shows T/F icon', () => {
    const lbl = getWrapper({ type: 'BOOL' }).find('.type-label');
    expect(lbl).to.have.length(1);
    expect(lbl.first().text()).to.equal('T/F');
  });
  it('expression type shows function icon', () => {
    const lbl = getWrapper({ type: 'expression' }).find('.type-label');
    expect(lbl).to.have.length(1);
    expect(lbl.first().text()).to.equal('ƒ');
  });
  it('unknown type shows question mark', () => {
    const lbl = getWrapper({ type: 'unknown' }).find('.type-label');
    expect(lbl).to.have.length(1);
    expect(lbl.first().text()).to.equal('?');
  });
  it('unknown type shows question mark', () => {
    const lbl = getWrapper({ type: 'datetime' }).find('.fa-clock-o');
    expect(lbl).to.have.length(1);
  });
});

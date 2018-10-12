import React from 'react';
import { shallow } from 'enzyme';

import ColumnTypeLabel from '../../../src/components/ColumnTypeLabel';

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
    expect(React.isValidElement(<ColumnTypeLabel {...defaultProps} />)).toBe(true);
  });
  it('string type shows ABC icon', () => {
    const lbl = getWrapper({}).find('.type-label');
    expect(lbl).toHaveLength(1);
    expect(lbl.first().text()).toBe('ABC');
  });
  it('int type shows # icon', () => {
    const lbl = getWrapper({ type: 'int(164)' }).find('.type-label');
    expect(lbl).toHaveLength(1);
    expect(lbl.first().text()).toBe('#');
  });
  it('bool type shows T/F icon', () => {
    const lbl = getWrapper({ type: 'BOOL' }).find('.type-label');
    expect(lbl).toHaveLength(1);
    expect(lbl.first().text()).toBe('T/F');
  });
  it('expression type shows function icon', () => {
    const lbl = getWrapper({ type: 'expression' }).find('.type-label');
    expect(lbl).toHaveLength(1);
    expect(lbl.first().text()).toBe('ƒ');
  });
  it('unknown type shows question mark', () => {
    const lbl = getWrapper({ type: 'unknown' }).find('.type-label');
    expect(lbl).toHaveLength(1);
    expect(lbl.first().text()).toBe('?');
  });
  it('datetime type displays', () => {
    const lbl = getWrapper({ type: 'datetime' }).find('.fa-clock-o');
    expect(lbl).toHaveLength(1);
  });
});

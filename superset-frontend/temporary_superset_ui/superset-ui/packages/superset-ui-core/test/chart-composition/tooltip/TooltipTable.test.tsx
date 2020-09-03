import React from 'react';
import { shallow } from 'enzyme';
import { TooltipTable } from '@superset-ui/core/src';

describe('TooltipTable', () => {
  it('sets className', () => {
    const wrapper = shallow(<TooltipTable className="test-class" />);
    expect(wrapper.render().hasClass('test-class')).toEqual(true);
  });

  it('renders empty table', () => {
    const wrapper = shallow(<TooltipTable />);
    expect(wrapper.find('tbody')).toHaveLength(1);
    expect(wrapper.find('tr')).toHaveLength(0);
  });

  it('renders table with content', () => {
    const wrapper = shallow(
      <TooltipTable
        data={[
          {
            key: 'Cersei',
            keyColumn: 'Cersei',
            keyStyle: { padding: '10' },
            valueColumn: 2,
            valueStyle: { textAlign: 'right' },
          },
          {
            key: 'Jaime',
            keyColumn: 'Jaime',
            keyStyle: { padding: '10' },
            valueColumn: 1,
            valueStyle: { textAlign: 'right' },
          },
          {
            key: 'Tyrion',
            keyStyle: { padding: '10' },
            valueColumn: 2,
          },
        ]}
      />,
    );
    expect(wrapper.find('tbody')).toHaveLength(1);
    expect(wrapper.find('tr')).toHaveLength(3);
    expect(wrapper.find('tr > td').first().text()).toEqual('Cersei');
  });
});

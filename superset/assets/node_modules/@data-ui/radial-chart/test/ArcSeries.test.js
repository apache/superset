import React from 'react';
import { mount } from 'enzyme';
import { Arc } from '@vx/shape';
import { ArcSeries, ArcLabel } from '../src';

describe('<ArcSeries />', () => {
  test('it should be defined', () => {
    expect(ArcSeries).toBeDefined();
  });

  test('it should render an Arc', () => {
    const wrapper = mount(
      <ArcSeries
        pieValue={d => d.value}
        data={[{ value: 10 }, { value: 5 }]}
        label={null}
      />,
    );
    expect(wrapper.find(Arc).length).toBe(1);
  });

  test('it should render an Arc for slices and an Arc for Labels', () => {
    const wrapper = mount(
      <ArcSeries
        pieValue={d => d.value}
        data={[{ value: 10 }, { value: 5 }]}
        label={() => '!!!'}
      />,
    );
    expect(wrapper.find(Arc).length).toBe(2);
  });

  test('it should pass arc objects to the label accessor and use the output of the accessor', () => {
    const wrapper = mount(
      <ArcSeries
        pieValue={d => d.value}
        data={[{ value: 10 }, { value: 5 }]}
        labelComponent={<ArcLabel dx="1.6" />}
        label={arc => arc.data.value}
      />,
    );
    const labels = wrapper.find('text');
    expect(labels.length).toBe(2);
    expect(labels.first().text()).toBe('10');
    expect(labels.last().text()).toBe('5');
  });

  test('it should call onMouseMove({ datum, data, fraction, event }) and onMouseLeave() on trigger', () => {
    const data = [{ value: 10 }, { value: 5 }];
    const onMouseMove = jest.fn();
    const onMouseLeave = jest.fn();

    const wrapper = mount(
      <ArcSeries
        pieValue={d => d.value}
        data={data}
        label={null}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      />,
    );

    const arc = wrapper.find('path').first();
    arc.simulate('mousemove');

    expect(onMouseMove).toHaveBeenCalledTimes(1);
    const args = onMouseMove.mock.calls[0][0];
    expect(args.data).toBe(data);
    expect(args.datum).toBe(data[0]);
    expect(args.fraction - (10 / 15)).toBeLessThan(0.0001);
    expect(args.event).toBeDefined();

    arc.simulate('mouseleave');
    expect(onMouseLeave).toHaveBeenCalledTimes(1);
  });
});

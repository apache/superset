import PropTypes from 'prop-types';
import React from 'react';
import { mount } from 'enzyme';
import reactify, { RenderFuncType } from '@superset-ui/core/src/chart/components/reactify';

describe('reactify(renderFn)', () => {
  const renderFn: RenderFuncType<{ content?: string }> = jest.fn((element, props) => {
    const container = element;
    container.innerHTML = '';
    const child = document.createElement('b');
    child.innerHTML = props.content ?? '';
    container.append(child);
  });

  renderFn.displayName = 'BoldText';

  renderFn.propTypes = {
    content: PropTypes.string,
  };

  renderFn.defaultProps = {
    content: 'ghi',
  };

  const willUnmountCb = jest.fn();

  const TheChart = reactify(renderFn);
  const TheChartWithWillUnmountHook = reactify(renderFn, { componentWillUnmount: willUnmountCb });

  class TestComponent extends React.PureComponent<{}, { content: string }> {
    constructor(props = {}) {
      super(props);
      this.state = { content: 'abc' };
    }

    componentDidMount() {
      setTimeout(() => {
        this.setState({ content: 'def' });
      }, 10);
    }

    render() {
      const { content } = this.state;

      return <TheChart id="test" content={content} />;
    }
  }

  class AnotherTestComponent extends React.PureComponent<{}, {}> {
    render() {
      return <TheChartWithWillUnmountHook id="another_test" />;
    }
  }

  it('returns a React component class', () =>
    new Promise(done => {
      const wrapper = mount(<TestComponent />);

      expect(renderFn).toHaveBeenCalledTimes(1);
      expect(wrapper.html()).toEqual('<div id="test"><b>abc</b></div>');
      setTimeout(() => {
        expect(renderFn).toHaveBeenCalledTimes(2);
        expect(wrapper.html()).toEqual('<div id="test"><b>def</b></div>');
        wrapper.unmount();
        done();
      }, 20);
    }));
  describe('displayName', () => {
    it('has displayName if renderFn.displayName is defined', () => {
      expect(TheChart.displayName).toEqual('BoldText');
    });
    it('does not have displayName if renderFn.displayName is not defined', () => {
      const AnotherChart = reactify(() => {});
      expect(AnotherChart.displayName).toBeUndefined();
    });
  });
  describe('propTypes', () => {
    it('has propTypes if renderFn.propTypes is defined', () => {
      /* eslint-disable-next-line react/forbid-foreign-prop-types */
      expect(Object.keys(TheChart.propTypes ?? {})).toEqual(['id', 'className', 'content']);
    });
    it('does not have propTypes if renderFn.propTypes is not defined', () => {
      const AnotherChart = reactify(() => {});
      /* eslint-disable-next-line react/forbid-foreign-prop-types */
      expect(Object.keys(AnotherChart.propTypes ?? {})).toEqual(['id', 'className']);
    });
  });
  describe('defaultProps', () => {
    it('has defaultProps if renderFn.defaultProps is defined', () => {
      expect(TheChart.defaultProps).toBe(renderFn.defaultProps);
      const wrapper = mount(<TheChart id="test" />);
      expect(wrapper.html()).toEqual('<div id="test"><b>ghi</b></div>');
    });
    it('does not have defaultProps if renderFn.defaultProps is not defined', () => {
      const AnotherChart = reactify(() => {});
      expect(AnotherChart.defaultProps).toBeUndefined();
    });
  });
  it('does not try to render if not mounted', () => {
    const anotherRenderFn = jest.fn();
    const AnotherChart = reactify(anotherRenderFn); // enables valid new AnotherChart() call
    // @ts-ignore
    new AnotherChart({ id: 'test' }).execute();
    expect(anotherRenderFn).not.toHaveBeenCalled();
  });
  it('calls willUnmount hook when it is provided', () =>
    new Promise(done => {
      const wrapper = mount(<AnotherTestComponent />);
      setTimeout(() => {
        wrapper.unmount();
        expect(willUnmountCb).toHaveBeenCalledTimes(1);
        done();
      }, 20);
    }));
});

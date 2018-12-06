import PropTypes from 'prop-types';
import React from 'react';
import { mount } from 'enzyme';
import { reactify } from '../../src';

describe('reactify(renderFn)', () => {
  const renderFn = jest.fn((element, props) => {
    const container = element;
    container.innerHTML = '';
    const child = document.createElement('b');
    child.innerHTML = props.content;
    container.appendChild(child);
  });

  renderFn.displayName = 'BoldText';
  renderFn.propTypes = {
    content: PropTypes.string,
  };
  renderFn.defaultProps = {
    content: 'ghi',
  };

  const TheChart = reactify(renderFn);

  class TestComponent extends React.PureComponent {
    constructor(props) {
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

      return <TheChart content={content} />;
    }
  }

  it('returns a React component class', done => {
    const wrapper = mount(<TestComponent />);
    expect(renderFn).toHaveBeenCalledTimes(1);
    expect(wrapper.html()).toEqual('<div><b>abc</b></div>');
    setTimeout(() => {
      expect(renderFn).toHaveBeenCalledTimes(2);
      expect(wrapper.html()).toEqual('<div><b>def</b></div>');
      wrapper.unmount();
      done();
    }, 20);
  });
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
      expect(TheChart.propTypes).toBe(renderFn.propTypes);
    });
    it('does not have propTypes if renderFn.propTypes is not defined', () => {
      const AnotherChart = reactify(() => {});
      /* eslint-disable-next-line react/forbid-foreign-prop-types */
      expect(AnotherChart.propTypes).toBeUndefined();
    });
  });
  describe('defaultProps', () => {
    it('has defaultProps if renderFn.defaultProps is defined', () => {
      expect(TheChart.defaultProps).toBe(renderFn.defaultProps);
      const wrapper = mount(<TheChart />);
      expect(wrapper.html()).toEqual('<div><b>ghi</b></div>');
    });
    it('does not have defaultProps if renderFn.defaultProps is not defined', () => {
      const AnotherChart = reactify(() => {});
      expect(AnotherChart.defaultProps).toBeUndefined();
    });
  });
  it('does not try to render if not mounted', () => {
    const anotherRenderFn = jest.fn();
    const AnotherChart = reactify(anotherRenderFn);
    new AnotherChart().execute();
    expect(anotherRenderFn).not.toHaveBeenCalled();
  });
});

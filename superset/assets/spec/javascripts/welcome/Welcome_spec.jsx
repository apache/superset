import React from 'react';
import { Panel, Row, Tab } from 'react-bootstrap';
import { shallow } from 'enzyme';

import Welcome from '../../../src/welcome/Welcome';

describe('Welcome', () => {
  let fetchMock;  // mock calls to /tagview/tags/suggestions/

  beforeAll(() => {
    fetchMock = jest.spyOn(window, 'fetch').mockImplementation(() => Promise.resolve({}));
  });

  afterAll(() => {
    fetchMock.mockClear();
  });

  const mockedProps = {};
  it('is valid', () => {
    expect(
      React.isValidElement(<Welcome {...mockedProps} />),
    ).toBe(true);
  });
  it('renders 4 Tabs, 4 Panels, and 5 Row components', () => {
    const wrapper = shallow(<Welcome {...mockedProps} />);
    expect(wrapper.find(Tab)).toHaveLength(4);
    expect(wrapper.find(Panel)).toHaveLength(4);
    expect(wrapper.find(Row)).toHaveLength(5);
  });
});

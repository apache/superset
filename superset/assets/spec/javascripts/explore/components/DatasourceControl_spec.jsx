import React from 'react';
import sinon from 'sinon';
import configureStore from 'redux-mock-store';
import { shallow } from 'enzyme';
import DatasourceModal from '../../../../src/datasource/DatasourceModal';
import DatasourceControl from '../../../../src/explore/components/controls/DatasourceControl';

const defaultProps = {
  name: 'datasource',
  label: 'Datasource',
  value: '1__table',
  datasource: {
    name: 'birth_names',
    type: 'table',
    uid: '1__table',
    id: 1,
    columns: [],
    metrics: [],
    database: {
      backend: 'mysql',
      name: 'main',
    },
  },
  onChange: sinon.spy(),
};

describe('DatasourceControl', () => {
  function setup() {
    const mockStore = configureStore([]);
    const store = mockStore({});
    return shallow(<DatasourceControl {...defaultProps} />, { context: { store } });
  }

  it('renders a Modal', () => {
    const wrapper = setup();
    expect(wrapper.find(DatasourceModal)).toHaveLength(1);
  });
});

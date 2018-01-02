import React from 'react';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import { Modal } from 'react-bootstrap';
import DatasourceControl from '../../../../javascripts/explore/components/controls/DatasourceControl';

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
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<DatasourceControl {...defaultProps} />);
  });

  it('renders a Modal', () => {
    expect(wrapper.find(Modal)).to.have.lengthOf(1);
  });
});

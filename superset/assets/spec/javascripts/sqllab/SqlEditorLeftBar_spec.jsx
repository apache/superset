import React from 'react';
import { shallow } from 'enzyme';
import sinon from 'sinon';
import { expect } from 'chai';

import $ from 'jquery';
import { table, defaultQueryEditor, databases, tables } from './fixtures';
import SqlEditorLeftBar from '../../../src/SqlLab/components/SqlEditorLeftBar';
import TableElement from '../../../src/SqlLab/components/TableElement';

describe('SqlEditorLeftBar', () => {
  const mockedProps = {
    actions: {
      queryEditorSetSchema: sinon.stub(),
      queryEditorSetDb: sinon.stub(),
      setDatabases: sinon.stub(),
      addTable: sinon.stub(),
      addDangerToast: sinon.stub(),
    },
    tables: [table],
    queryEditor: defaultQueryEditor,
    database: {},
    height: 0,
  };

  let wrapper;
  let ajaxStub;
  beforeEach(() => {
    ajaxStub = sinon.stub($, 'get');
    wrapper = shallow(<SqlEditorLeftBar {...mockedProps} />);
  });
  afterEach(() => {
    ajaxStub.restore();
  });

  it('is valid', () => {
    expect(
      React.isValidElement(<SqlEditorLeftBar {...mockedProps} />),
    ).to.equal(true);
  });
  it('renders a TableElement', () => {
    expect(wrapper.find(TableElement)).to.have.length(1);
  });
  describe('onDatabaseChange', () => {
    it('should fetch tables', () => {
      sinon.stub(wrapper.instance(), 'fetchTables');
      sinon.stub(wrapper.instance(), 'fetchSchemas');
      wrapper.instance().onDatabaseChange({ value: 1, label: 'main' });

      expect(wrapper.instance().fetchTables.getCall(0).args[0]).to.equal(1);
      expect(wrapper.instance().fetchSchemas.getCall(0).args[0]).to.equal(1);
      wrapper.instance().fetchTables.restore();
      wrapper.instance().fetchSchemas.restore();
    });
    it('should clear tableOptions', () => {
      wrapper.instance().onDatabaseChange();
      expect(wrapper.state().tableOptions).to.deep.equal([]);
    });
  });
  describe('getTableNamesBySubStr', () => {
    it('should handle empty', () => (
      wrapper.instance().getTableNamesBySubStr('')
        .then((data) => {
          expect(data).to.deep.equal({ options: [] });
        })
    ));
    it('should handle table name', () => {
      const queryEditor = Object.assign({}, defaultQueryEditor,
        {
          dbId: 1,
          schema: 'main',
        });
      const mockTableOptions = { options: [table] };
      wrapper.setProps({ queryEditor });
      ajaxStub.callsFake(() => {
        const d = $.Deferred();
        d.resolve(mockTableOptions);
        return d.promise();
      });

      return wrapper.instance().getTableNamesBySubStr('my table')
        .then((data) => {
          expect(ajaxStub.getCall(0).args[0]).to.equal('/superset/tables/1/main/my table');
          expect(data).to.deep.equal(mockTableOptions);
        });
    });
  });
  it('dbMutator should build databases options', () => {
    const options = wrapper.instance().dbMutator(databases);
    expect(options).to.deep.equal([
      { value: 1, label: 'main' },
      { value: 208, label: 'Presto - Gold' },
    ]);
  });
  describe('fetchTables', () => {
    it('should clear table options', () => {
      wrapper.instance().fetchTables(1);
      expect(wrapper.state().tableOptions).to.deep.equal([]);
      expect(wrapper.state().filterOptions).to.be.a('null');
    });
    it('should fetch table options', () => {
      ajaxStub.callsFake(() => {
        const d = $.Deferred();
        d.resolve(tables);
        return d.promise();
      });
      wrapper.instance().fetchTables(1, 'main', 'birth_names');

      expect(ajaxStub.getCall(0).args[0]).to.equal('/superset/tables/1/main/birth_names/');
      expect(wrapper.state().tableLength).to.equal(3);
    });
    it('should handle error', () => {
      ajaxStub.callsFake(() => {
        const d = $.Deferred();
        d.reject('error message');
        return d.promise();
      });
      wrapper.instance().fetchTables(1, 'main', 'birth_names');
      expect(wrapper.state().tableOptions).to.deep.equal([]);
      expect(wrapper.state().tableLength).to.equal(0);
    });
  });
  describe('fetchSchemas', () => {
    it('should fetch schema options', () => {
      const schemaOptions = {
        schemas: ['main', 'erf', 'superset'],
      };
      ajaxStub.callsFake(() => {
        const d = $.Deferred();
        d.resolve(schemaOptions);
        return d.promise();
      });
      wrapper.instance().fetchSchemas(1);
      expect(ajaxStub.getCall(0).args[0]).to.equal('/superset/schemas/1/');
      expect(wrapper.state().schemaOptions).to.have.length(3);
    });
    it('should handle error', () => {
      ajaxStub.callsFake(() => {
        const d = $.Deferred();
        d.reject('error message');
        return d.promise();
      });
      wrapper.instance().fetchSchemas(123);
      expect(wrapper.state().schemaOptions).to.deep.equal([]);
    });
  });
  describe('changeTable', () => {
    beforeEach(() => {
      sinon.stub(wrapper.instance(), 'fetchTables');
    });
    afterEach(() => {
      wrapper.instance().fetchTables.restore();
    });
    it('test 1', () => {
      wrapper.instance().changeTable({
        value: 'birth_names',
        label: 'birth_names',
      });
      expect(wrapper.state().tableName).to.equal('birth_names');
    });
    it('test 2', () => {
      wrapper.instance().changeTable({
        value: 'main.my_table',
        label: 'my_table',
      });
      expect(wrapper.instance().fetchTables.getCall(0).args[1]).to.equal('main');
    });
  });
  it('changeSchema', () => {
    sinon.stub(wrapper.instance(), 'fetchTables');

    wrapper.instance().changeSchema({ label: 'main', value: 'main' });
    expect(wrapper.instance().fetchTables.getCall(0).args[1]).to.equal('main');
    wrapper.instance().changeSchema();
    expect(wrapper.instance().fetchTables.getCall(1).args[1]).to.be.a('null');

    wrapper.instance().fetchTables.restore();
  });
});

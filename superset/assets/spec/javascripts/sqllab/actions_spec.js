/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import sinon from 'sinon';
import $ from 'jquery';
import * as actions from '../../../src/SqlLab/actions';
import { query } from './fixtures';

describe('async actions', () => {
  let ajaxStub;
  let dispatch;

  beforeEach(() => {
    dispatch = sinon.spy();
    ajaxStub = sinon.stub($, 'ajax');
  });
  afterEach(() => {
    ajaxStub.restore();
  });

  describe('saveQuery', () => {
    it('makes the ajax request', () => {
      const thunk = actions.saveQuery(query);
      thunk((/* mockDispatch */) => {});
      expect(ajaxStub.calledOnce).to.be.true;
    });

    it('calls correct url', () => {
      const url = '/savedqueryviewapi/api/create';
      const thunk = actions.saveQuery(query);
      thunk((/* mockDispatch */) => {});
      expect(ajaxStub.getCall(0).args[0].url).to.equal(url);
    });
  });

  describe('fetchQueryResults', () => {
    const makeRequest = () => {
      const request = actions.fetchQueryResults(query);
      request(dispatch);
    };

    it('makes the ajax request', () => {
      makeRequest();
      expect(ajaxStub.calledOnce).to.be.true;
    });

    it('calls correct url', () => {
      const url = `/superset/results/${query.resultsKey}/`;
      makeRequest();
      expect(ajaxStub.getCall(0).args[0].url).to.equal(url);
    });

    it('calls requestQueryResults', () => {
      makeRequest();
      expect(dispatch.args[0][0].type).to.equal(actions.REQUEST_QUERY_RESULTS);
    });

    it('calls querySuccess on ajax success', () => {
      ajaxStub.yieldsTo('success', '{ "data": "" }');
      makeRequest();
      expect(dispatch.callCount).to.equal(2);
      expect(dispatch.getCall(1).args[0].type).to.equal(actions.QUERY_SUCCESS);
    });

    it('calls queryFailed on ajax error', () => {
      ajaxStub.yieldsTo('error', { responseJSON: { error: 'error text' } });
      makeRequest();
      expect(dispatch.callCount).to.equal(2);
      expect(dispatch.getCall(1).args[0].type).to.equal(actions.QUERY_FAILED);
    });
  });

  describe('runQuery', () => {
    const makeRequest = () => {
      const request = actions.runQuery(query);
      request(dispatch);
    };

    it('makes the ajax request', () => {
      makeRequest();
      expect(ajaxStub.calledOnce).to.be.true;
    });

    it('calls startQuery', () => {
      makeRequest();
      expect(dispatch.args[0][0].type).to.equal(actions.START_QUERY);
    });

    it('calls queryFailed on ajax error', () => {
      ajaxStub.yieldsTo('error', { responseJSON: { error: 'error text' } });
      makeRequest();
      expect(dispatch.callCount).to.equal(2);
      expect(dispatch.getCall(1).args[0].type).to.equal(actions.QUERY_FAILED);
    });
  });

  describe('postStopQuery', () => {
    const makeRequest = () => {
      const request = actions.postStopQuery(query);
      request(dispatch);
    };

    it('makes the ajax request', () => {
      makeRequest();
      expect(ajaxStub.calledOnce).to.be.true;
    });

    it('calls stopQuery', () => {
      makeRequest();
      expect(dispatch.args[0][0].type).to.equal(actions.STOP_QUERY);
    });

    it('calls the correct url', () => {
      const url = '/superset/stop_query/';
      makeRequest();
      expect(ajaxStub.getCall(0).args[0].url).to.equal(url);
    });

    it('sends the correct data', () => {
      const data = { client_id: query.id };
      makeRequest();
      expect(ajaxStub.getCall(0).args[0].data).to.deep.equal(data);
    });
  });
});

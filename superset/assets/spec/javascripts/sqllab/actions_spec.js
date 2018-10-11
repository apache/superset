/* eslint-disable no-unused-expressions */
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
    test('makes the ajax request', () => {
      const thunk = actions.saveQuery(query);
      thunk((/* mockDispatch */) => {});
      expect(ajaxStub.calledOnce).toBe(true);
    });

    test('calls correct url', () => {
      const url = '/savedqueryviewapi/api/create';
      const thunk = actions.saveQuery(query);
      thunk((/* mockDispatch */) => {});
      expect(ajaxStub.getCall(0).args[0].url).toBe(url);
    });
  });

  describe('fetchQueryResults', () => {
    const makeRequest = () => {
      const request = actions.fetchQueryResults(query);
      request(dispatch);
    };

    test('makes the ajax request', () => {
      makeRequest();
      expect(ajaxStub.calledOnce).toBe(true);
    });

    test('calls correct url', () => {
      const url = `/superset/results/${query.resultsKey}/`;
      makeRequest();
      expect(ajaxStub.getCall(0).args[0].url).toBe(url);
    });

    test('calls requestQueryResults', () => {
      makeRequest();
      expect(dispatch.args[0][0].type).toBe(actions.REQUEST_QUERY_RESULTS);
    });

    test('calls querySuccess on ajax success', () => {
      ajaxStub.yieldsTo('success', '{ "data": "" }');
      makeRequest();
      expect(dispatch.callCount).toBe(2);
      expect(dispatch.getCall(1).args[0].type).toBe(actions.QUERY_SUCCESS);
    });

    test('calls queryFailed on ajax error', () => {
      ajaxStub.yieldsTo('error', { responseJSON: { error: 'error text' } });
      makeRequest();
      expect(dispatch.callCount).toBe(2);
      expect(dispatch.getCall(1).args[0].type).toBe(actions.QUERY_FAILED);
    });
  });

  describe('runQuery', () => {
    const makeRequest = () => {
      const request = actions.runQuery(query);
      request(dispatch);
    };

    test('makes the ajax request', () => {
      makeRequest();
      expect(ajaxStub.calledOnce).toBe(true);
    });

    test('calls startQuery', () => {
      makeRequest();
      expect(dispatch.args[0][0].type).toBe(actions.START_QUERY);
    });

    test('calls queryFailed on ajax error', () => {
      ajaxStub.yieldsTo('error', { responseJSON: { error: 'error text' } });
      makeRequest();
      expect(dispatch.callCount).toBe(2);
      expect(dispatch.getCall(1).args[0].type).toBe(actions.QUERY_FAILED);
    });
  });

  describe('postStopQuery', () => {
    const makeRequest = () => {
      const request = actions.postStopQuery(query);
      request(dispatch);
    };

    test('makes the ajax request', () => {
      makeRequest();
      expect(ajaxStub.calledOnce).toBe(true);
    });

    test('calls stopQuery', () => {
      makeRequest();
      expect(dispatch.args[0][0].type).toBe(actions.STOP_QUERY);
    });

    test('calls the correct url', () => {
      const url = '/superset/stop_query/';
      makeRequest();
      expect(ajaxStub.getCall(0).args[0].url).toBe(url);
    });

    test('sends the correct data', () => {
      const data = { client_id: query.id };
      makeRequest();
      expect(ajaxStub.getCall(0).args[0].data).toEqual(data);
    });
  });
});

/* eslint-disable no-unused-expressions */
import { it, describe, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';

import * as actions from '../../../src/SqlLab/actions';
import { query } from './fixtures';

describe('async actions', () => {
  let dispatch;

  beforeEach(() => {
    dispatch = sinon.spy();
  });

  afterEach(fetchMock.reset);

  describe('saveQuery', () => {
    const saveQueryEndpoint = 'glob:*/savedqueryviewapi/api/create';
    fetchMock.post(saveQueryEndpoint, 'ok');

    it('posts to the correct url', (done) => {
      const thunk = actions.saveQuery(query);
      thunk((/* mockDispatch */) => {});
      setTimeout(() => {
        expect(fetchMock.calls(saveQueryEndpoint)).to.have.lengthOf(1);
        done();
      });
    });

    it('posts the correct query object', (done) => {
      const thunk = actions.saveQuery(query);
      thunk((/* mockDispatch */) => {});
      setTimeout(() => {
        const call = fetchMock.calls(saveQueryEndpoint)[0];
        const formData = call[1].body;
        Object.keys(query).forEach((key) => {
          expect(formData.get(key)).to.not.be.undefined;
        });
        done();
      });
    });
  });

  describe('fetchQueryResults', () => {
    const fetchQueryEndpoint = 'glob:*/superset/results/*';
    fetchMock.get(fetchQueryEndpoint, { data: '' });

    const makeRequest = () => {
      const request = actions.fetchQueryResults(query);
      request(dispatch);
    };

    it('makes the fetch request', (done) => {
      makeRequest();
      setTimeout(() => {
        expect(fetchMock.calls(fetchQueryEndpoint)).to.have.lengthOf(1);
        done();
      });
    });

    it('calls requestQueryResults', (done) => {
      makeRequest();
      setTimeout(() => {
        expect(dispatch.args[0][0].type).to.equal(actions.REQUEST_QUERY_RESULTS);
        done();
      });
    });

    it('calls querySuccess on fetch success', (done) => {
      makeRequest();
      setTimeout(() => {
        expect(dispatch.callCount).to.equal(2);
        expect(dispatch.getCall(1).args[0].type).to.equal(actions.QUERY_SUCCESS);
        done();
      });
    });

    it('calls queryFailed on fetch error', (done) => {
      fetchMock.get(
        fetchQueryEndpoint,
        { throws: { error: 'error text' } },
        { overwriteRoutes: true },
      );

      makeRequest();
      setTimeout(() => {
        expect(dispatch.callCount).to.equal(2);
        expect(dispatch.getCall(1).args[0].type).to.equal(actions.QUERY_FAILED);
        done();
      });
    });
  });

  describe('runQuery', () => {
    const runQueryEndpoint = 'glob:*/superset/sql_json/*';
    fetchMock.post(runQueryEndpoint, { data: '' });

    const makeRequest = () => {
      const request = actions.runQuery(query);
      request(dispatch);
    };

    it('makes the fetch request', (done) => {
      makeRequest();
      setTimeout(() => {
        expect(fetchMock.calls(runQueryEndpoint)).to.have.lengthOf(1);
        done();
      });
    });

    it('calls startQuery', (done) => {
      makeRequest();
      setTimeout(() => {
        expect(dispatch.args[0][0].type).to.equal(actions.START_QUERY);
        done();
      });
    });

    it('calls querySuccess on fetch success', (done) => {
      makeRequest();
      setTimeout(() => {
        expect(dispatch.callCount).to.equal(2);
        expect(dispatch.getCall(1).args[0].type).to.equal(actions.QUERY_SUCCESS);
        done();
      });
    });

    it('calls queryFailed on fetch error', (done) => {
      fetchMock.post(
        runQueryEndpoint,
        { throws: { error: 'error text' } },
        { overwriteRoutes: true },
      );

      makeRequest();
      setTimeout(() => {
        expect(dispatch.callCount).to.equal(2);
        expect(dispatch.getCall(1).args[0].type).to.equal(actions.QUERY_FAILED);
        done();
      });
    });
  });

  describe('postStopQuery', () => {
    const stopQueryEndpoint = 'glob:*/superset/stop_query/*';
    fetchMock.post(stopQueryEndpoint, { data: '' });

    const makeRequest = () => {
      const request = actions.postStopQuery(query);
      request(dispatch);
    };

    it('makes the fetch request', (done) => {
      makeRequest();
      setTimeout(() => {
        expect(fetchMock.calls(stopQueryEndpoint)).to.have.lengthOf(1);
        done();
      });
    });

    it('calls stopQuery', (done) => {
      makeRequest();
      setTimeout(() => {
        expect(dispatch.getCall(0).args[0].type).to.equal(actions.STOP_QUERY);
        // expect(dispatch.args[0][0].type).to.equal(actions.STOP_QUERY);
        done();
      });
    });

    it('sends the correct data', (done) => {
      makeRequest();
      setTimeout(() => {
        const call = fetchMock.calls(stopQueryEndpoint)[0];
        expect(call[1].body.get('client_id')).to.equal(query.id);
        done();
      });
    });
  });
});

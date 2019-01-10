import { expect } from 'chai';
import fetchMock from 'fetch-mock';
import sinon from 'sinon';

import { Logger } from '../../../src/logger';
import setupSupersetClient from '../../helpers/setupSupersetClient';
import * as exploreUtils from '../../../src/explore/exploreUtils';
import * as actions from '../../../src/chart/chartAction';

describe('chart actions', () => {
  const MOCK_URL = 'mockURL';
  let dispatch;
  let urlStub;
  let loggerStub;

  const setupDefaultFetchMock = () => {
    fetchMock.post(MOCK_URL, { json: {} }, { overwriteRoutes: true });
  };

  before(() => {
    setupSupersetClient();
    setupDefaultFetchMock();
  });

  after(fetchMock.restore);

  beforeEach(() => {
    dispatch = sinon.spy();
    urlStub = sinon
      .stub(exploreUtils, 'getExploreUrlAndPayload')
      .callsFake(() => ({ url: MOCK_URL, payload: {} }));
    loggerStub = sinon.stub(Logger, 'append');
  });

  afterEach(() => {
    urlStub.restore();
    loggerStub.restore();
    fetchMock.resetHistory();
  });

  it('should dispatch CHART_UPDATE_STARTED action before the query', (done) => {
    const actionThunk = actions.runQuery({});
    actionThunk(dispatch).then(() => {
      // chart update, trigger query, update form data, success
      expect(dispatch.callCount).to.equal(4);
      expect(fetchMock.calls(MOCK_URL)).to.have.lengthOf(1);
      expect(dispatch.args[0][0].type).to.equal(actions.CHART_UPDATE_STARTED);
      done();
    });
  });

  it('should dispatch TRIGGER_QUERY action with the query', (done) => {
    const actionThunk = actions.runQuery({});
    actionThunk(dispatch).then(() => {
      // chart update, trigger query, update form data, success
      expect(dispatch.callCount).to.equal(4);
      expect(fetchMock.calls(MOCK_URL)).to.have.lengthOf(1);
      expect(dispatch.args[1][0].type).to.equal(actions.TRIGGER_QUERY);
      done();
    });
  });

  it('should dispatch UPDATE_QUERY_FORM_DATA action with the query', (done) => {
    const actionThunk = actions.runQuery({});
    actionThunk(dispatch).then(() => {
      // chart update, trigger query, update form data, success
      expect(dispatch.callCount).to.equal(4);
      expect(fetchMock.calls(MOCK_URL)).to.have.lengthOf(1);
      expect(dispatch.args[2][0].type).to.equal(actions.UPDATE_QUERY_FORM_DATA);
      done();
    });
  });

  it('should dispatch CHART_UPDATE_SUCCEEDED action upon success', (done) => {
    const actionThunk = actions.runQuery({});
    actionThunk(dispatch).then(() => {
      // chart update, trigger query, update form data, success
      expect(dispatch.callCount).to.equal(4);
      expect(fetchMock.calls(MOCK_URL)).to.have.lengthOf(1);
      expect(dispatch.args[3][0].type).to.equal(actions.CHART_UPDATE_SUCCEEDED);
      done();
    });
  });

  it('should CHART_UPDATE_TIMEOUT action upon query timeout', (done) => {
    const unresolvingPromise = new Promise(() => {});
    fetchMock.post(MOCK_URL, () => unresolvingPromise, { overwriteRoutes: true });

    const timeoutInSec = 1 / 1000;
    const actionThunk = actions.runQuery({}, false, timeoutInSec);

    actionThunk(dispatch).then(() => {
      // chart update, trigger query, update form data, fail
      expect(dispatch.callCount).to.equal(4);
      expect(dispatch.args[3][0].type).to.equal(actions.CHART_UPDATE_TIMEOUT);
      setupDefaultFetchMock();
      done();
    });
  });

  it('should dispatch CHART_UPDATE_FAILED action upon non-timeout non-abort failure', (done) => {
    fetchMock.post(MOCK_URL, { throws: { error: 'misc error' } }, { overwriteRoutes: true });

    const timeoutInSec = 1 / 1000;
    const actionThunk = actions.runQuery({}, false, timeoutInSec);

    actionThunk(dispatch).then(() => {
      // chart update, trigger query, update form data, fail
      expect(dispatch.callCount).to.equal(4);
      const updateFailedAction = dispatch.args[3][0];
      expect(updateFailedAction.type).to.equal(actions.CHART_UPDATE_FAILED);
      expect(updateFailedAction.queryResponse.error).to.equal('misc error');
      setupDefaultFetchMock();
      done();
    });
  });
});

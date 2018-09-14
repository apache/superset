import { expect } from 'chai';
import sinon from 'sinon';
import $ from 'jquery';
import * as exploreUtils from '../../../src/explore/exploreUtils';
import * as actions from '../../../src/chart/chartAction';

describe('chart actions', () => {
  let dispatch;
  let urlStub;
  let ajaxStub;
  let request;

  beforeEach(() => {
    dispatch = sinon.spy();
    urlStub = sinon.stub(exploreUtils, 'getExploreUrlAndPayload')
      .callsFake(() => ({ url: 'mockURL', payload: {} }));
    ajaxStub = sinon.stub($, 'ajax');
  });

  afterEach(() => {
    urlStub.restore();
    ajaxStub.restore();
  });

  it('should handle query timeout', () => {
    ajaxStub.rejects({ statusText: 'timeout' });
    request = actions.runQuery({});
    const promise = request(dispatch, sinon.stub().returns({
      explore: {
        controls: [],
      },
    }));
    promise.then(() => {
      expect(dispatch.callCount).to.equal(3);
      expect(dispatch.args[0][0].type).to.equal(actions.CHART_UPDATE_TIMEOUT);
    });
  });
});

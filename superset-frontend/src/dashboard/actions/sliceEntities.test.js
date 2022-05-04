import sinon from 'sinon';
import { SupersetClient } from '@superset-ui/core';

import {
  FETCH_ALL_SLICES_STARTED,
  fetchSortedSlices,
  fetchFilteredSlices,
  fetchAllSlices,
} from './sliceEntities';

describe('slice entity actions', () => {
  const mockState = {
    sliceEntities: { slices: {} },
    isLoading: true,
    errorMessage: null,
    lastUpdated: 0,
  };

  function setup(stateOverrides) {
    const state = { ...mockState, ...stateOverrides };
    const getState = sinon.spy(() => state);
    const dispatch = sinon.spy();

    return { getState, dispatch, state };
  }

  let spy;

  beforeEach(() => {
    spy = sinon.spy(SupersetClient);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('fetchSortedSlices', () => {
    it('should dispatch an fetchAllSlicesStarted action', async () => {
      const { dispatch } = setup();
      const thunk1 = fetchSortedSlices('userId', false, 'orderColumn');
      await thunk1(dispatch);
      expect(dispatch.getCall(0).args[0]).toEqual({
        type: FETCH_ALL_SLICES_STARTED,
      });
      expect(spy.get.callCount).toBe(1);
    });
  });

  describe('fetchFilteredSlices', () => {
    it('should dispatch an fetchAllSlicesStarted action', async () => {
      const { dispatch, getState } = setup();
      const thunk1 = fetchFilteredSlices('userId', false, 'filter_value');
      await thunk1(dispatch, getState);
      expect(dispatch.getCall(0).args[0]).toEqual({
        type: FETCH_ALL_SLICES_STARTED,
      });
      expect(spy.get.callCount).toBe(1);
    });
  });

  describe('fetchAllSlices', () => {
    it('should not trigger fetchSlices when sliceEntities lastUpdate is not 0', async () => {
      const { dispatch, getState } = setup({
        sliceEntities: { slices: {}, lastUpdated: 1 },
      });

      const thunk1 = fetchAllSlices('userId', false, 'filter_value');
      await thunk1(dispatch, getState);

      expect(spy.get.callCount).toBe(0);
    });

    it('should trigger fetchSlices when sliceEntities lastUpdate is 0', async () => {
      const { dispatch, getState } = setup({
        sliceEntities: { slices: {}, lastUpdated: 0 },
      });

      const thunk1 = fetchAllSlices('userId', false, 'filter_value');
      await thunk1(dispatch, getState);

      expect(spy.get.callCount).toBe(1);
    });
  });
});

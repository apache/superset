import {
  FETCH_ALL_SLICES_FAILED,
  FETCH_ALL_SLICES_STARTED,
  SET_ALL_SLICES,
} from '../../../../src/dashboard/actions/sliceEntities';

import sliceEntitiesReducer from '../../../../src/dashboard/reducers/sliceEntities';

describe('sliceEntities reducer', () => {
  it('should return initial state', () => {
    expect(sliceEntitiesReducer({}, {})).toEqual({});
  });

  it('should set loading when fetching slices', () => {
    expect(
      sliceEntitiesReducer(
        { isLoading: false },
        { type: FETCH_ALL_SLICES_STARTED },
      ).isLoading,
    ).toBe(true);
  });

  it('should set slices', () => {
    const result = sliceEntitiesReducer(
      { slices: { a: {} } },
      { type: SET_ALL_SLICES, payload: { slices: { 1: {}, 2: {} } } },
    );

    expect(result.slices).toEqual({
      1: {},
      2: {},
      a: {},
    });
    expect(result.isLoading).toBe(false);
  });

  it('should set an error on error', () => {
    const result = sliceEntitiesReducer(
      {},
      {
        type: FETCH_ALL_SLICES_FAILED,
        payload: { error: 'failed' },
      },
    );
    expect(result.isLoading).toBe(false);
    expect(result.errorMessage.indexOf('failed')).toBeGreaterThan(-1);
  });
});

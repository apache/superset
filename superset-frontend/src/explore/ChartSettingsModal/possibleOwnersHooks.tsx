// useGetPossibleChartOwners
import React from 'react';
import { SupersetClient } from '@superset-ui/connection';

const initialState = { data: undefined, error: undefined, isLoading: false };
const possibleOwnersReducer = (state, action) => {
  switch (action.type) {
    case 'FETCH':
      return {
        ...state,
        isLoading: true,
      };
    case 'RECEIVE':
      return {
        error: undefined,
        data: action.data,
        isLoading: false,
      };
    case 'ERROR':
      return {
        ...state,
        error: undefined,
        isLoading: false,
      };
    default:
      throw new Error();
  }
};

const fetchEvent = () => ({
  type: 'FETCH',
});

const receiveEvent = (data) => ({
  type: 'RECEIVE',
  data,
});

const errorEvent = (error) => ({
  type: 'ERROR',
  error,
});

export const usePossibleOwners = () => {
  const [state, dispatch] = React.useReducer(possibleOwnersReducer, initialState);
  React.useEffect(() => {
    const controller = new AbortController();
    const runEffect = async () => {
      try {
        dispatch(fetchEvent());

        const res = await SupersetClient.get({
          endpoint: '/api/v1/chart/related/owners',
          signal: controller.signal,
        });

        dispatch(receiveEvent(res?.json?.result));
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('Aborted FetchChart request.');
          return;
        }
        // handle other errors here
      }
    };
    runEffect();

    return () => {
      controller.abort();
    };
  }, []);

  return [state];
};

export default { usePossibleOwners };
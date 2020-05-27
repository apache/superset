import React from 'react';
import getClientErrorObject from "../../utils/getClientErrorObject";
import { SupersetClient } from '@superset-ui/connection';

interface Chart {
  id: number;
  name: string;
  description: string;
  cacheTimeout: number;
  owners: Array<number>;
}

const initialState = { data: undefined, error: undefined, isLoading: false };
const chartReducer = (state, action) => {
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
        error: action.error,
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

const getChart = (id, dispatch) => {
  const controller = new AbortController();
  const runEffect = async () => {
    try {
      dispatch(fetchEvent());

      const res = await SupersetClient.get({
        endpoint: `/api/v1/chart/${id}`,
        signal: controller.signal,
      });

      dispatch(
        receiveEvent({
          id,
          name: res.json?.result?.slice_name,
          description: res.json?.result?.description,
          cacheTimeout: res.json?.result?.cache_timeout,
          owners: [...res.json?.result?.owners].map(owner => owner.id),
        }),
      );
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
};

const putChart = (chart: Chart, dispatch) => {
  const controller = new AbortController();
  const runEffect = async () => {
    try {
      dispatch(fetchEvent());

      await SupersetClient.put({
        endpoint: `/api/v1/chart/${chart.id}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slice_name: chart.name || null,
          description: chart.description || null,
          cache_timeout: chart.cacheTimeout || null,
          owners: chart.owners || [],
        }),
      });

      dispatch(receiveEvent(chart));
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Aborted FetchChart request.');
        return;
      }

      if (err.status === 400) {
        // Having to await in a catch like this feels terrible...
        const errBody = await err.json();
        dispatch(
          errorEvent({
            type: 'INVALID_PROPS',
            extra: {
              name: errBody?.message?.name,
              description: errBody?.message?.description,
              cacheTimeout: errBody?.message?.cache_timeout,
              owners: errBody?.message?.owners,
            },
          }),
        );
      }
      // handle other errors here
    }
  };
  runEffect();

  return () => {
    controller.abort();
  };
};

// useGetChart
export const useChart = (id: number) => {
  const [state, dispatch] = React.useReducer(chartReducer, initialState);

  // Fetch chart settings data.
  React.useEffect(() => getChart(id, dispatch), [id]);

  return [state, (chart: Chart) => putChart(chart, dispatch)];
};

export default { useChart };
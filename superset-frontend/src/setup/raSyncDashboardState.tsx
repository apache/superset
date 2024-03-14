import React, { useEffect } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { RootState } from '../dashboard/types';
import { updateDataMask } from "../dataMask/actions";

function RaSyncDashboardState({ children }) {
  const dispatch = useDispatch();

  const dataMask = useSelector<RootState, any>(
    state => state.dataMask,
    shallowEqual,
  );

  useEffect(() => {
    const filteredData = {};
    for (const key in dataMask) {
      if (key.startsWith('NATIVE_FILTER-')) {
        filteredData[key] = dataMask[key];
      }
    }
    window.parent.postMessage(JSON.stringify(filteredData), '*');
  }, [dataMask]);

  useEffect(() => {
    window.parent.postMessage('iframe ready', '*');
    window.addEventListener('message', event => {
      if (event.data.raFilter) {
        const receivedFilterState = JSON.parse(event.data.raFilter);
        const filterIds = Object.keys(receivedFilterState);
        filterIds.forEach(filterId => {
          dispatch(updateDataMask(filterId, receivedFilterState[filterId]));
        });
      }
    });
  }, []);

  return (
    <div>
      <span>Huy Ahihi</span>
      {children}
    </div>
  );
}

export default RaSyncDashboardState;

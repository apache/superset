import { Dispatch } from '@reduxjs/toolkit';
import {
  ONBOARDING_REQUEST_LIST_ERROR,
  ONBOARDING_REQUEST_LIST_LOADING,
  ONBOARDING_REQUEST_LIST_SUCCESS,
} from '../types/requestList.types';
import { getStatementListRepository } from '../../repository/getStatementList.repository';
import { FetchDataConfig } from '../../../../components/ListView';

export function loadRequestList(config: FetchDataConfig) {
  return async function (dispatch: Dispatch) {
    try {
      dispatch({
        type: ONBOARDING_REQUEST_LIST_LOADING,
      });

      const data = await getStatementListRepository(config);

      dispatch({
        type: ONBOARDING_REQUEST_LIST_SUCCESS,
        payload: data,
      });
    } catch (e) {
      dispatch({
        type: ONBOARDING_REQUEST_LIST_ERROR,
        payload: {
          error: e.message,
        },
      });
    }
  };
}

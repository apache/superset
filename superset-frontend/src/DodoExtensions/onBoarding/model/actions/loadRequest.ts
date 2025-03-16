import { Dispatch } from '@reduxjs/toolkit';
import {
  ONBOARDING_REQUEST_ERROR,
  ONBOARDING_REQUEST_LOADING,
  ONBOARDING_REQUEST_SUCCESS,
} from '../types/request.types';
import { getStatementRepository } from '../../repository/getStatement.repository';

export function loadRequest(id: string) {
  return async function (dispatch: Dispatch) {
    try {
      dispatch({
        type: ONBOARDING_REQUEST_LOADING,
      });

      const data = await getStatementRepository(id);

      dispatch({
        type: ONBOARDING_REQUEST_SUCCESS,
        payload: data,
      });
    } catch (e) {
      dispatch({
        type: ONBOARDING_REQUEST_ERROR,
        payload: {
          error: e.message,
        },
      });
    }
  };
}

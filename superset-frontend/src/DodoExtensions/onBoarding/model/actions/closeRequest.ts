import { Dispatch } from '@reduxjs/toolkit';
import { Role } from '../../types';
import {
  ONBOARDING_REQUEST_CLOSING_ERROR,
  ONBOARDING_REQUEST_CLOSING_PENDING,
  ONBOARDING_REQUEST_CLOSING_SUCCESS,
} from '../types/request.types';
import { putStatementRepository } from '../../repository/putStatement.repository';

type Params = {
  id: string;
  slug: string;
  roles: Array<Role>;
};

export function closeRequest(params: Params) {
  return async function (dispatch: Dispatch) {
    try {
      dispatch({
        type: ONBOARDING_REQUEST_CLOSING_PENDING,
      });

      const payload = await putStatementRepository(params);

      dispatch({
        type: ONBOARDING_REQUEST_CLOSING_SUCCESS,
        payload,
      });
    } catch (response) {
      const { statusText } = response;
      const error = await response.json();

      dispatch({
        type: ONBOARDING_REQUEST_CLOSING_ERROR,
        payload: {
          error: `${statusText}:${JSON.stringify(error)}`,
        },
      });
    }
  };
}

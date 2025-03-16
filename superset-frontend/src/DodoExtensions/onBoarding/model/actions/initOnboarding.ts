import { Dispatch } from '@reduxjs/toolkit';
import {
  ONBOARDING_INIT_ERROR,
  ONBOARDING_INIT_LOADING,
  ONBOARDING_INIT_SUCCESS,
} from '../types/start.types';
import { getOnboardingRepository } from '../../repository/getOnboarding.repository';

export function initOnboarding() {
  return async function (dispatch: Dispatch) {
    try {
      dispatch({
        type: ONBOARDING_INIT_LOADING,
      });

      const data = await getOnboardingRepository();

      dispatch({
        type: ONBOARDING_INIT_SUCCESS,
        payload: data,
      });
    } catch (e) {
      dispatch({
        type: ONBOARDING_INIT_ERROR,
        payload: {
          error: e.message,
        },
      });
    }
  };
}

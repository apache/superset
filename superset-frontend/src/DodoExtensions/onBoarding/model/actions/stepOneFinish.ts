import { Dispatch } from '@reduxjs/toolkit';
import {
  ONBOARDING_STEP_ONE_FINISH_ERROR,
  ONBOARDING_STEP_ONE_FINISH_SUCCESS,
  ONBOARDING_STEP_ONE_FINISH_UPDATING,
} from '../types/start.types';
import { putOnboardingRepository } from '../../repository/putOnboarding.repository';

export function stepOneFinish(dodoRole: string) {
  return async function (dispatch: Dispatch) {
    try {
      dispatch({
        type: ONBOARDING_STEP_ONE_FINISH_UPDATING,
      });

      const data = await putOnboardingRepository(dodoRole);

      dispatch({
        type: ONBOARDING_STEP_ONE_FINISH_SUCCESS,
        payload: data,
      });
    } catch (e) {
      dispatch({
        type: ONBOARDING_STEP_ONE_FINISH_ERROR,
        payload: {
          error: e.message,
        },
      });
    }
  };
}

import { Dispatch } from '@reduxjs/toolkit';
import { StepTwoPopupDto } from '../../components/stepTwoPopup/stepTwoPopup.dto';
import {
  ONBOARDING_FINISH_ERROR,
  ONBOARDING_FINISH_SUCCESS,
  ONBOARDING_FINISH_UPDATING,
} from '../types/start.types';
import { postStatementRepository } from '../../repository/postStatment.repository';

export function finishOnBoarding(dto: StepTwoPopupDto) {
  return async function (dispatch: Dispatch) {
    try {
      dispatch({
        type: ONBOARDING_FINISH_UPDATING,
      });

      const data = await postStatementRepository(dto);

      dispatch({
        type: ONBOARDING_FINISH_SUCCESS,
        payload: data,
      });
    } catch (e) {
      dispatch({
        type: ONBOARDING_FINISH_ERROR,
        payload: {
          error: e.message,
        },
      });
    }
  };
}

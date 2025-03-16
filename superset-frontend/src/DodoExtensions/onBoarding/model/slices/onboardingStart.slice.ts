import {
  ONBOARDING_FINISH_ERROR,
  ONBOARDING_FINISH_SUCCESS,
  ONBOARDING_FINISH_UPDATING,
  ONBOARDING_INIT_ERROR,
  ONBOARDING_INIT_LOADING,
  ONBOARDING_INIT_SUCCESS,
  ONBOARDING_STEP_ONE_FINISH_ERROR,
  ONBOARDING_STEP_ONE_FINISH_SUCCESS,
  ONBOARDING_STEP_ONE_FINISH_UPDATING,
  OnboardingAction,
  OnboardingStartState,
} from '../types/start.types';

const initialState: OnboardingStartState = {
  isLoading: false,
  loadingError: null,

  isOnboardingFinished: true,
  onboardingStartedTime: null,

  id: null,
  firstName: null,
  lastName: null,
  email: null,

  stepOneUpdating: false,
  stepOneError: null,

  finishUpdating: false,
  finishSuccessError: null,
};

export const onboardingStartSlice = (
  state: OnboardingStartState = initialState,
  action: OnboardingAction,
) => {
  switch (action.type) {
    case ONBOARDING_INIT_LOADING: {
      return { ...state, isLoading: true };
    }
    case ONBOARDING_INIT_SUCCESS: {
      return { ...state, isLoading: false, ...action.payload };
    }
    case ONBOARDING_INIT_ERROR: {
      return {
        ...state,
        isLoading: false,
        loadingError: action.payload.error,
      };
    }

    case ONBOARDING_STEP_ONE_FINISH_UPDATING: {
      return { ...state, stepOneUpdating: true };
    }
    case ONBOARDING_STEP_ONE_FINISH_SUCCESS: {
      return { ...state, stepOneUpdating: false, ...action.payload };
    }
    case ONBOARDING_STEP_ONE_FINISH_ERROR: {
      return {
        ...state,
        stepOneUpdating: false,
        stepOneError: action.payload.error,
      };
    }

    case ONBOARDING_FINISH_UPDATING: {
      return { ...state, finishUpdating: true };
    }
    case ONBOARDING_FINISH_SUCCESS: {
      return {
        ...state,
        finishUpdating: false,
        ...action.payload,
      };
    }
    case ONBOARDING_FINISH_ERROR: {
      return {
        ...state,
        finishUpdating: false,
        finishSuccessError: action.payload.error,
      };
    }

    default: {
      return state;
    }
  }
};

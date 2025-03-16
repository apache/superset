import {
  ONBOARDING_REQUEST_LIST_ERROR,
  ONBOARDING_REQUEST_LIST_LOADING,
  ONBOARDING_REQUEST_LIST_SUCCESS,
  OnboardingRequestListAction,
  OnboardingRequestListState,
} from '../types/requestList.types';

const initialState: OnboardingRequestListState = {
  isLoading: false,
  error: null,
  data: null,
};

export const onboardingRequestListSlice = (
  state: OnboardingRequestListState = initialState,
  action: OnboardingRequestListAction,
): OnboardingRequestListState => {
  switch (action.type) {
    case ONBOARDING_REQUEST_LIST_LOADING: {
      return { ...state, isLoading: true };
    }
    case ONBOARDING_REQUEST_LIST_SUCCESS: {
      return { ...state, isLoading: false, data: action.payload };
    }
    case ONBOARDING_REQUEST_LIST_ERROR: {
      return {
        ...state,
        isLoading: false,
        error: action.payload.error,
      };
    }

    default: {
      return state;
    }
  }
};

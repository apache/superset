import {
  ONBOARDING_USER_SEARCH_CLEAR,
  ONBOARDING_USER_SEARCH_ERROR,
  ONBOARDING_USER_SEARCH_PENDING,
  ONBOARDING_USER_SEARCH_SUCCESS,
  OnboardingUserSearchAction,
  OnboardingUserSearchState,
} from '../types/userSearch.types';

const initialState: OnboardingUserSearchState = {
  pending: false,
  data: [],
  error: null,
};

export const onboardingUserSearchSlice = (
  state: OnboardingUserSearchState = initialState,
  action: OnboardingUserSearchAction,
): OnboardingUserSearchState => {
  switch (action.type) {
    case ONBOARDING_USER_SEARCH_PENDING: {
      return { ...state, pending: true };
    }
    case ONBOARDING_USER_SEARCH_SUCCESS: {
      return { ...state, pending: false, data: action.payload };
    }
    case ONBOARDING_USER_SEARCH_ERROR: {
      return {
        ...state,
        pending: false,
        error: action.payload.error,
      };
    }
    case ONBOARDING_USER_SEARCH_CLEAR: {
      return {
        data: [],
        pending: false,
        error: null,
      };
    }

    default: {
      return state;
    }
  }
};

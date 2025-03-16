import {
  ONBOARDING_REQUEST_CLOSING_ERROR,
  ONBOARDING_REQUEST_CLOSING_ERROR_CLEAR,
  ONBOARDING_REQUEST_CLOSING_PENDING,
  ONBOARDING_REQUEST_CLOSING_SUCCESS,
  ONBOARDING_REQUEST_ERROR,
  ONBOARDING_REQUEST_LOADING,
  ONBOARDING_REQUEST_SUCCESS,
  OnboardingRequestAction,
  OnboardingRequestState,
} from '../types/request.types';

const initialState: OnboardingRequestState = {
  requestIsLoading: false,
  loadingRequestError: null,
  requestData: null,

  isClosing: false,
  closingSuccess: false,
  closingError: null,
};

export const onboardingRequestSlice = (
  state: OnboardingRequestState = initialState,
  action: OnboardingRequestAction,
): OnboardingRequestState => {
  switch (action.type) {
    case ONBOARDING_REQUEST_LOADING: {
      return {
        ...state,
        requestIsLoading: true,
        requestData: null,
        loadingRequestError: null,
        isClosing: false,
        closingSuccess: false,
        closingError: null,
      };
    }
    case ONBOARDING_REQUEST_SUCCESS: {
      return { ...state, requestIsLoading: false, requestData: action.payload };
    }
    case ONBOARDING_REQUEST_ERROR: {
      return {
        ...state,
        requestIsLoading: false,
        loadingRequestError: action.payload.error,
      };
    }

    case ONBOARDING_REQUEST_CLOSING_PENDING: {
      return {
        ...state,
        isClosing: true,
        closingSuccess: false,
        closingError: null,
      };
    }
    case ONBOARDING_REQUEST_CLOSING_SUCCESS: {
      return {
        ...state,
        isClosing: false,
        closingSuccess: true,
        closingError: null,
        requestData: action.payload,
      };
    }
    case ONBOARDING_REQUEST_CLOSING_ERROR: {
      return {
        ...state,
        isClosing: false,
        closingSuccess: false,
        closingError: action.payload.error,
      };
    }
    case ONBOARDING_REQUEST_CLOSING_ERROR_CLEAR: {
      return {
        ...state,
        closingError: null,
        isClosing: false,
        closingSuccess: false,
      };
    }

    default: {
      return state;
    }
  }
};

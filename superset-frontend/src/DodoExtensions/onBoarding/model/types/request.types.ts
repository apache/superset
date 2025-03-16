import { UserFromEnum } from '../../types';

export const ONBOARDING_REQUEST_LOADING = 'ONBOARDING_REQUEST_LOADING';
export const ONBOARDING_REQUEST_SUCCESS = 'ONBOARDING_REQUEST_SUCCESS';
export const ONBOARDING_REQUEST_ERROR = 'ONBOARDING_REQUEST_ERROR';

export const ONBOARDING_REQUEST_CLOSING_PENDING =
  'ONBOARDING_REQUEST_CLOSING_PENDING';
export const ONBOARDING_REQUEST_CLOSING_SUCCESS =
  'ONBOARDING_REQUEST_CLOSING_SUCCESS';
export const ONBOARDING_REQUEST_CLOSING_ERROR =
  'ONBOARDING_REQUEST_CLOSING_ERROR';
export const ONBOARDING_REQUEST_CLOSING_ERROR_CLEAR =
  'ONBOARDING_REQUEST_CLOSING_ERROR_CLEAR';

type ActionRequestLoading = {
  type: typeof ONBOARDING_REQUEST_LOADING;
};

type ActionRequestError = {
  type: typeof ONBOARDING_REQUEST_ERROR;
  payload: { error: string };
};

type SingleStatementModel = {
  userFrom: UserFromEnum;
  firstName: string;
  lastName: string;
  email: string;
  dodoRole: string;
  currentRoles: Array<string>;
  requestedRoles: Array<string>;
  team: string;
  requestDate: Date;
  isClosed: boolean;
  updateDate: Date;
};

type ActionRequestSuccess = {
  type: typeof ONBOARDING_REQUEST_SUCCESS;
  payload: SingleStatementModel;
};

type ActionRequestClosingPending = {
  type: typeof ONBOARDING_REQUEST_CLOSING_PENDING;
};

type ActionRequestClosingSuccess = {
  type: typeof ONBOARDING_REQUEST_CLOSING_SUCCESS;
  payload: SingleStatementModel;
};

type ActionRequestClosingError = {
  type: typeof ONBOARDING_REQUEST_CLOSING_ERROR;
  payload: { error: string };
};

type ActionRequestClosingErrorClear = {
  type: typeof ONBOARDING_REQUEST_CLOSING_ERROR_CLEAR;
};

type OnboardingRequestAction =
  | ActionRequestLoading
  | ActionRequestError
  | ActionRequestSuccess
  | ActionRequestClosingPending
  | ActionRequestClosingSuccess
  | ActionRequestClosingError
  | ActionRequestClosingErrorClear;

type OnboardingRequestState = {
  requestIsLoading: boolean;
  loadingRequestError: string | null;
  requestData: SingleStatementModel | null;

  isClosing: boolean;
  closingSuccess: boolean;
  closingError: string | null;
};

export {
  OnboardingRequestState,
  OnboardingRequestAction,
  SingleStatementModel,
};

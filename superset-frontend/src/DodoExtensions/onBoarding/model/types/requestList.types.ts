export const ONBOARDING_REQUEST_LIST_LOADING =
  'ONBOARDING_REQUEST_LIST_LOADING';
export const ONBOARDING_REQUEST_LIST_SUCCESS =
  'ONBOARDING_REQUEST_LIST_SUCCESS';
export const ONBOARDING_REQUEST_LIST_ERROR = 'ONBOARDING_REQUEST_LIST_ERROR';

type ActionRequestListLoading = {
  type: typeof ONBOARDING_REQUEST_LIST_LOADING;
};

type ActionRequestListError = {
  type: typeof ONBOARDING_REQUEST_LIST_ERROR;
  payload: { error: string };
};

type ActionRequestListSuccessPayload = {
  count: number;
  rows: Array<{
    id: number;
    user: string;
    // firstName: string;
    // lastName: string;
    email: string;
    requestedRoles: string;
    team: string;
    requestDate: Date;
    isClosed: boolean;
  }>;
};

type ActionRequestListSuccess = {
  type: typeof ONBOARDING_REQUEST_LIST_SUCCESS;
  payload: ActionRequestListSuccessPayload;
};

type OnboardingRequestListAction =
  | ActionRequestListLoading
  | ActionRequestListError
  | ActionRequestListSuccess;

type OnboardingRequestListState = {
  isLoading: boolean;
  error: string | null;
  data: ActionRequestListSuccessPayload | null;
};

export {
  OnboardingRequestListState,
  OnboardingRequestListAction,
  ActionRequestListSuccessPayload,
};

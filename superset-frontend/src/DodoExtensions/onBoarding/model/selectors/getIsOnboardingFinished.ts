import { OnboardingStartState } from '../types/start.types';

export const getIsOnboardingFinished = (state: {
  onboardingStart: OnboardingStartState;
}) => state.onboardingStart.isOnboardingFinished;

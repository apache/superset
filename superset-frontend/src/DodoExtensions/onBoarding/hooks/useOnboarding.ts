import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { StepOnePopupDto } from '../components/stepOnePopup/stepOnePopup.dto';

import {
  clearStorageInitialByUser,
  getOnboardingStorageInfo,
  updateStorageTimeOfTheLastShow,
} from '../utils/localStorageUtils';
import { initOnboarding } from '../model/actions/initOnboarding';
import { getIsOnboardingFinished } from '../model/selectors/getIsOnboardingFinished';
import { getOnboardingStartedTime } from '../model/selectors/getOnboardingStartedTime';
import { stepOneFinish } from '../model/actions/stepOneFinish';

// hardcode to stop show onboarding popup

const oneDayPassed = (date?: Date): boolean => false;

// const oneDayPassed = (date?: Date): boolean => {
//   const ONE_DAY_LATER_DISTANCE = 24 * 60 * 60 * 1000;
//
//   if (date) {
//     if (new Date(Number(date) + ONE_DAY_LATER_DISTANCE) >= new Date()) {
//       return false;
//     }
//   }
//   return true;
// };

export const useOnboarding = () => {
  const [step, setStep] = useState<number | null>(null);

  const step2PassedRef = useRef<null | boolean>();

  const dispatch = useDispatch();
  const isOnboardingFinished = useSelector(getIsOnboardingFinished);
  const onboardingStartedTime = useSelector(getOnboardingStartedTime);

  const storageInfo = getOnboardingStorageInfo();

  useEffect(() => {
    dispatch(initOnboarding());
  }, [dispatch]);

  if (isOnboardingFinished) {
    if (step2PassedRef.current) {
      if (step !== 3) {
        setStep(3);
      }
    } else if (step !== null) {
      setStep(null);
    }
  } else if (onboardingStartedTime) {
    if (
      oneDayPassed(storageInfo.theTimeOfTheLastShow) ||
      storageInfo.initialByUser
    ) {
      if (step !== 2) {
        setStep(2);
      }
    }
  } else if (
    oneDayPassed(storageInfo.theTimeOfTheLastShow) ||
    storageInfo.initialByUser
  ) {
    if (step === null) {
      setStep(1);
    }
  }

  const closeOnboarding = useCallback(() => {
    updateStorageTimeOfTheLastShow();
    clearStorageInitialByUser();
    setStep(null);
  }, []);

  const toStepTwo = async (stepOneDto: StepOnePopupDto) => {
    dispatch(stepOneFinish(stepOneDto.DodoRole));
  };

  const setStep2Passed = useCallback(() => {
    step2PassedRef.current = true;
  }, []);

  const setStep3Passed = useCallback(() => {
    step2PassedRef.current = null;
    setStep(null);
  }, []);

  return {
    step,
    closeOnboarding,
    toStepTwo,
    setStep2Passed,
    setStep3Passed,
  };
};

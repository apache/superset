import { OnBoardingStorageInfo } from '../types';
import { ONBOARDING_LOCAL_STORAGE_KEY } from '../consts';

export const getOnboardingStorageInfo: () => OnBoardingStorageInfo = () => {
  const fromStorage = localStorage.getItem(ONBOARDING_LOCAL_STORAGE_KEY);

  if (fromStorage) {
    const info: OnBoardingStorageInfo = JSON.parse(
      fromStorage,
      (key: string, value: any) => {
        if (key === 'theTimeOfTheLastShow') {
          return new Date(value);
        }
        return value;
      },
    );

    return info;
  }

  return {
    theTimeOfTheLastShow: undefined,
    initialByUser: false,
  };
};

export const updateStorageTimeOfTheLastShow = () => {
  const info: OnBoardingStorageInfo = {
    theTimeOfTheLastShow: new Date(),
    initialByUser: false,
  };

  localStorage.setItem(ONBOARDING_LOCAL_STORAGE_KEY, JSON.stringify(info));
};

export const clearOnboardingStorageInfo = () => {
  localStorage.removeItem(ONBOARDING_LOCAL_STORAGE_KEY);
};

export const clearStorageInitialByUser = () => {
  const { theTimeOfTheLastShow } = getOnboardingStorageInfo();

  if (theTimeOfTheLastShow)
    localStorage.setItem(
      ONBOARDING_LOCAL_STORAGE_KEY,
      JSON.stringify({ theTimeOfTheLastShow }),
    );
  else localStorage.removeItem(ONBOARDING_LOCAL_STORAGE_KEY);
};

export const setInitByUserStorageInfo = () => {
  const info: OnBoardingStorageInfo = {
    initialByUser: true,
  };

  localStorage.setItem(ONBOARDING_LOCAL_STORAGE_KEY, JSON.stringify(info));
};

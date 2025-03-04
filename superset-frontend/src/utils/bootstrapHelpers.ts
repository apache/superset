// DODO was here
// DODO created 44611022
import { Locale } from '@superset-ui/core';
import { BootstrapData } from 'src/types/bootstrapTypes';

const isStandalone = process.env.type === undefined;

// TODO: DODO: duplicated logic in src/Superstructure/store.ts
function getPageLanguage(): string | null {
  if (!document) {
    return null;
  }
  const select: HTMLSelectElement | null = document.querySelector(
    '#changeLanguage select',
  );
  const selectedLanguage = select ? select.value : null;
  return selectedLanguage;
}

const getLocaleForSuperset = () => {
  const dodoisLanguage = getPageLanguage();
  if (dodoisLanguage) {
    if (dodoisLanguage === 'ru-RU') return 'ru';
    return 'en';
  }
  return 'ru';
};

export const redefineLocale = (data: BootstrapData): BootstrapData => {
  let finalLanguage: Locale = 'ru';
  const temp = data?.common?.language_pack?.locale_data?.superset;
  // Checking if it is a plugin, then getting language from a #changeLanguage select in DODOIS
  if (isStandalone) {
    const { lang } = temp[''] || null;
    finalLanguage = lang;
  } else {
    finalLanguage = getLocaleForSuperset();
  }

  return {
    ...data,
    common: {
      ...data?.common,
      locale: finalLanguage,
    },
  };
};

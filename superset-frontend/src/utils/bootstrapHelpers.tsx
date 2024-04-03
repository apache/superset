import { BootstrapData } from 'src/types/bootstrapTypes';

export const redefineLocale = (data: BootstrapData) => {
  const temp = data?.common?.language_pack?.locale_data?.superset;
  const { lang } = temp[''] || null;
  return {
    ...data,
    common: {
      ...data?.common,
      locale: lang,
    },
  };
};

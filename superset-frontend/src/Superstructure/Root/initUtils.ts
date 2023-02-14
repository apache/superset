import { GET_TOKEN_AND_CSRF, GET_CSRF } from 'src/Superstructure/api/init';

import { MicrofrontendParams } from 'src/Superstructure/types/global';

type INITIALIZE_RESPONSE = {
  loaded: boolean;
  error: boolean;
  errorMsg: string;
};

const composed = ({
  loaded,
  name,
  errorParams,
}: {
  loaded: boolean;
  name: string;
  errorParams?: string;
}): INITIALIZE_RESPONSE => {
  if (loaded) return { loaded: true, error: false, errorMsg: '' };
  const errorMsg = `${
    errorParams
      ? errorParams.toString().split('Error: Error:').join('Error:')
      : `Unexpected Error [ ${name} ]`
  } [ ${name} ]`;

  return {
    loaded: false,
    error: true,
    errorMsg,
  };
};

const initializeAuth = async (
  params: MicrofrontendParams,
): Promise<INITIALIZE_RESPONSE> => {
  if (process.env.WEBPACK_MODE === 'development') {
    try {
      const initResponse = await GET_TOKEN_AND_CSRF(params.token || '');

      if (initResponse?.csrf && initResponse?.token) {
        return composed({ loaded: true, name: 'GET_TOKEN_AND_CSRF' });
      }
      return composed({
        loaded: false,
        name: 'GET_TOKEN_AND_CSRF',
        errorParams: 'did not return csrf and|or token',
      });
    } catch (error) {
      return composed({
        loaded: false,
        name: 'GET_TOKEN_AND_CSRF',
        errorParams: error,
      });
    }
  } else if (process.env.WEBPACK_MODE === 'production') {
    try {
      const initResponse = await GET_CSRF({ useAuth: false });

      if (initResponse?.csrf) {
        return composed({ loaded: true, name: 'GET_CSRF' });
      }
      return composed({
        loaded: false,
        name: 'GET_CSRF',
        errorParams: 'did not return csrf',
      });
    } catch (error) {
      return composed({
        loaded: false,
        name: 'GET_CSRF',
        errorParams: error,
      });
    }
  }
  // process.env.WEBPACK_MODE === 'none'
  try {
    const initResponse = await GET_TOKEN_AND_CSRF(params.token || '');

    if (initResponse?.csrf && initResponse?.token) {
      return composed({ loaded: true, name: 'GET_TOKEN_AND_CSRF' });
    }
    return composed({
      loaded: false,
      name: 'GET_TOKEN_AND_CSRF',
      errorParams: 'did not return csrf and|or token',
    });
  } catch (error) {
    return composed({
      loaded: false,
      name: 'GET_TOKEN_AND_CSRF',
      errorParams: error,
    });
  }
};

export { initializeAuth };

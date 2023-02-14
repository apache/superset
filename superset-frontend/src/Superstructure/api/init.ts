import { API_HANDLER } from 'src/Superstructure/api';

export const GET_TOKEN_AND_CSRF = async (definedToken?: string) => {
  try {
    let token = '';

    if (!definedToken) {
      const authResponse = await API_HANDLER.authanticateInDodoInner();
      token = authResponse.access_token;
    } else {
      token = definedToken;
    }

    if (token) {
      const csrfResponse = await API_HANDLER.getCSRFToken({ useAuth: true });
      const csrf = csrfResponse.result;
      if (csrf) return { csrf, token };
      return null;
    }
    return null;
  } catch (error) {
    throw new Error(error);
  }
};

export const GET_CSRF = async ({ useAuth = false }: { useAuth: boolean }) => {
  try {
    const csrfResponse = await API_HANDLER.getCSRFToken({ useAuth });
    const csrf = csrfResponse.result;
    if (csrf) return { csrf };
    return null;
  } catch (error) {
    throw new Error(error);
  }
};

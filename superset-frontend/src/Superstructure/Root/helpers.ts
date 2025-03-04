import { AxiosError } from 'axios';
import { CustomErrorObject, InitializedResponse } from '../types/global';

const addSlash = (baseName?: string) => {
  if (!baseName) return '/';
  if (baseName[baseName.length - 1] === '/') return baseName;
  return `${baseName}/`;
};

const logConfigs = (
  CONFIG: Record<string, any>,
  incomingParams: Record<string, any>,
  params: Record<string, any>,
) => {
  console.groupCollapsed('CONFIGS:');
  console.log('\n');
  console.log('Initial =>', CONFIG);
  console.log('Incoming =>', incomingParams);
  console.log('\n');
  console.log('Used Config:');
  console.log(params);
  console.groupEnd();
};

const parseInitResponse = <T>({
  loaded,
  title,
  stackTrace,
  data,
  errorMsg,
  isCustomError,
}: CustomErrorObject<T>): InitializedResponse<T> => {
  if (loaded) {
    return {
      loaded: true,
      data,
      title,
      stackTrace,
    };
  }

  let errMsg = '';

  if (errorMsg) {
    errMsg = isCustomError
      ? errorMsg
      : errorMsg.toString().split('Error: Error:').join('Error:');
  } else {
    errMsg = `Unexpected Error (${title}) [ ${stackTrace} ]`;
  }

  return {
    loaded: false,
    error: errMsg,
    data,
    title,
    stackTrace,
  };
};

const handleAxiosError = ({
  response,
  errorObject,
}: {
  response: AxiosError;
  errorObject: Record<string, any>;
}) => {
  const { message, name } = response;

  return parseInitResponse<null>({
    loaded: false,
    errorMsg: message,
    title: errorObject.CONFIG.title,
    stackTrace: name,
    data: null,
  });
};

const handleCorrectCaseReturn = <T>({
  response,
  errorObject,
}: {
  response: T;
  errorObject: Record<string, any>;
}) =>
  parseInitResponse<T>({
    loaded: true,
    title: errorObject.CONFIG.title,
    stackTrace: errorObject.CONFIG.stackTrace,
    data: response,
  });

const handleDefaultCaseReturn = ({
  errorObject,
  errorMessage,
}: {
  errorObject: Record<string, any>;
  errorMessage: string;
}) =>
  parseInitResponse<null>({
    loaded: false,
    title: errorObject.CONFIG.title,
    stackTrace: errorObject.CONFIG.stackTrace,
    errorMsg: errorObject[errorMessage],
    isCustomError: true,
    data: null,
  });

export {
  handleDefaultCaseReturn,
  handleCorrectCaseReturn,
  handleAxiosError,
  logConfigs,
  addSlash,
};

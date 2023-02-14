import {
  AVAILABLE_BUSINESSES,
  DEV_WITH_BUSINESSES,
  PROD_WITH_BUSINESSES,
} from '../destinations';

const serializeValue = (val: string | undefined) =>
  val ? val.toLowerCase() : '';

const getErrMsg = (configName: string, configCheck: string, envCheck: string) =>
  `The ${configName} configuration [${configCheck}] is not available on ${envCheck}"`;

const validateExtras = (
  env: string,
  extra: string,
  CONFIGURATION: Record<string, any>,
) => {
  const serializedExtra = serializeValue(extra);

  const { AVAILABLE_EXTRA } = CONFIGURATION;
  if (AVAILABLE_EXTRA.includes(serializedExtra)) {
    return serializeValue(serializedExtra);
  }

  throw new Error(getErrMsg('EXTRA', serializedExtra, env));
};

const validateRoles = (
  env: string,
  role: string,
  CONFIGURATION: Record<string, any>,
) => {
  const serializedRole = serializeValue(role);

  const { AVAILABLE_ROLES } = CONFIGURATION;

  if (AVAILABLE_ROLES.includes(serializedRole)) {
    return serializedRole;
  }
  throw new Error(getErrMsg('ROLE', serializedRole, env));
};

const validateBusiness = (
  env: string,
  business: string,
  AVAILABLE_BUSINESSES: string[],
) => {
  const serializedBusiness = serializeValue(business);

  if (AVAILABLE_BUSINESSES.includes(serializedBusiness)) {
    return serializedBusiness;
  }

  throw new Error(getErrMsg('BUSINESS', serializedBusiness, env));
};

const validateConfig = (
  ENVIRONMENT_CHECK: string,
  BUSINESS_CHECK: string,
  ROLE_CHECK: string,
  EXTRA_CHECK: string,
) => {
  let ENVIRONMENT = '';
  let BUSINESS = '';
  let ROLE = '';
  let EXTRA = '';
  let COMMON_DASHBOARDS_WITH_BUSINESS = null;
  let MAIN_MENU_HELPER_WITH_BUSINESS = null;
  let FINAL_CONFIGURATION_WITH_BUSINESS = null;

  const env = serializeValue(ENVIRONMENT_CHECK);

  if (env === 'dev') {
    ENVIRONMENT = 'development';
  } else if (env === 'prod') {
    ENVIRONMENT = 'production';
  } else {
    throw new Error (`Unknown env [${env}]`)
  }

  BUSINESS = validateBusiness(env, BUSINESS_CHECK, AVAILABLE_BUSINESSES);

  if (BUSINESS) {
    try {
      const businessConfig =
        ENVIRONMENT === 'development'
          ? DEV_WITH_BUSINESSES[BUSINESS]
          : PROD_WITH_BUSINESSES[BUSINESS];

      if (businessConfig) {
        ROLE = validateRoles(env, ROLE_CHECK, businessConfig);

        if (ROLE) {
          EXTRA = validateExtras(env, EXTRA_CHECK, businessConfig);
          if (EXTRA) {
            COMMON_DASHBOARDS_WITH_BUSINESS = businessConfig.COMMON_DASHBOARDS;

            MAIN_MENU_HELPER_WITH_BUSINESS = businessConfig.MAIN_MENU_HELPER;
            FINAL_CONFIGURATION_WITH_BUSINESS = businessConfig.CONFIGURATION;
          } else {
            console.error(env, 'EXTRA ERROR', EXTRA);
          }
        } else {
          console.error(env, 'ROLE ERROR', ROLE);
        }
      } else {
        console.error(env, 'businessConfig ERROR', businessConfig);
      }
    } catch (error) {
      console.error('There was an error validating config', error);
    }
  } else {
    console.error(env, 'BUSINESS ERROR', BUSINESS);
  }

  if (
    ENVIRONMENT &&
    BUSINESS &&
    ROLE &&
    EXTRA &&
    COMMON_DASHBOARDS_WITH_BUSINESS &&
    MAIN_MENU_HELPER_WITH_BUSINESS &&
    FINAL_CONFIGURATION_WITH_BUSINESS
  ) {
    return {
      ENVIRONMENT,
      BUSINESS,
      ROLE,
      EXTRA,
      COMMON_DASHBOARDS: COMMON_DASHBOARDS_WITH_BUSINESS,
      MAIN_MENU_HELPER: MAIN_MENU_HELPER_WITH_BUSINESS,
      FINAL_CONFIGURATION: FINAL_CONFIGURATION_WITH_BUSINESS,
    };
  }

  throw new Error(`There was a problem in validateConfig. One or more params are not correct:
  [${ENVIRONMENT}], [${BUSINESS}], [${ROLE}], [${EXTRA}]`);
};

export { validateConfig, serializeValue };

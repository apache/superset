import { isEveryElementDefined, isDefined } from '../typeGuards/Base';

/**
 * Combine two continuous domain and ensure that the output
 * does not go beyond fixedDomain
 * @param userSpecifiedDomain
 * @param dataDomain
 */
export default function combineContinuousDomains(
  userSpecifiedDomain: (number | Date | null | undefined)[],
  dataDomain?: (number | Date)[],
) {
  if (userSpecifiedDomain.length > 0 && isEveryElementDefined(userSpecifiedDomain)) {
    return userSpecifiedDomain;
  } else if (dataDomain) {
    if (
      userSpecifiedDomain.length === 2 &&
      dataDomain.length === 2 &&
      userSpecifiedDomain.filter(isDefined).length > 0
    ) {
      const [userSpecifiedMin, userSpecifiedMax] = userSpecifiedDomain;
      const [dataMin, dataMax] = dataDomain;
      let min = dataMin;
      if (isDefined(userSpecifiedMin)) {
        min = userSpecifiedMin.valueOf() > dataMin.valueOf() ? userSpecifiedMin : dataMin;
      }
      let max = dataMax;
      if (isDefined(userSpecifiedMax)) {
        max = userSpecifiedMax.valueOf() < dataMax.valueOf() ? userSpecifiedMax : dataMax;
      }

      return [min, max];
    }

    return dataDomain;
  }

  return undefined;
}

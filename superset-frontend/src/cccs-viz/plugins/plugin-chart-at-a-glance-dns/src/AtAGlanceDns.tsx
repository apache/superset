import { QueryFormData } from '@superset-ui/core';
import React, { useState } from 'react';

const DEFAULT_IP_STRING = '1.1.1.1';
const IP_STRING = 'ip_string';

const setInitialIpString = (adhocFilters: any) => {
  let ipString: string = DEFAULT_IP_STRING;
  if (adhocFilters instanceof Array && adhocFilters.length > 0) {
    const adhocFilter = adhocFilters[0];
    if (
      adhocFilter.comparator instanceof Array &&
      adhocFilter.comparator.length > 0
    ) {
      ipString = adhocFilter.comparator[0];
    } else if (adhocFilter.comparator instanceof String) {
      ipString = adhocFilter.comparator;
    }
  }
  return ipString;
};

const getHostnames = (payload: any) => {
  let resultset = [];
  if (payload !== null && payload instanceof Array) {
    resultset = payload.map((a: { rrname: any }) => a.rrname);
  }
  const uniqueSet = new Set(resultset);
  return [...uniqueSet];
};

const AtAGlanceCoreDns = (initialFormData: QueryFormData) => {
  const [ipString, setIpString] = useState(
    setInitialIpString(initialFormData.formData.adhocFilters),
  );
  const [displayData, setDisplayData] = useState(initialFormData.data);

  for (
    let i = 0;
    i < initialFormData.formData?.extraFormData?.filters?.length;
    // eslint-disable-next-line no-plusplus
    i++
  ) {
    const filter = initialFormData.formData.extraFormData.filters[i];
    if (filter.col === IP_STRING) {
      const localIp: string = filter.val[0];
      if (localIp !== ipString) {
        setIpString(localIp);
        setDisplayData(initialFormData.data);
      }
      break;
    }
  }
  return (
    <>
      {
      ipString.includes('/') ?
        <> 
          <span>DNS At A Glance chart not avialable for CIDR ranges. Please input a single IP address to use this chart.</span>
        </>
        :
        <div>
          <table className="table table-striped table-condensed">
            <tbody>
              {getHostnames(displayData).map((hostname: string) => (
                <tr>
                  <td>{hostname}</td>
                </tr>
              ))}
            </tbody>
            <tfoot />
          </table>
      </div>
      }
    </>
  );
};

export default AtAGlanceCoreDns;

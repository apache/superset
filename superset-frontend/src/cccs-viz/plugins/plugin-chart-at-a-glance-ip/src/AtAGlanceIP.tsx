import React, { useState } from 'react';
import { RiGlobalFill } from 'react-icons/ri';
import { QueryFormData } from '@superset-ui/core';
// import styles from './styles';

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

// Main Component
const AtAGlanceCoreIp = (initialFormData: QueryFormData) => {
  /**
   * The initialFormData is very much tightly coupled with the dataset it is
   * assigned to.  This might need a revisit.
   */
  const [ipString, setIpString] = useState(
    setInitialIpString(initialFormData.formData.adhocFilters),
  );
  const [displayData, setDisplayData] = useState(initialFormData.data[0]);
  const [decimalDisplayData, setDecimalDisplayData] = useState(
    `${displayData.start_ip_int} - ${displayData.end_ip_int}`,
  );

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
        setDisplayData(initialFormData.data[0]);
        setDecimalDisplayData(
          `${initialFormData.data[0].start_ip_int} - ` +
            `${initialFormData.data[0].end_ip_int}`,
        );
      }
      break;
    }
  }

  return (
    <>
      <div>
        <RiGlobalFill />
        <span>At a Glance</span>
      </div>
      <div>
        <table>
          <tr>
            <td> IP: {ipString}</td>
          </tr>
          <tr>
            <td>ASN: {displayData.asn}</td>
          </tr>
          <tr>
            <td>CARRIER: {displayData.carrier}</td>
          </tr>
          <tr>
            <td>CONNECTION TYPE: {displayData.connectionType}</td>
          </tr>
          <tr>
            <td>ORGANIZATION: {displayData.organization}</td>
          </tr>
          <tr>
            <td>CITY: {displayData.city}</td>
          </tr>
          <tr>
            <td>COUNTRY: {displayData.country}</td>
          </tr>
          <tr>
            <td>DECIMAL: {decimalDisplayData}</td>
          </tr>
        </table>
      </div>
    </>
  );
};

export default AtAGlanceCoreIp;

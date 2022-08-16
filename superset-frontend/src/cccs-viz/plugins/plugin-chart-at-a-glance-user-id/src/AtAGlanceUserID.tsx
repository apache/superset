import React, { useEffect, useState } from 'react';
import { QueryFormData } from '@superset-ui/core';
import Collapse from 'src/components/Collapse';
import { AgGridReact } from '@ag-grid-community/react';
import { LicenseManager, AllModules } from '@ag-grid-enterprise/all-modules';
import styles from './styles';

// eslint-disable-next-line import/no-extraneous-dependencies
import '@ag-grid-community/core/dist/styles/ag-theme-balham.css';

type AtAGlanceUserIDProps = QueryFormData & {
  ipDashboardId: string;
  ipDashboardFilterId: string;
  ipDashBoardBaseUrl: string;
};

const generateClientIpLinksList = (columnDefs: any, rowData: any) => (
  <div className="ag-theme-balham">
    <AgGridReact
      modules={AllModules}
      rowData={rowData}
      columnDefs={columnDefs}
      domLayout="autoHeight"
    />
  </div>
);

/**
 *   getPayloadField:
 *     description: Returns the value for a given field.
 *     parameters:
 *       - name: field
 *       - type: string
 *       - required: true
 *       - description: name of the field you want to get the value of
 *
 *       - name: payload
 *       - type: any
 *       - required: true
 *       - description: data object containing the response from the server.
 *     returns:
 *       value:
 *         description: Returns the value of the given field if found.
 */
const getPayloadField = (field: string, payload: any) => {
  let value = '';
  try {
    if (payload !== undefined) {
      value = payload[field];
      if (value === null) {
        value = 'Unknown';
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(e);
    value = 'Something went wrong';
    // This will be caught by supersets default error handling that wraps and will display this message the the user
    throw new Error(
      'Error fetching values from dataset. This may be caused by having this viz on the incorrect dataset.',
    );
  }

  return value;
};

const formatList = (ipList: any) => {
  const updatedList: {
    'IP Address': string;
    Count: number;
    'User Email': string;
  }[] = [];
  const ipDictionary = {};
  let counter = 0;

  ipList.forEach(function (obj: any) {
    const key = `${JSON.stringify(obj.client_ip)},${JSON.stringify(
      obj.user_id,
    )}`;
    ipDictionary[key] = (ipDictionary[key] || 0) + 1;
    counter += 1;
  });

  Object.keys(ipDictionary).forEach(key => {
    updatedList.push({
      'IP Address': key.split(',')[0].replaceAll('"', ''),
      Count: ipDictionary[key],
      'User Email': key.split(',')[1].replaceAll('"', ''),
    });
  });

  return [updatedList, counter];
};

const ipToInt = (ip: any) =>
  ip.split('.').reduce((int: any, v: any) => int * 256 + +v);

// Main Component
function AtAGlanceUserIDCore(props: AtAGlanceUserIDProps) {
  LicenseManager.setLicenseKey(props.agGridLicenseKey);

  const [columnDefs] = useState([
    {
      field: 'IP Address',
      flex: 1,
      resizable: true,
      sortable: true,
      cellRenderer(params: any) {
        const ipData = params.data['IP Address'];
        const newLink = `<a href=${props.ipDashBoardBaseUrl}/superset/dashboard/${props.ipDashboardId}/?native_filters=%28NATIVE_FILTER-${props.ipDashboardFilterId}%3A%28__cache%3A%28label%3A'${ipData}'%2CvalidateStatus%3A%21f%2Cvalue%3A%21%28'${ipData}'%29%29%2CextraFormData%3A%28filters%3A%21%28%28col%3Aip_string%2Cop%3AIN%2Cval%3A%21%28'${ipData}'%29%29%29%29%2CfilterState%3A%28label%3A'${ipData}'%2CvalidateStatus%3A%21f%2Cvalue%3A%21%28'${ipData}'%29%29%2Cid%3ANATIVE_FILTER-${props.ipDashboardFilterId}%2CownState%3A%28%29%29%29 target="_blank">${ipData}</a>`;

        return newLink;
      },
      comparator: (
        valueA: any,
        valueB: any,
        nodeA: any,
        nodeB: any,
        isInverted: any,
      ) => {
        if (valueA === valueB) return 0;
        return ipToInt(valueA) > ipToInt(valueB) ? 1 : -1;
      },
    },
    {
      field: 'Count',
      flex: 1,
      resizable: true,
      sortable: true,
      sort: 'desc',
    },
    {
      field: 'User Email',
      flex: 1,
      resizable: true,
      sortable: true,
      minWidth: 275,
    },
  ]);

  const [canadianIpsListData, setCanadianIpsListData] = useState([{}]);
  const [nonCanadianIpsListData, setNonCanadianIpsListData] = useState([{}]);
  const [unsuccessfulCanadianIpsListData, setUnsuccessfulCanadianIpsListData] =
    useState([{}]);
  const [
    unsuccessfulNonCanadianIpsListData,
    setUnsuccessfulNonCanadianIpsListData,
  ] = useState([{}]);

  useEffect(() => {
    let canadianIpsList: any[] = [];
    let nonCanadianIpsList: any[] = [];
    let unsuccessfulCanadianIpsList: any[] = [];
    let unsuccessfulNonCanadianIpsList: any[] = [];

    const COUNTRY_NAME_FIELD = 'client_ip_cbs_geo_country_name';
    const CANADA = 'canada';
    const OPERATION = 'operation';
    const USER_LOGGED_IN = 'UserLoggedIn';

    // eslint-disable-next-line react-hooks/exhaustive-deps
    canadianIpsList = props.data.filter(function (item: any) {
      return (
        getPayloadField(COUNTRY_NAME_FIELD, item) === CANADA &&
        getPayloadField(OPERATION, item) === USER_LOGGED_IN
      );
    });

    setCanadianIpsListData(formatList(canadianIpsList));

    // eslint-disable-next-line react-hooks/exhaustive-deps
    nonCanadianIpsList = props.data.filter(function (item: any) {
      return (
        getPayloadField(COUNTRY_NAME_FIELD, item) !== CANADA &&
        getPayloadField(OPERATION, item) === USER_LOGGED_IN
      );
    });

    setNonCanadianIpsListData(formatList(nonCanadianIpsList));

    // eslint-disable-next-line react-hooks/exhaustive-deps
    unsuccessfulCanadianIpsList = props.data.filter(function (item: any) {
      return (
        getPayloadField(COUNTRY_NAME_FIELD, item) === CANADA &&
        getPayloadField(OPERATION, item) !== USER_LOGGED_IN
      );
    });

    setUnsuccessfulCanadianIpsListData(formatList(unsuccessfulCanadianIpsList));

    // eslint-disable-next-line react-hooks/exhaustive-deps
    unsuccessfulNonCanadianIpsList = props.data.filter(function (item: any) {
      return (
        getPayloadField(COUNTRY_NAME_FIELD, item) !== CANADA &&
        getPayloadField(OPERATION, item) !== USER_LOGGED_IN
      );
    });

    setUnsuccessfulNonCanadianIpsListData(
      formatList(unsuccessfulNonCanadianIpsList),
    );
  }, [props.data]);

  return (
    <div style={styles.AtAGlance}>
      <div>
        <table style={styles.Table}>
          <tr>
            <td>*This chart only contains the first 1000 results*</td>
          </tr>
        </table>
      </div>
      <div>
        <table style={styles.Table}>
          <tr>
            <Collapse bordered expandIconPosition="left" ghost>
              <Collapse.Panel
                header={
                  <span className="header">
                    {' '}
                    Number of successful Canadian login attempts:{' '}
                    {canadianIpsListData[1]}{' '}
                  </span>
                }
                key="1"
              >
                {generateClientIpLinksList(columnDefs, canadianIpsListData[0])}
              </Collapse.Panel>
              <Collapse.Panel
                header={
                  <span className="header">
                    {' '}
                    Number of successful non-Canadian login attempts:{' '}
                    {nonCanadianIpsListData[1]}{' '}
                  </span>
                }
                key="2"
              >
                {generateClientIpLinksList(
                  columnDefs,
                  nonCanadianIpsListData[0],
                )}
              </Collapse.Panel>
              <Collapse.Panel
                header={
                  <span className="header">
                    {' '}
                    Number of unsuccessful Canadian login attempts:{' '}
                    {unsuccessfulCanadianIpsListData[1]}{' '}
                  </span>
                }
                key="3"
              >
                {generateClientIpLinksList(
                  columnDefs,
                  unsuccessfulCanadianIpsListData[0],
                )}
              </Collapse.Panel>
              <Collapse.Panel
                header={
                  <span className="header">
                    {' '}
                    Number of unsuccessful non-Canadian login attempts:{' '}
                    {unsuccessfulNonCanadianIpsListData[1]}{' '}
                  </span>
                }
                key="4"
              >
                {generateClientIpLinksList(
                  columnDefs,
                  unsuccessfulNonCanadianIpsListData[0],
                )}
              </Collapse.Panel>
            </Collapse>
          </tr>
        </table>
      </div>
    </div>
  );
}

export default AtAGlanceUserIDCore;

import React, { useEffect, useState } from 'react';
import { QueryFormData } from '@superset-ui/core';
import Collapse from 'src/components/Collapse';
import { AgGridReact } from '@ag-grid-community/react';
import styles from './styles';

import '@ag-grid-community/core/dist/styles/ag-theme-balham.css';

type DataManager = {
  data: any[];
  isInit: boolean;
  isLoading: boolean;
  isError: boolean;
};

type AtAGlanceUserIDProps = QueryFormData & {
  ipDashboardId: string;
  ipDashboardFilterId: string;
  ipDashBoardBaseUrl: string;
};

const generateClientIpLinksList = (columnDefs: any, rowData: any) => (
  <div className="ag-theme-balham">
    <AgGridReact
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
  const updatedList: { 'IP Address': string; Count: number }[] = [];
  const ipDictionary = {};
  let counter = 0;

  ipList.forEach(function (obj: any) {
    const key = JSON.stringify(obj.client_ip);
    ipDictionary[key] = (ipDictionary[key] || 0) + 1;
    counter += 1;
  });

  Object.keys(ipDictionary).forEach(key => {
    updatedList.push({
      'IP Address': key.replaceAll('"', ''),
      Count: ipDictionary[key],
    });
  });

  return [updatedList, counter];
};

// Main Component
function AtAGlanceUserIDCore(props: AtAGlanceUserIDProps) {
  const [userIDString, setUserIDString] = useState('user@domain.invalid,');

  const [columnDefs] = useState([
    {
      field: 'IP Address',
      sortable: true,
      cellRenderer(params: any) {
        const ipData = params.data['IP Address'];
        const newLink = `<a href=${props.ipDashBoardBaseUrl}/superset/dashboard/${props.ipDashboardId}/?native_filters=%28NATIVE_FILTER-${props.ipDashboardFilterId}%3A%28__cache%3A%28label%3A'${ipData}'%2CvalidateStatus%3A%21f%2Cvalue%3A%21%28'${ipData}'%29%29%2CextraFormData%3A%28filters%3A%21%28%28col%3Aip_string%2Cop%3AIN%2Cval%3A%21%28'${ipData}'%29%29%29%29%2CfilterState%3A%28label%3A'${ipData}'%2CvalidateStatus%3A%21f%2Cvalue%3A%21%28'${ipData}'%29%29%2Cid%3ANATIVE_FILTER-${props.ipDashboardFilterId}%2CownState%3A%28%29%29%29 target="_blank">${ipData}</a>`;

        return newLink;
      },
    },
    { field: 'Count', sortable: true },
  ]);
  const [canadianIpsListData, setCanadianIpsListData] = useState([{}]);
  const [nonCanadianIpsListData, setNonCanadianIpsListData] = useState([{}]);
  const [
    unsuccessfulCanadianIpsListData,
    setUnsuccessfulCanadianIpsListData,
  ] = useState([{}]);
  const [
    unsuccessfulNonCanadianIpsListData,
    setUnsuccessfulNonCanadianIpsListData,
  ] = useState([{}]);

  const [aadDataManager, setAadDataManger] = useState<DataManager>({
    data: props.data,
    isInit: false,
    isLoading: false,
    isError: false,
  });

  let hasFiltered = false;

  for (
    let i = 0;
    i < props.formData?.extraFormData?.filters?.length;
    // eslint-disable-next-line no-plusplus
    i++
  ) {
    const filter = props.formData.extraFormData.filters[i];
    if (filter.col === 'user_id') {
      const localUserId: string = filter.val[0];
      if (localUserId !== userIDString) {
        setAadDataManger({
          ...aadDataManager,
          data: props.data,
        });
        setUserIDString(localUserId);
        hasFiltered = false;
      }
      break;
    }
  }

  useEffect(() => {
    let canadianIpsList: any[] = [];
    let nonCanadianIpsList: any[] = [];
    let unsuccessfulCanadianIpsList: any[] = [];
    let unsuccessfulNonCanadianIpsList: any[] = [];

    const COUNTRY_NAME_FIELD = 'client_ip_cbs_geo_country_name';
    const CANADA = 'canada';
    const OPERATION = 'operation';
    const USER_LOGGED_IN = 'UserLoggedIn';

    if (
      !aadDataManager.isLoading ||
      (aadDataManager.isInit && hasFiltered === false)
    ) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      canadianIpsList = aadDataManager.data.filter(function (item) {
        return (
          getPayloadField(COUNTRY_NAME_FIELD, item) === CANADA &&
          getPayloadField(OPERATION, item) === USER_LOGGED_IN
        );
      });

      setCanadianIpsListData(formatList(canadianIpsList));

      // eslint-disable-next-line react-hooks/exhaustive-deps
      nonCanadianIpsList = aadDataManager.data.filter(function (item) {
        return (
          getPayloadField(COUNTRY_NAME_FIELD, item) !== CANADA &&
          getPayloadField(OPERATION, item) === USER_LOGGED_IN
        );
      });

      setNonCanadianIpsListData(formatList(nonCanadianIpsList));

      // eslint-disable-next-line react-hooks/exhaustive-deps
      unsuccessfulCanadianIpsList = aadDataManager.data.filter(function (item) {
        return (
          getPayloadField(COUNTRY_NAME_FIELD, item) === CANADA &&
          getPayloadField(OPERATION, item) !== USER_LOGGED_IN
        );
      });

      setUnsuccessfulCanadianIpsListData(
        formatList(unsuccessfulCanadianIpsList),
      );

      // eslint-disable-next-line react-hooks/exhaustive-deps
      unsuccessfulNonCanadianIpsList = aadDataManager.data.filter(function (
        item,
      ) {
        return (
          getPayloadField(COUNTRY_NAME_FIELD, item) !== CANADA &&
          getPayloadField(OPERATION, item) !== USER_LOGGED_IN
        );
      });

      setUnsuccessfulNonCanadianIpsListData(
        formatList(unsuccessfulNonCanadianIpsList),
      );

      hasFiltered = true;
    }
  }, [aadDataManager]);

  return (
    <div style={styles.AtAGlance}>
      <div>
        <table style={styles.Table}>
          <tr>
            <td>
              **Please note that the results in this chart are only for the
              first User Email**
            </td>
          </tr>
          <tr>
            <td>User Email: {userIDString}</td>
          </tr>
          <tr>
            <td>
              User ID:{' '}
              {aadDataManager.isLoading
                ? 'Loading'
                : getPayloadField('user_key', aadDataManager.data[0])}
            </td>
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
                    Number of Successful Canadian Login Attempts:{' '}
                    {aadDataManager.isLoading
                      ? 'Loading'
                      : canadianIpsListData[1]}{' '}
                  </span>
                }
                key="1"
              >
                {aadDataManager.isLoading && !aadDataManager.isInit ? (
                  <></>
                ) : (
                  generateClientIpLinksList(columnDefs, canadianIpsListData[0])
                )}
              </Collapse.Panel>
              <Collapse.Panel
                header={
                  <span className="header">
                    {' '}
                    Number of Successful non Canadian Login Attempts:{' '}
                    {aadDataManager.isLoading
                      ? 'Loading'
                      : nonCanadianIpsListData[1]}{' '}
                  </span>
                }
                key="2"
              >
                {aadDataManager.isLoading && !aadDataManager.isInit ? (
                  <></>
                ) : (
                  generateClientIpLinksList(
                    columnDefs,
                    nonCanadianIpsListData[0],
                  )
                )}
              </Collapse.Panel>
              <Collapse.Panel
                header={
                  <span className="header">
                    {' '}
                    Number of Unsuccessful Canadian Login Attempts:{' '}
                    {aadDataManager.isLoading
                      ? 'Loading'
                      : unsuccessfulCanadianIpsListData[1]}{' '}
                  </span>
                }
                key="3"
              >
                {aadDataManager.isLoading && !aadDataManager.isInit ? (
                  <></>
                ) : (
                  generateClientIpLinksList(
                    columnDefs,
                    unsuccessfulCanadianIpsListData[0],
                  )
                )}
              </Collapse.Panel>
              <Collapse.Panel
                header={
                  <span className="header">
                    {' '}
                    Number of Unsuccessful non Canadian Login Attempts:{' '}
                    {aadDataManager.isLoading
                      ? 'Loading'
                      : unsuccessfulNonCanadianIpsListData[1]}{' '}
                  </span>
                }
                key="4"
              >
                {aadDataManager.isLoading && !aadDataManager.isInit ? (
                  <></>
                ) : (
                  generateClientIpLinksList(
                    columnDefs,
                    unsuccessfulNonCanadianIpsListData[0],
                  )
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

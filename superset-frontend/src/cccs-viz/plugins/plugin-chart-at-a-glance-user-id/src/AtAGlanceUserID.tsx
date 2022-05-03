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

const generateClientIpLinksList = (
  columnDefs: any,
  rowData: any,
  ipDashBoardBaseUrl: string,
  ipDashboardId: string,
  ipDashboardFilterId: string,
) => (
  <div className="ag-theme-balham" style={{ height: 400, width: 600 }}>
    <AgGridReact rowData={rowData} columnDefs={columnDefs} />
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

// Main Component
function AtAGlanceUserIDCore(props: AtAGlanceUserIDProps) {
  const [userIDString, setUserIDString] = useState('user@domain.invalid,');

  const [columnDefs] = useState([{ field: 'IP Address' }, { field: 'Count' }]);
  const [rowData, setRowData] = useState([{}]);

  let canadianIpsList: any[] = [];
  let nonCanadianIpsList: any[] = [];
  let unsuccessfulCanadianIpsList: any[] = [];
  let unsuccessfulNonCanadianIpsList: any[] = [];

  const [aadDataManager, setAadDataManger] = useState<DataManager>({
    data: props.data,
    isInit: false,
    isLoading: false,
    isError: false,
  });

  let hasFiltered = false;

  // useEffect(() => {
  //   setRowData([
  //     { 'IP Address': '1.1.1.1', Count: 1 },
  //     { 'IP Address': '1.1.1.2', Count: 1 },
  //   ]);
  // }, [
  //   canadianIpsList,
  //   nonCanadianIpsList,
  //   unsuccessfulCanadianIpsList,
  //   unsuccessfulNonCanadianIpsList,
  // ]);

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

  const COUNTRY_NAME_FIELD = 'client_ip_cbs_geo_country_name';
  const CANADA = 'canada';
  const OPERATION = 'operation';
  const USER_LOGGED_IN = 'UserLoggedIn';
  if (
    !aadDataManager.isLoading ||
    (aadDataManager.isInit && hasFiltered === false)
  ) {
    canadianIpsList = aadDataManager.data.filter(function (item) {
      return (
        getPayloadField(COUNTRY_NAME_FIELD, item) === CANADA &&
        getPayloadField(OPERATION, item) === USER_LOGGED_IN
      );
    });

    nonCanadianIpsList = aadDataManager.data.filter(function (item) {
      return (
        getPayloadField(COUNTRY_NAME_FIELD, item) !== CANADA &&
        getPayloadField(OPERATION, item) === USER_LOGGED_IN
      );
    });

    unsuccessfulCanadianIpsList = aadDataManager.data.filter(function (item) {
      return (
        getPayloadField(COUNTRY_NAME_FIELD, item) === CANADA &&
        getPayloadField(OPERATION, item) !== USER_LOGGED_IN
      );
    });

    unsuccessfulNonCanadianIpsList = aadDataManager.data.filter(function (
      item,
    ) {
      return (
        getPayloadField(COUNTRY_NAME_FIELD, item) !== CANADA &&
        getPayloadField(OPERATION, item) !== USER_LOGGED_IN
      );
    });

    hasFiltered = true;
  }

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
                      : canadianIpsList.length}{' '}
                  </span>
                }
                key="1"
              >
                {aadDataManager.isLoading && !aadDataManager.isInit ? (
                  <></>
                ) : (
                  generateClientIpLinksList(
                    columnDefs,
                    rowData,
                    props.ipDashBoardBaseUrl,
                    props.ipDashboardId,
                    props.ipDashboardFilterId,
                  )
                )}
              </Collapse.Panel>
              <Collapse.Panel
                header={
                  <span className="header">
                    {' '}
                    Number of Successful non Canadian Login Attempts:{' '}
                    {aadDataManager.isLoading
                      ? 'Loading'
                      : nonCanadianIpsList.length}{' '}
                  </span>
                }
                key="2"
              >
                {aadDataManager.isLoading && !aadDataManager.isInit ? (
                  <></>
                ) : (
                  generateClientIpLinksList(
                    columnDefs,
                    rowData,
                    props.ipDashBoardBaseUrl,
                    props.ipDashboardId,
                    props.ipDashboardFilterId,
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
                      : unsuccessfulCanadianIpsList.length}{' '}
                  </span>
                }
                key="3"
              >
                {aadDataManager.isLoading && !aadDataManager.isInit ? (
                  <></>
                ) : (
                  generateClientIpLinksList(
                    columnDefs,
                    rowData,
                    props.ipDashBoardBaseUrl,
                    props.ipDashboardId,
                    props.ipDashboardFilterId,
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
                      : unsuccessfulNonCanadianIpsList.length}{' '}
                  </span>
                }
                key="4"
              >
                {aadDataManager.isLoading && !aadDataManager.isInit ? (
                  <></>
                ) : (
                  generateClientIpLinksList(
                    columnDefs,
                    rowData,
                    props.ipDashBoardBaseUrl,
                    props.ipDashboardId,
                    props.ipDashboardFilterId,
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

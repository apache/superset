import React, { useState } from 'react';
import { ApplicationsProps } from './types';

export default function ApplicationLinks(props: ApplicationsProps) {
  const { application, appVal, appType } = props;
  const [alfredCount, ] = useState(-1);

  let url = '';
  let infoType = '';
  // TODO: this can be re added CLDN-929
  //let callback_url = '';

  if (application === 'ALFRED') {
    if (appType === 'USER_ID') {
      url = `https://alfred-tst.u.chimera.azure.cyber.gc.ca/?expression=MATCH%20(email:EMAIL_ADDRESS)%20WHERE%20email.value%20in%20[%22${appVal}%22]%20return%20email.value,%20email.maliciousness,%20email.uri`;
      infoType = 'user id';
      //callback_url = 'user_id';
    } else {
      url = `https://alfred-tst.u.chimera.azure.cyber.gc.ca/?expression=MATCH%20(ip%3AIP_ADDRESS)%20WHERE%20ip.value%20IN%20%5B%22${appVal}%22%5D%20RETURN%20ip.value%2C%20ip.maliciousness%2C%20ip.creation_date%2C%20ip.created_by%2C%20ip.uri%2C%20ip.report_uri`;
      infoType = 'IP';
      //callback_url = 'ip_string';
    }
  }
  // TODO: this can be fixed after CLDN-929
  // useEffect(() => {
  //   fetch(
  //     // eslint-disable-next-line no-restricted-globals
  //     `http://${location.host}/api/v1/proxy/alfred/${callback_url}/${appVal}`,
  //   )
  //     .then(res => res.json())
  //     .then(response => {
  //       if (response !== null && response.payload !== undefined) {
  //         setAlfredCount(response.payload.data?.length);
  //       } else {
  //         setAlfredCount(0);
  //       }
  //     })
  //     .catch(e => {
  //       // eslint-disable-next-line no-console
  //       console.log(e);
  //       setAlfredCount(0);
  // This will be caught by supersets default error handling that wraps and will display this message the the user 
  //       throw new Error("Failed to fetch results from Alfred");
  //     });
  // }, [appVal, callback_url]);

  return (
    <div>
      <div>
        <a href={url} target="_blank" rel="noreferrer">
          <img
            height="17"
            width="30"
            alt="Alfred"
            src="data:image/png;base64,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"
          />
        </a>
        {alfredCount > 0 ? (
          <p>
            Alfred has seen this {infoType} {alfredCount} time(s).  Search the{' '}
            <a href={url} target="_blank" rel="noreferrer">
              Alfred
            </a>{' '}
            knowledge base.
          </p>
        ) : (
          <p>
            Alfred has not seen this {infoType}.  Search the{' '}
            <a href={url} target="_blank" rel="noreferrer">
              Alfred
            </a>{' '}
            knowledge base.
          </p>
        )}
      </div>
    </div>
  );
}

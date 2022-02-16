import React, { useState } from 'react';
import { RiGlobalFill } from 'react-icons/ri';
import { QueryFormData } from '@superset-ui/core';
import Collapse from 'src/components/Collapse';

// Main Component
const AtAGlanceUserIdSasCore = (initialFormData: QueryFormData) => {
  const [userIDString, setUserIdString] = useState('user@domain.invalid,');
  const [data, setData] = useState(initialFormData.data);

  for (
    let i = 0;
    i < initialFormData.formData?.extraFormData?.filters?.length;
    // eslint-disable-next-line no-plusplus
    i++
  ) {
    const filter = initialFormData.formData.extraFormData.filters[i];
    if (filter.col === 'user_id') {
      const localuserId: string = filter.val[0];
      if (localuserId !== userIDString) {
        setData(initialFormData.data);
        setUserIdString(localuserId);
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
            <td>User Email: {userIDString}</td>
          </tr>
        </table>
      </div>
      <div>
        <table>
          <tr>
            <Collapse bordered expandIconPosition="left" ghost>
              <Collapse.Panel
                header={<span className="header">Count: {data.length}</span>}
                key="count"
              >
                <ul>
                  {data.map((a: { operation: string; count: number }) => (
                    <li>
                      {a.operation} : {a.count}
                    </li>
                  ))}
                </ul>
              </Collapse.Panel>
            </Collapse>
          </tr>
        </table>
      </div>
    </>
  );
};

export default AtAGlanceUserIdSasCore;

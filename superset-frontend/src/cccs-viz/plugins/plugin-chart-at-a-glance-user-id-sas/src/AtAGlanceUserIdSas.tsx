import React, { useState } from 'react';
import { QueryFormData } from '@superset-ui/core';

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
        <table className="table table-striped table-condensed">
          <tbody>
            {data.map((a: { operation: string; count: number }) => (
              <tr>
                <td>{a.operation}</td>
                <td>{a.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default AtAGlanceUserIdSasCore;

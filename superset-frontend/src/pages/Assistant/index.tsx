import { SupersetClient, t } from '@superset-ui/core';
import { createErrorHandler } from 'src/views/CRUD/utils';
import React from 'react';
import withToasts from 'src/components/MessageToasts/withToasts';
import { create } from 'lodash';


interface AssistantProps {
  user: {
    userId: number;
    firstName: string;
    lastName: string;
  };
}

function Assistant(props: AssistantProps) {

  // This Component Serves as the Assistant's Home Page
  // Header Dispays the Users Name and Databases they have access to

  const databases: any[] = []
  // Get the Databases the User has Access to
  SupersetClient.get({
    endpoint: `/api/v1/database/`,
  }).then(
    ({ json = {} }) => {
      console.log("Databases: ", json)
      json.result.map((database: any) => {
        databases.push(database.database_name)
      })
    }
  ).catch(
    createErrorHandler(errMsg => 
      t('An error occurred while fetching databases: %s', errMsg)
     ),
  );

  return (
    <div>
      <h1>Welcome {props.user.firstName} {props.user.lastName}!</h1>
      <h2>You have access to the following databases:</h2>
      <ul>
        {databases.map((database, i) => {
          return <li key={i}>{database}</li>
        })}
      </ul>
    </div>
  );
}

export default withToasts(Assistant);
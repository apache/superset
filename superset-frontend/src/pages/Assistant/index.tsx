import { SupersetClient, t } from '@superset-ui/core';
import { createErrorHandler } from 'src/views/CRUD/utils';
import React, { useState, useEffect } from 'react';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu from 'src/features/home/SubMenu';
import Loading from 'src/components/Loading';
import { DatabaseData, DatabaseContext, emptyDatabaseContext } from './contextUtils';
import Card from 'src/components/Card';


interface AssistantProps {
  user: {
    userId: number;
    firstName: string;
    lastName: string;
  };
  common: {
    locale: string|null;
  };
}

function Assistant(props: AssistantProps) {

  // This Component Serves as the Assistant's Home Page
  // Header Dispays the Users Name and Databases they have access to

  // Array to Store Databases
  const [databaseContext, setDatabaseContext] = useState<DatabaseContext>(emptyDatabaseContext);




  const [databases, setDatabases] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    SupersetClient.get({
      endpoint: `/api/v1/database/`,
    }).then(
      ({ json = {} }) => {
        const dbList = json.result.map((db: any) => db.database_name);
        const dbData: DatabaseData[] = json.result.map((db: DatabaseData) => db);
        dbData.map(db => {
          db.tables = [];
          return db;
        });
        console.log("Database Data :", dbData);
        setDatabases(dbList);
        const dbIds = dbData.map(db => db.id);
        console.log(dbIds);
      }
    ).catch(
      createErrorHandler(errMsg => 
        t('An error occurred while fetching databases: %s', errMsg)
       ),
    ).finally(() => {
      setLoading(false);
    });
  }, []);

  // Get the Databases the User has Access to


  return (
   <>
    <SubMenu
      name={t('Assistant')+ ' dbs: '+ databases.join(', ')}
    />
    {/* Welcome message in card*/}
    <Card title = {'Welcome to the Assistant, ' + props.user.firstName} />
    
    {/* if loading show Loading component */}
    {loading && <Loading />}
   </>
  );
}

export default withToasts(Assistant);
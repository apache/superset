import { useEffect, useState } from 'react';

export const useGraphQlEndpoint = (
  method /* resource, method, data, query */,
) => {
  const [state, setState] = useState({});

  /* function updateState(update) {
    setSTATE
  } */
  const getResource = async () => {
    let res;
    try {
      // eventually replace with resource
      const response = await fetch('/graphql', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query {
                database(databaseId: 1){
                database{
                    name
                    backend
                    configuration_method
                }
                }
            }
            `,
        }),
      });
      console.log('response', response);
      res = await response.json();
      setState({ res });
      console.log('res', res);
      // return response;
    } catch (error) {
      console.log('error', error);
    }
  };
  useEffect(() => {
    getResource();
  }, []);

  return {
    response: state.res,
  };
};

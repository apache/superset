/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { useToasts } from 'src/components/MessageToasts/withToasts';

type UseFetchProps = {
  url: string;
  method?: 'GET' | 'POST' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
};

const useFetch = ({
  url,
  method = 'GET',
  body,
  headers = {},
}: UseFetchProps) => {
  const { addDangerToast } = useToasts();
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: method !== 'GET' ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();
        setData(result);
      } catch (error) {
        addDangerToast(error.message);
      }
    };

    fetchData();
  }, [url]);

  return data;
};

export default useFetch;

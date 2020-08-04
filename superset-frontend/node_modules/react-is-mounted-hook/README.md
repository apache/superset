# react-is-mounted-hook

> React hook to check if the component is still mounted

## Install

```sh
// with npm
npm install react-is-mounted-hook

// with yarn
yarn add react-is-mounted-hook
```

## How to use

```javascript
import React, { useState, useEffect } from 'react';
import useIsMounted from 'react-is-mounted-hook';
import axios from 'axios';
import Loading from './loading';
import Result from './result';

const FetchComponent = () => {
  const isMounted = useIsMounted();
  const [data, setdata] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const result = await axios(
        'http://hn.algolia.com/api/v1/search?query=redux'
      );
      if (isMounted()) {
        setData(result.data);
      }
    };

    fetchData();
  }, []);

  return data ? <Result data={data} /> : <Loading />;
};

export default FetchComponent;
```

## License

[MIT](LICENSE)

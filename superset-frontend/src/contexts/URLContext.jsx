import React, { createContext, useState } from 'react';

const URLContext = createContext();

export const URLProvider = ({ children }) => {
  const [urls, setUrls] = useState({});

  const setURL = (id, url) => {
    setUrls(prev => ({ ...prev, [id]: url }));
  };

  const getURL = (id) => urls[id] || '';

  return (
    <URLContext.Provider value={{ urls, setURL, getURL }}>
      {children}
    </URLContext.Provider>
  );
};

export default URLContext;

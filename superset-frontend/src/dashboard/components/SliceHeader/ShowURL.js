import React, { useContext } from 'react';
import URLContext from '../../../contexts/URLContext.js';
import redirectIcon from '../../../assets/images/icons/redirectIcon.png';

const ShowURL = ({ instanceId }) => {
  const { getURL } = useContext(URLContext);

  if(getURL(instanceId)!=null){

  return (
    <a href={getURL(instanceId)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
        <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
          <img
            src={redirectIcon}
            alt="Redire"
            style={{ width: '24px', height: '24px' }}
          />
        </span>
      </a>
  );

} else {
  return null;
}
};

export default ShowURL;

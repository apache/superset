import React, { useState } from 'react';
import EmbeddedPage from './vannaAiPage';
import { border, borderColor, borderRadius } from 'polished';
import SouthPane from 'src/SqlLab/components/SouthPane';

const VannaAiButton = () => {
  const [showIframe, setShowIframe] = useState(false);

  const handleOpen = () => {
    setShowIframe(true);
  };

  const handleClose = () => {
    setShowIframe(false);
  };

  return (
    <span>
      {!showIframe ? (
        // <button style={styles.button} onClick={handleOpen}>
        //   Vanna.ai
        // </button>
        <span
          role="presentation" 
          // class="ant-menu-item ant-menu-item-only-child css-wke4wm" 
          style={{
            ...styles.button,
            width: '100px',
            textAlign: 'center',}
            }>
          <a role="button" onClick={handleOpen}>Vanna.ai</a>
        </span>
      ) : (
        <span>
          <button style={{
            ...styles.button,
            width: '100px',
            textAlign: 'center',}
            } 
            onClick={handleClose}>
            Close
          </button>
          <EmbeddedPage />
        </span>
      )}
    </span>
  );
};

const styles = {
  button: {
    fontSize: '16px',
    backgroundColor: '#fff',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

export default VannaAiButton;
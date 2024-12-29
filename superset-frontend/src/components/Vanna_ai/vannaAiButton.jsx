import React, { useState } from 'react';
import EmbeddedPage from './vannaAiPage';
import { border, borderColor, borderRadius } from 'polished';
import SouthPane from 'src/SqlLab/components/SouthPane';
import { useHistory } from 'react-router-dom';

const VannaAiButton = () => {

  const history = useHistory();

  const handleButtonClick = () => {
    history.push('/vanna/home'); // Replace '/target-route' with your desired route
  };
  return (
        <span
          role="presentation" 
          // class="ant-menu-item ant-menu-item-only-child css-wke4wm" 
          style={{
            ...styles.button,
            width: '100px',
            textAlign: 'center',}
            }>
          <a role="button" onClick={handleButtonClick}>Vanna.ai</a>
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
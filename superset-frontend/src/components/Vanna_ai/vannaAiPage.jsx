import React, { useState } from 'react';

const VannaAiPage = () => {

  const [iframeError, setIframeError] = useState(false);

  const handleIframeError = () => {
    setIframeError(true);
  };

  const handleIframeLoad = () => {
    setIframeError(false);
  };

  return (
    <div style={styles.container}>
      {iframeError ? (
        <div style={styles.errorMessage}>Nothing is present on port 5000</div>
      ) : (
        <iframe
          src="http://localhost:5000"
          title="Vanna AI Pagew"
          style={styles.iframe}
          frameBorder="0"
          allowFullScreen
          onError={handleIframeError}
          onLoad={handleIframeLoad}
        ></iframe>
      )}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f5f5f5',
  },
  iframe: {
    width: '80%',
    height: '80%',
    border: '1px solid #ccc',
    borderRadius: '8px',
  },
  errorMessage: {
    marginTop: "20px",
    color: "red",
    fontSize: "18px",
    backgroundColor: "#f00",
  },
};

export default VannaAiPage;
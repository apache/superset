import React from "react";
import { sqlLab } from "@apache-superset/types";

const ExtensionExample: React.FC = () => {
  const containerStyle: React.CSSProperties = {
    minHeight: "300px",
    display: "flex",
    flexDirection: "column",
    padding: "20px",
  };

  const textStyle: React.CSSProperties = {
    fontSize: "18px",
    color: "#333",
    marginTop: "10px",
  };

  return (
    <div style={containerStyle}>
      I'm an extension that shows the databases in the SQL Lab workspace.
      <ul>
        {sqlLab.databases.map((database) => (
          <div style={textStyle}>
            <li>{database.name}</li>
          </div>
        ))}
      </ul>
    </div>
  );
};

export default ExtensionExample;

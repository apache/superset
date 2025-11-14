/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// eslint-disable-next-line no-restricted-syntax
import React, { useEffect } from "react";
import { authentication, sqlLab } from "@apache-superset/core";
import { Avatar } from "antd";
import binaryImage from "./assets/binary.jpg";

const Component: React.FC = () => {
  const [apiResponse, setApiResponse] = React.useState<string | null>(null);
  const currentTab = sqlLab.getCurrentTab();

  useEffect(() => {
    const callApi = async () => {
      try {
        const csrfToken = await authentication.getCSRFToken();
        const response = await fetch("/extensions/extension1/hello", {
          method: "GET",
          headers: {
            "X-CSRFToken": csrfToken!,
          },
        });
        const data = await response.json();
        setApiResponse(data.result);
      } catch (err) {
        setApiResponse(err as string);
      }
    };
    callApi();
  }, []);

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    gap: "20px",
  };

  return (
    <>
      <div style={containerStyle}>
        <div>
          <Avatar>M</Avatar>
        </div>
        <div>This avatar was imported from Superset!</div>
      </div>
      {currentTab ? (
        <pre>
          {`Tab ID: ${currentTab.id}\nTitle: ${currentTab.title}\n\nEditor Properties:\n`}
          {`  database: ${currentTab.editor.databaseId || "N/A"}\n`}
          {`  catalog: ${currentTab.editor.catalog ?? "N/A"}\n`}
          {`  schema: ${currentTab.editor.schema ?? "N/A"}\n`}
          {`  table: ${currentTab.editor.table ?? "N/A"}\n`}
        </pre>
      ) : (
        "No tab selected"
      )}
      <div>
        <h3>API Response: {apiResponse}</h3>
      </div>
      <img src={binaryImage} alt="Binary is here" />
    </>
  );
};

export default Component;

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
import React, { useEffect } from "react";
import { authentication, sqlLab } from "@apache-superset/core";
import Table from "./Table";
import { MetadataRow } from "./types";

const Main: React.FC = () => {
  const [metadata, setMetadata] = React.useState<MetadataRow[]>([]);

  const onQueryRun = async (sql: string) => {
    try {
      const csrfToken = await authentication.getCSRFToken();
      const response = await fetch(
        "/api/v1/extensions/dataset_references/metadata",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken!,
          },
          body: JSON.stringify({
            sql,
          }),
        }
      );
      const data = await response.json();
      setMetadata(data.result);
    } catch (err) {
      setMetadata([]);
    }
  };

  useEffect(() => {
    const queryRun = sqlLab.onDidQueryRun(onQueryRun);
    return () => {
      queryRun.dispose();
    };
  }, [onQueryRun]);

  return <Table metadata={metadata} />;
};

export default Main;

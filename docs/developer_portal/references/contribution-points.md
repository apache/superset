---
title: Contribution Points
sidebar_position: 3
---

<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Contribution Points

=� **Coming Soon** =�

Reference guide for all available extension points where plugins can contribute functionality to Superset.

## Topics to be covered:

- Available contribution points and extension interfaces
- Plugin registration and configuration
- Chart type contributions
- UI component contributions
- Menu and navigation contributions
- Command palette contributions
- Theme and styling contributions
- Data source and connector contributions
- Filter and control contributions
- Custom page and route contributions

## Extension Points

### Chart Contributions

#### Visualization Types
```json
{
  "contributes": {
    "charts": [
      {
        "name": "my-custom-chart",
        "displayName": "Custom Chart",
        "component": "./ChartComponent",
        "controlPanel": "./ControlPanel",
        "transformProps": "./transformProps",
        "thumbnail": "./thumbnail.png"
      }
    ]
  }
}
```

#### Chart Categories
- **Basic Charts** - Simple visualization types
- **Advanced Charts** - Complex visualization types
- **Geospatial** - Map and location-based charts
- **Time Series** - Temporal data visualizations
- **Statistical** - Statistical analysis charts

### UI Contributions

#### Menu Items
```json
{
  "contributes": {
    "menus": {
      "main": [
        {
          "id": "my-plugin-menu",
          "title": "My Plugin",
          "icon": "plugin-icon",
          "command": "my-plugin.open"
        }
      ]
    }
  }
}
```

#### Dashboard Components
- **Custom tabs** - Additional dashboard tabs
- **Sidebar panels** - Custom sidebar content
- **Header extensions** - Additional header items
- **Footer components** - Custom footer content

### Data Source Contributions

#### Database Connectors
```json
{
  "contributes": {
    "databases": [
      {
        "name": "my-database",
        "displayName": "My Database",
        "driver": "my-database-driver",
        "connector": "./DatabaseConnector"
      }
    ]
  }
}
```

---

*This documentation is under active development. Check back soon for updates!*

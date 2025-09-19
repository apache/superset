---
title: Contribution Points
sidebar_position: 3
---

# Contribution Points

=§ **Coming Soon** =§

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

# Column Presets Guide

## Overview

The Column Preset system allows users to save, load, and manage different column configurations for tables. Each preset stores the complete state of column visibility, widths, order, and pinning, enabling users to quickly switch between different views of the same data.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [User Interface](#user-interface)
- [Preset Operations](#preset-operations)
- [Use Cases](#use-cases)
- [Technical Details](#technical-details)
- [Troubleshooting](#troubleshooting)

## Features

### What Gets Saved in a Preset

Each preset stores:
- **Column Visibility**: Which columns are shown/hidden
- **Column Widths**: Custom width for each column
- **Pinned Columns**: Columns pinned to left or right
- **Column Order**: The sequence of columns

### Key Capabilities

- ✅ **Save Current View**: Capture current column configuration
- ✅ **Load Presets**: Quickly switch between saved configurations
- ✅ **Default Preset**: Set a preset to load automatically
- ✅ **Preset Management**: Rename, duplicate, delete presets
- ✅ **Import/Export**: Share presets across browsers or users
- ✅ **Per-Table Storage**: Each table has its own presets
- ✅ **LocalStorage Based**: No server required, works offline

## Quick Start

### Creating Your First Preset

1. **Customize the table**:
   - Hide/show columns as desired
   - Resize columns to preferred widths
   - Pin important columns left or right
   - Reorder columns by dragging headers

2. **Save the preset**:
   - Click the **"Save Current"** button
   - Enter a descriptive name (e.g., "Sales Dashboard")
   - Optionally add a description
   - Check "Set as default" if you want it to load automatically
   - Click **"Save"**

3. **Use your preset**:
   - Click **"Presets"** dropdown
   - Select your saved preset to apply it instantly

### Loading a Preset

1. Click the **"Presets"** button in the table header
2. Browse the list of saved presets
3. Click on any preset to apply it immediately

The table will update to match the saved configuration.

## User Interface

### Location

Preset controls appear in the table header, next to the search input and column filters:

```
[Search] [Filters] [Columns] [Presets ▼] [Save Current]
```

### Preset Button

- **Icon**: Folder icon with dropdown
- **Action**: Opens list of saved presets
- **Badge**: Shows default preset with a star icon

### Save Current Button

- **Icon**: Save icon
- **Action**: Opens dialog to save current configuration
- **Result**: Creates new preset with current state

### More Actions Menu (⋯)

Available when you have presets:
- **Export Presets**: Download all presets as JSON
- **Import Presets**: Upload presets from JSON file

## Preset Operations

### Creating a Preset

**Fields:**

1. **Preset Name** (required)
   - Must be unique per table
   - 2-50 characters
   - Letters, numbers, spaces, hyphens, underscores only
   - Examples: "Monthly Report", "Executive Summary", "Detailed View"

2. **Description** (optional)
   - Helps remember the preset's purpose
   - Shown in the preset list
   - Examples: "Shows only KPIs", "All columns for export"

3. **Set as Default** (checkbox)
   - Makes this preset load automatically
   - Only one preset can be default
   - Useful for your most common view

**What Happens:**
- Current column configuration is captured
- Preset is saved to browser localStorage
- Preset immediately available in the list

### Loading a Preset

**Steps:**
1. Click "Presets" dropdown
2. Click on desired preset

**What Happens:**
- Column visibility changes to match preset
- Column widths update
- Pinned columns reposition
- Column order rearranges
- Active preset highlighted in list

**Visual Feedback:**
- Active preset shown with background color
- Default preset shown with star icon

### Managing Presets

#### Set as Default

- Click the **star icon** next to any preset
- That preset will load automatically when table opens
- Removes default status from other presets

**Use case:** Set your most common view as default to save time

#### Duplicate

- Click the **copy icon** next to any preset
- Creates a new preset with "(Copy)" suffix
- Useful for creating variations of existing presets

**Example:**
- Original: "Sales View"
- Duplicate: "Sales View (Copy)"
- Rename to: "Sales View - Q4"

#### Delete

- Click the **trash icon** next to any preset
- Confirmation dialog appears
- Deletion is permanent (use export for backup)

**Warning:** Cannot be undone. Export presets before deleting if unsure.

### Import/Export

#### Exporting Presets

**Steps:**
1. Click the **more menu** (⋯) in preset controls
2. Select "Export Presets"
3. JSON file downloads automatically

**File name format:**
```
column-presets-{tableId}-{timestamp}.json
```

**Use cases:**
- Backup presets before making changes
- Share presets with team members
- Transfer presets to another browser
- Document configurations

#### Importing Presets

**Steps:**
1. Click the **more menu** (⋯) in preset controls
2. Select "Import Presets"
3. Choose JSON file from your computer

**Behavior:**
- Merges with existing presets (no duplicates)
- Skips presets with duplicate names
- Generates new IDs for imported presets
- Does not import default status (for safety)

**Safety:**
- Original presets are preserved
- Duplicate names are skipped
- Invalid files show error message

## Use Cases

### 1. Executive Dashboard

**Scenario:** Need a simplified view for executive meetings

**Preset Configuration:**
- Visible columns: Only KPIs (Revenue, Growth%, Margin)
- Column widths: Wide for easy reading
- Pinned: Date column on left
- Name: "Executive Summary"
- Set as default: No

**Benefit:** One click to switch to executive-friendly view

### 2. Data Entry

**Scenario:** Frequently update specific columns

**Preset Configuration:**
- Visible columns: ID, Name, Status, Priority, Assigned To
- Column widths: Narrow (fit more on screen)
- Pinned: ID and Name on left
- Name: "Quick Edit"
- Set as default: No

**Benefit:** Optimal layout for data entry tasks

### 3. Export View

**Scenario:** Need all columns for data export

**Preset Configuration:**
- Visible columns: ALL columns
- Column widths: Default
- Pinned: None
- Name: "Export All"
- Set as default: No

**Benefit:** Quickly show all data before exporting

### 4. Personal Default

**Scenario:** Always want the same view when opening table

**Preset Configuration:**
- Visible columns: Your preferred subset
- Column widths: Your preferred sizes
- Pinned: Your frequently used columns
- Name: "My Default"
- Set as default: YES

**Benefit:** Table always opens with your preferred layout

### 5. Mobile View

**Scenario:** Need minimal columns for mobile devices

**Preset Configuration:**
- Visible columns: 3-4 most important columns
- Column widths: Narrow
- Pinned: First column only
- Name: "Mobile Friendly"
- Set as default: No

**Benefit:** Optimized for small screens

### 6. Team Collaboration

**Scenario:** Team needs consistent views

**Preset Configuration:**
1. Create standard presets for team
2. Export to JSON
3. Share file with team members
4. Team members import the presets

**Benefit:** Everyone sees data the same way

## Technical Details

### Storage Architecture

**Storage Location:**
- Browser localStorage
- Key format: `remita_table_presets_{tableId}`

**Storage Limits:**
- LocalStorage typically supports 5-10MB per domain
- Each preset ~1-5KB depending on column count
- Estimated capacity: 1000-5000 presets per table

**Data Structure:**
```typescript
interface ColumnPreset {
  id: string;                    // Unique identifier
  name: string;                  // User-provided name
  description?: string;          // Optional description
  createdAt: number;             // Creation timestamp
  updatedAt: number;             // Last update timestamp
  isDefault?: boolean;           // Default preset flag
  configuration: {
    visibleColumns: string[] | null;
    columnWidths: Record<string, number>;
    pinnedLeft: string[];
    pinnedRight: string[];
    columnOrder?: string[];
  };
}
```

### Preset ID Generation

- Format: `preset_{timestamp}_{random}`
- Example: `preset_1696890234567_x7k2m9a`
- Ensures uniqueness across multiple presets

### Default Preset Behavior

**On Table Load:**
1. Check if default preset exists
2. If yes, apply it automatically
3. If no, use last manually applied state

**Changing Default:**
- Setting new default removes flag from old default
- Only one preset can be default at a time
- Default status persists across sessions

### Performance

**Operations:**
- **Save**: O(n) where n = number of presets (~1ms)
- **Load**: O(n) for lookup + O(m) for apply where m = columns (~5-10ms)
- **List**: O(n) for retrieval (~1ms)

**Optimizations:**
- Presets loaded once on mount
- Changes batched for state updates
- localStorage operations debounced

**Recommendations:**
- Keep preset count < 100 per table for best performance
- Export and archive old presets periodically

### Browser Compatibility

**Supported:**
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Opera 76+

**Required Features:**
- localStorage API
- JSON.parse/stringify
- ES2020+ support

**Fallback:**
- If localStorage unavailable, presets disabled gracefully
- Error messages logged to console
- Table functions normally without presets

### Security Considerations

**Data Privacy:**
- Presets stored locally (never sent to server)
- Cleared when browser data is cleared
- Not accessible across different browsers/devices

**Validation:**
- Preset names validated for safe characters
- JSON import validated for structure
- Column keys validated against available columns

**Best Practices:**
- Don't store sensitive data in preset names/descriptions
- Use export feature for backups before clearing browser data
- Import presets only from trusted sources

## Troubleshooting

### Preset Not Saving

**Symptoms:**
- Click "Save" but preset doesn't appear in list
- Error message shown

**Possible Causes:**
1. **Duplicate name**: Choose a unique name
2. **Invalid characters**: Use only letters, numbers, spaces, hyphens, underscores
3. **localStorage full**: Clear old presets or browser data
4. **localStorage disabled**: Check browser settings

**Solutions:**
- Try different preset name
- Export existing presets and clear some
- Check browser console for specific error
- Enable localStorage in browser settings

### Preset Not Loading

**Symptoms:**
- Click preset but nothing happens
- Columns don't change

**Possible Causes:**
1. **Missing columns**: Preset refers to columns that no longer exist
2. **Browser console errors**: Check for JavaScript errors
3. **Conflicting state**: Another process updating columns simultaneously

**Solutions:**
- Delete and recreate the preset
- Refresh the page and try again
- Check browser console for errors
- Create new preset with current columns

### Default Preset Not Loading

**Symptoms:**
- Set preset as default but it doesn't load automatically

**Possible Causes:**
1. **Cache issues**: Browser cached old state
2. **Multiple defaults**: Data corruption (should be impossible)
3. **Timing issues**: Preset loading before table initialized

**Solutions:**
- Hard refresh page (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache for site
- Unset and re-set default preset
- Export presets, clear all, re-import

### Import Fails

**Symptoms:**
- Choose file but nothing imports
- Error message shown

**Possible Causes:**
1. **Invalid JSON**: File corrupted or wrong format
2. **Wrong file type**: Not a preset export file
3. **Version mismatch**: Exported from incompatible version

**Solutions:**
- Verify JSON is valid (use JSON validator online)
- Ensure file is from preset export feature
- Re-export from source and try again
- Check file isn't corrupted (try opening in text editor)

### Lost Presets

**Symptoms:**
- Presets disappeared
- List is empty

**Possible Causes:**
1. **Browser data cleared**: localStorage wiped
2. **Different browser/device**: Presets are browser-local
3. **Different table ID**: Table configuration changed

**Solutions:**
- Check if you have exported backups
- Recreate presets (sorry, they're gone if not backed up)
- Set reminder to export presets periodically
- Consider documenting preset configurations

### Performance Issues

**Symptoms:**
- Slow to load preset list
- Lag when applying presets
- Browser slowdown

**Possible Causes:**
1. **Too many presets**: 100+ presets in one table
2. **Large table**: Thousands of rows rendering
3. **Complex columns**: Many conditional formats

**Solutions:**
- Archive old presets (export and delete)
- Keep preset count < 50 per table
- Use server pagination for large datasets
- Simplify column configurations where possible

## Best Practices

### Naming Conventions

**Good Names:**
- ✅ "Executive Dashboard"
- ✅ "Data Entry View"
- ✅ "Export All"
- ✅ "Q4 2024 Review"

**Poor Names:**
- ❌ "test"
- ❌ "asdf"
- ❌ "Preset 1"
- ❌ "New Preset (Copy) (Copy) (Copy)"

**Tips:**
- Use descriptive, purpose-driven names
- Include context (time period, audience, task)
- Keep names concise but meaningful
- Use consistent naming scheme across presets

### Organization Strategies

1. **By Audience**
   - "Executive View"
   - "Manager View"
   - "Analyst View"

2. **By Task**
   - "Data Entry"
   - "Review Mode"
   - "Export Ready"

3. **By Time Period**
   - "Q1 Focus"
   - "Year End"
   - "Monthly Report"

4. **By Data Subset**
   - "Active Only"
   - "All Records"
   - "Recent Updates"

### Maintenance

**Regular Tasks:**
- **Weekly**: Review if new preset needed for recurring tasks
- **Monthly**: Clean up unused presets
- **Quarterly**: Export presets as backup
- **Annually**: Archive old presets, reorganize

**Cleanup Criteria:**
- Haven't used in 3+ months
- Duplicate of another preset
- Purpose no longer relevant
- Better preset created since

### Backup Strategy

1. **Export regularly**
   - After creating important presets
   - Before making major changes
   - Monthly for active tables

2. **Store exports safely**
   - Save to cloud storage (Google Drive, Dropbox)
   - Version control for team presets
   - Document what each export contains

3. **Test imports**
   - Periodically test importing old exports
   - Verify presets work after import
   - Update documentation if format changes

## Advanced Usage

### Preset Templates

Create "template" presets for common patterns:

1. **Minimal Template**
   - 3-5 key columns only
   - Use as starting point for focused views

2. **Complete Template**
   - All columns visible
   - Use as starting point for comprehensive views

3. **Analysis Template**
   - Metrics and dimensions only
   - Use for data analysis tasks

### Workflow Integration

1. **Daily Routine**
   - Create "Morning Dashboard" preset
   - Quick glance at key metrics
   - Switch to "Detail View" for deep dives

2. **Reporting Cycle**
   - "Draft Report" preset for initial work
   - "Review Mode" for checking data
   - "Final Export" for generating reports

3. **Team Handoffs**
   - "Pending Review" preset
   - Highlights items needing attention
   - Share preset with team for consistency

### Scripting & Automation

While presets are UI-driven, you can:

1. **Backup Automation**
   ```javascript
   // Browser console script to backup presets
   const tableId = 'your-table-id';
   const key = `remita_table_presets_${tableId}`;
   const data = localStorage.getItem(key);
   console.log(data); // Copy and save this
   ```

2. **Bulk Import**
   - Create presets programmatically
   - Import JSON with multiple presets
   - Useful for onboarding teams

## Related Documentation

- [STATE_MANAGEMENT_REFACTORING.md](./STATE_MANAGEMENT_REFACTORING.md) - State architecture
- [KEYBOARD_NAVIGATION.md](./KEYBOARD_NAVIGATION.md) - Keyboard shortcuts
- [HIGH_PRIORITY_FIXES.md](./HIGH_PRIORITY_FIXES.md) - Performance optimizations

---

**Last Updated:** 2025-10-09
**Implemented By:** Claude (AI Assistant)
**Status:** ✅ Complete and tested

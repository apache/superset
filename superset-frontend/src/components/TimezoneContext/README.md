# Timezone Context

This document explains how to use the global timezone functionality in Superset frontend.

## Overview

The timezone context allows all dates in the application to respect a timezone specified via URL parameter. This provides a consistent way to display dates and times across the entire application based on the user's specified timezone.

## URL Parameter

Add a `timezone` parameter to any URL to set the application timezone:

```
https://your-superset.com/dashboard/1/?timezone=Asia/Kolkata
https://your-superset.com/dashboard/1/?timezone=Asia/Dubai
https://your-superset.com/dashboard/1/?timezone=America/New_York
```

Valid timezone values are any timezone name from the [IANA Time Zone Database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones), such as:
- `Asia/Kolkata`
- `Asia/Dubai`
- `Europe/London`
- `America/New_York`
- `UTC`

If no timezone is specified or an invalid timezone is provided, the application defaults to `UTC`.

## Usage in Components

### Using the Timezone Context Hook

```tsx
import { useTimezone } from 'src/components/TimezoneContext';

function MyComponent() {
  const { timezone, formatDate, formatDateTime } = useTimezone();

  const currentTime = new Date();

  return (
    <div>
      <p>Current timezone: {timezone}</p>
      <p>Date: {formatDate(currentTime)}</p>
      <p>DateTime: {formatDateTime(currentTime)}</p>
    </div>
  );
}
```

### Using Utility Functions

```tsx
import { formatDate, formatDateTime, getCurrentTimezone } from 'src/utils/dateUtils';

function MyComponent() {
  const currentTime = new Date();

  return (
    <div>
      <p>Current timezone: {getCurrentTimezone()}</p>
      <p>Date: {formatDate(currentTime)}</p>
      <p>DateTime: {formatDateTime(currentTime)}</p>
      <p>Custom format: {formatDateTime(currentTime, 'MMM DD, YYYY HH:mm')}</p>
    </div>
  );
}
```

## API Reference

### TimezoneContext Hook

#### `useTimezone()`

Returns an object with timezone utilities:

- `timezone: string` - Current timezone (e.g., 'Asia/Kolkata')
- `setTimezone: (timezone: string) => void` - Function to update timezone
- `formatDate: (date: MomentInput, format?: string) => string` - Format date in current timezone
- `formatDateTime: (date: MomentInput, format?: string) => string` - Format datetime in current timezone

### Utility Functions

#### `getCurrentTimezone(): string`
Returns the current timezone from URL parameter or default (UTC).

#### `formatDate(date: MomentInput, format?: string, timezone?: string): string`
Formats a date in the specified timezone (or current timezone if not provided).
- Default format: `'YYYY-MM-DD'`

#### `formatDateTime(date: MomentInput, format?: string, timezone?: string): string`
Formats a datetime in the specified timezone (or current timezone if not provided).
- Default format: `'YYYY-MM-DD HH:mm:ss'`

#### `createMomentInTimezone(date: MomentInput, timezone?: string): moment.Moment`
Creates a moment object in the specified timezone.

#### `parseAndConvertToTimezone(dateString: string, inputFormat?: string, timezone?: string): moment.Moment`
Parses a date string and converts it to the specified timezone.

#### `getTimezoneDisplayName(timezone?: string): string`
Returns a user-friendly timezone display name (e.g., "Asia/Kolkata (UTC+05:30)").

#### `isValidTimezone(timezone: string): boolean`
Checks if a timezone string is valid.

## Examples

### Setting Timezone via URL

```
# Indian Standard Time
/?timezone=Asia/Kolkata

# UAE Time
/?timezone=Asia/Dubai

# Eastern Time
/?timezone=America/New_York

# UTC (default)
/?timezone=UTC
```

### Custom Date Formatting

```tsx
import { formatDateTime } from 'src/utils/dateUtils';

// Format in different timezones
const timestamp = new Date('2023-12-25T12:00:00Z');

const kolkataTime = formatDateTime(timestamp, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata');
// Result: "2023-12-25 17:30:00"

const dubaiTime = formatDateTime(timestamp, 'YYYY-MM-DD HH:mm:ss', 'Asia/Dubai');
// Result: "2023-12-25 16:00:00"

const utcTime = formatDateTime(timestamp, 'YYYY-MM-DD HH:mm:ss', 'UTC');
// Result: "2023-12-25 12:00:00"
```

## Implementation Details

- The timezone context is provided at the root level via `RootContextProviders`
- URL parameter changes are automatically detected and applied
- The `LastUpdated` component has been updated to use timezone context
- All date formatting throughout the application should use the timezone context or utility functions

## Testing

The timezone functionality includes comprehensive tests. Run them with:

```bash
npm test -- --testPathPattern="TimezoneContext.test.tsx"
```
# JavaScript to TypeScript Migration Agent Guide

**Complete technical reference for converting JavaScript/JSX files to TypeScript/TSX in Apache Superset frontend.**

**Agent Role:** Atomic migration unit - migrate the core file + ALL related tests/mocks as one cohesive unit. Use `git mv` to preserve history, NO `git commit`. NO global import changes. Report results upon completion.

---

## 🎯 Migration Principles

1. **Atomic migration units** - Core file + all related tests/mocks migrate together
2. **Zero `any` types** - Use proper TypeScript throughout
3. **Leverage existing types** - Reuse established definitions
4. **Type inheritance** - Derivatives extend base component types
5. **Strategic placement** - File types for maximum discoverability
6. **Surgical improvements** - Enhance existing types during migration

---

## Step 0: Dependency Check (MANDATORY)

**Command:**
```bash
grep -E "from '\.\./.*\.jsx?'|from '\./.*\.jsx?'|from 'src/.*\.jsx?'" superset-frontend/{filename}
```

**Decision:**
- ✅ No matches → Proceed with atomic migration (core + tests + mocks)
- ❌ Matches found → EXIT with dependency report (see format below)

---

## Step 1: Identify Related Files (REQUIRED)

**Atomic Migration Scope:**
For core file `src/utils/example.js`, also migrate:
- `src/utils/example.test.js` / `src/utils/example.test.jsx`
- `src/utils/example.spec.js` / `src/utils/example.spec.jsx`
- `src/utils/__mocks__/example.js`
- Any other related test/mock files found by pattern matching

**Find all related test and mock files:**
```bash
# Pattern-based search for related files
basename=$(basename {filename} .js)
dirname=$(dirname superset-frontend/{filename})

# Find test files
find "$dirname" -name "${basename}.test.js" -o -name "${basename}.test.jsx"
find "$dirname" -name "${basename}.spec.js" -o -name "${basename}.spec.jsx"

# Find mock files  
find "$dirname" -name "__mocks__/${basename}.js"
find "$dirname" -name "${basename}.mock.js"
```

**Migration Requirement:** All discovered related files MUST be migrated together as one atomic unit.

**Test File Creation:** If NO test files exist for the core file, CREATE a minimal test file using the following pattern:
- Location: Same directory as core file
- Name: `{basename}.test.ts` (e.g., `DebouncedMessageQueue.test.ts`)
- Content: Basic test structure importing and testing the main functionality
- Use proper TypeScript types in test file

---

## 🗺️ Type Reference Map

### From `@superset-ui/core`
```typescript
// Data & Query
QueryFormData, QueryData, JsonObject, AnnotationData, AdhocMetric
LatestQueryFormData, GenericDataType, DatasourceType, ExtraFormData
DataMaskStateWithId, NativeFilterScope, NativeFiltersState, NativeFilterTarget

// UI & Theme  
FeatureFlagMap, LanguagePack, ColorSchemeConfig, SequentialSchemeConfig
```

### From `@superset-ui/chart-controls`
```typescript
Dataset, ColumnMeta, ControlStateMapping
```

### From Local Types (`src/types/`)
```typescript
// Authentication
User, UserWithPermissionsAndRoles, BootstrapUser, PermissionsAndRoles

// Dashboard
Dashboard, DashboardState, DashboardInfo, DashboardLayout, LayoutItem
ComponentType, ChartConfiguration, ActiveFilters

// Charts
Chart, ChartState, ChartStatus, ChartLinkedDashboard, Slice, SaveActionType

// Data
Datasource, Database, Owner, Role

// UI Components
TagType, FavoriteStatus, Filter, ImportResourceName
```

### From Domain Types
```typescript
// src/dashboard/types.ts
RootState, ChartsState, DatasourcesState, FilterBarOrientation
ChartCrossFiltersConfig, ActiveTabs, MenuKeys

// src/explore/types.ts  
ExplorePageInitialData, ExplorePageState, ExploreResponsePayload, OptionSortType

// src/SqlLab/types.ts
[SQL Lab specific types]
```

---

## 🏗️ Type Organization Strategy

### Type Placement Hierarchy

1. **Component-Colocated** (90% of cases)
   ```typescript
   // Same file as component
   interface MyComponentProps {
     title: string;
     onClick: () => void;
   }
   ```

2. **Feature-Shared**
   ```typescript
   // src/[domain]/components/[Feature]/types.ts
   export interface FilterConfiguration {
     filterId: string;
     targets: NativeFilterTarget[];
   }
   ```

3. **Domain-Wide**
   ```typescript
   // src/[domain]/types.ts
   export interface ExploreFormData extends QueryFormData {
     viz_type: string;
   }
   ```

4. **Global**
   ```typescript
   // src/types/[TypeName].ts
   export interface ApiResponse<T> {
     result: T;
     count?: number;
   }
   ```

### Type Discovery Commands
```bash
# Search existing types before creating
find superset-frontend/src -name "types.ts" -exec grep -l "[TypeConcept]" {} \;
grep -r "interface.*Props\|type.*Props" superset-frontend/src/
```

### Derivative Component Patterns

**Rule:** Components that extend others should extend their type interfaces.

```typescript
// ✅ Base component type
interface SelectProps {
  value: string | number;
  options: SelectOption[];
  onChange: (value: string | number) => void;
  disabled?: boolean;
}

// ✅ Derivative extends base
interface ChartSelectProps extends SelectProps {
  charts: Chart[];
  onChartSelect: (chart: Chart) => void;
}

// ✅ Derivative with modified props  
interface DatabaseSelectProps extends Omit<SelectProps, 'value' | 'onChange'> {
  value: number;  // Narrowed type
  onChange: (databaseId: number) => void;  // Specific signature
}
```

**Common Patterns:**
- **Extension:** `extends BaseProps` - adds new props
- **Omission:** `Omit<BaseProps, 'prop'>` - removes props
- **Modification:** `Omit<BaseProps, 'prop'> & { prop: NewType }` - changes prop type
- **Restriction:** Override with narrower types (union → specific)

---

## 📋 Migration Recipe

### Step 2: File Conversion
```bash
# Use git mv to preserve history
git mv component.js component.ts
git mv Component.jsx Component.tsx
```

### Step 3: Import & Type Setup
```typescript
// Import order (enforced by linting)
import React, { FC, ReactNode } from 'react';
import { JsonObject, QueryFormData } from '@superset-ui/core';
import { Dataset } from '@superset-ui/chart-controls';
import type { Dashboard } from 'src/types/Dashboard';
```

### Step 4: Function & Component Typing
```typescript
// Functions with proper parameter/return types
export function processData(
  data: Dataset[],
  config: JsonObject
): ProcessedData[] {
  // implementation
}

// Component props with inheritance
interface ComponentProps extends BaseProps {
  data: Chart[];
  onSelect: (id: number) => void;
}

const Component: FC<ComponentProps> = ({ data, onSelect }) => {
  // implementation
};
```

### Step 5: State & Redux Typing
```typescript
// Hooks with specific types
const [data, setData] = useState<Chart[]>([]);
const [selected, setSelected] = useState<number | null>(null);

// Redux with existing RootState
const mapStateToProps = (state: RootState) => ({
  charts: state.charts,
  user: state.user,
});
```

---

## 🧠 Type Debugging Strategies (Real-World Learnings)

### The Evolution of Type Approaches
When you hit type errors, follow this debugging evolution:

#### 1. ❌ Idealized Union Types (First Attempt)
```typescript
// Looks clean but doesn't match reality
type DatasourceInput = Datasource | QueryEditor;
```
**Problem**: Real calling sites pass variations, not exact types.

#### 2. ❌ Overly Precise Types (Second Attempt)
```typescript
// Tried to match exact calling signatures
type DatasourceInput =
  | IDatasource  // From DatasourcePanel
  | (QueryEditor & { columns: ColumnMeta[] });  // From SaveQuery
```
**Problem**: Too rigid, doesn't handle legacy variations.

#### 3. ✅ Flexible Interface (Final Solution)
```typescript
// Captures what the function actually needs
interface DatasourceInput {
  name?: string | null;  // Allow null for compatibility
  datasource_name?: string | null;  // Legacy variations
  columns?: any[];  // Multiple column types accepted
  database?: { id?: number };
  // ... other optional properties
}
```
**Success**: Works with all calling sites, focuses on function needs.

### Type Debugging Process
1. **Start with compilation errors** - they show exact mismatches
2. **Examine actual usage** - look at calling sites, not idealized types  
3. **Build flexible interfaces** - capture what functions need, not rigid contracts
4. **Iterate based on downstream validation** - let calling sites guide your types

---

## 🚨 Anti-Patterns to Avoid

```typescript
// ❌ Never use any
const obj: any = {};

// ✅ Use proper types
const obj: Record<string, JsonObject> = {};

// ❌ Don't recreate base component props
interface ChartSelectProps {
  value: string;     // Duplicated from SelectProps
  onChange: () => void;  // Duplicated from SelectProps
  charts: Chart[];   // New prop
}

// ✅ Inherit and extend
interface ChartSelectProps extends SelectProps {
  charts: Chart[];   // Only new props
}

// ❌ Don't create ad-hoc type variations
interface UserInfo {
  name: string;
  email: string;
}

// ✅ Extend existing types (DRY principle)
import { User } from 'src/types/bootstrapTypes';
type UserDisplayInfo = Pick<User, 'firstName' | 'lastName' | 'email'>;

// ❌ Don't create overly rigid unions
type StrictInput = ExactTypeA | ExactTypeB;

// ✅ Create flexible interfaces for function parameters
interface FlexibleInput {
  // Focus on what the function actually needs
  commonProperty: string;
  optionalVariations?: any;  // Allow for legacy variations
}
```

## 📍 DRY Type Guidelines (WHERE TYPES BELONG)

### Type Placement Rules
**CRITICAL**: Type variations must live close to where they belong, not scattered across files.

#### ✅ Proper Type Organization
```typescript
// ❌ Don't create one-off interfaces in utility files
// src/utils/datasourceUtils.ts
interface DatasourceInput { /* custom interface */ }  // Wrong!

// ✅ Use existing types or extend them in their proper domain
// src/utils/datasourceUtils.ts
import { IDatasource } from 'src/explore/components/DatasourcePanel';
import { QueryEditor } from 'src/SqlLab/types';

// Create flexible interface that references existing types
interface FlexibleDatasourceInput {
  // Properties that actually exist across variations
}
```

#### Type Location Hierarchy
1. **Domain Types**: `src/{domain}/types.ts` (dashboard, explore, SqlLab)
2. **Component Types**: Co-located with components  
3. **Global Types**: `src/types/` directory
4. **Utility Types**: Only when they truly don't belong elsewhere

#### ✅ DRY Type Patterns
```typescript
// ✅ Extend existing domain types
interface SaveQueryData extends Pick<QueryEditor, 'sql' | 'dbId' | 'catalog'> {
  columns: ColumnMeta[];  // Add what's needed
}

// ✅ Create flexible interfaces for cross-domain utilities
interface CrossDomainInput {
  // Common properties that exist across different source types
  name?: string | null;  // Accommodate legacy null values
  // Only include properties the function actually uses
}
```

---

## 🎯 PropTypes Auto-Generation (Elegant Approach)

**IMPORTANT**: Superset has `babel-plugin-typescript-to-proptypes` configured to automatically generate PropTypes from TypeScript interfaces. Use this instead of manual PropTypes duplication!

### ❌ Manual PropTypes Duplication (Avoid This)
```typescript
export interface MyComponentProps {
  title: string;
  count?: number;
}

// 8+ lines of manual PropTypes duplication 😱
const propTypes = PropTypes.shape({
  title: PropTypes.string.isRequired,
  count: PropTypes.number,
});

export default propTypes;
```

### ✅ Auto-Generated PropTypes (Use This)
```typescript
import { InferProps } from 'prop-types';

export interface MyComponentProps {
  title: string;
  count?: number;
}

// Single validator function - babel plugin auto-generates PropTypes! ✨
export default function MyComponentValidator(props: MyComponentProps) {
  return null; // PropTypes auto-assigned by babel-plugin-typescript-to-proptypes
}

// Optional: For consumers needing PropTypes type inference
export type MyComponentPropsInferred = InferProps<typeof MyComponentValidator>;
```

### Migration Pattern for Type-Only Files

**When migrating type-only files with manual PropTypes:**

1. **Keep the TypeScript interfaces** (single source of truth)
2. **Replace manual PropTypes** with validator function
3. **Remove PropTypes imports** and manual shape definitions
4. **Add InferProps import** if type inference needed

**Example Migration:**
```typescript
// Before: 25+ lines with manual PropTypes duplication
export interface AdhocFilterType { /* ... */ }
const adhocFilterTypePropTypes = PropTypes.oneOfType([...]);

// After: 3 lines with auto-generation
export interface AdhocFilterType { /* ... */ }
export default function AdhocFilterValidator(props: { filter: AdhocFilterType }) {
  return null; // Auto-generated PropTypes by babel plugin
}
```

### Component PropTypes Pattern

**For React components, the babel plugin works automatically:**

```typescript
interface ComponentProps {
  title: string;
  onClick: () => void;
}

const MyComponent: FC<ComponentProps> = ({ title, onClick }) => {
  // Component implementation
};

// PropTypes automatically generated by babel plugin - no manual work needed!
export default MyComponent;
```

### Auto-Generation Benefits

- ✅ **Single source of truth**: TypeScript interfaces drive PropTypes
- ✅ **No duplication**: Eliminate 15-20 lines of manual PropTypes code
- ✅ **Automatic updates**: Changes to TypeScript automatically update PropTypes
- ✅ **Type safety**: Compile-time checking ensures PropTypes match interfaces
- ✅ **Backward compatibility**: Existing JavaScript components continue working

### Babel Plugin Configuration

The plugin is already configured in `babel.config.js`:
```javascript
['babel-plugin-typescript-to-proptypes', { loose: true }]
```

**No additional setup required** - just use TypeScript interfaces and the plugin handles the rest!

---

## 🧪 Test File Migration Patterns

### Test File Priority
- **Always migrate test files** alongside production files
- **Test files are often leaf nodes** - good starting candidates
- **Create tests if missing** - Leverage new TypeScript types for better test coverage

### Test-Specific Type Patterns
```typescript
// Mock interfaces for testing
interface MockStore {
  getState: () => Partial<RootState>;  // Partial allows minimal mocking
}

// Type-safe mocking for complex objects
const mockDashboardInfo: Partial<DashboardInfo> as DashboardInfo = {
  id: 123,
  json_metadata: '{}',
};

// Sinon stub typing
let postStub: sinon.SinonStub;
beforeEach(() => {
  postStub = sinon.stub(SupersetClient, 'post');
});

// Use stub reference instead of original method
expect(postStub.callCount).toBe(1);
expect(postStub.getCall(0).args[0].endpoint).toMatch('/api/');
```

### Test Migration Recipe
1. **Migrate production file first** (if both need migration)
2. **Update test imports** to point to `.ts/.tsx` files
3. **Add proper mock typing** using `Partial<T> as T` pattern
4. **Fix stub typing** - Use stub references, not original methods
5. **Verify all tests pass** with TypeScript compilation

---

## 🔧 Type Conflict Resolution

### Multiple Type Definitions Issue
**Problem**: Same type name defined in multiple files causes compilation errors.

**Example**: `DashboardInfo` defined in both:
- `src/dashboard/reducers/types.ts` (minimal)
- `src/dashboard/components/Header/types.ts` (different shape)  
- `src/dashboard/types.ts` (complete - used by RootState)

### Resolution Strategy
1. **Identify the authoritative type**:
   ```bash
   # Find which type is used by RootState/main interfaces
   grep -r "DashboardInfo" src/dashboard/types.ts
   ```

2. **Use import from authoritative source**:
   ```typescript
   // ✅ Import from main domain types
   import { RootState, DashboardInfo } from 'src/dashboard/types';

   // ❌ Don't import from component-specific files
   import { DashboardInfo } from 'src/dashboard/components/Header/types';
   ```

3. **Mock complex types in tests**:
   ```typescript
   // For testing - provide minimal required fields
   const mockInfo: Partial<DashboardInfo> as DashboardInfo = {
     id: 123,
     json_metadata: '{}',
     // Only provide fields actually used in test
   };
   ```

### Type Hierarchy Discovery Commands
```bash
# Find all definitions of a type
grep -r "interface.*TypeName\|type.*TypeName" src/

# Find import usage patterns
grep -r "import.*TypeName" src/

# Check what RootState uses
grep -A 10 -B 10 "TypeName" src/*/types.ts
```

---

## Agent Constraints (CRITICAL)

1. **Use git mv** - Run `git mv file.js file.ts` to preserve git history, but NO `git commit`
2. **NO global import changes** - Don't update imports across codebase
3. **Type files OK** - Can modify existing type files to improve/align types
4. **Downstream Impact Validation** (CRITICAL) - Your migration affects calling sites:
   - **Find downstream files**: `find superset-frontend/src -name "*.tsx" -o -name "*.ts" | xargs grep -l "your-core-filename" 2>/dev/null || echo "No files found"`
   - **Validate each downstream file individually**: `cd superset-frontend && npx tscw --noEmit --allowJs --composite false --project tsconfig.json {each-downstream-file}`
   - **Fix type mismatches** you introduced in calling sites
   - **NEVER ignore downstream errors** - they indicate your types don't match reality
5. **TypeScript validation** - Use proper TypeScript compilation commands:
   - **Per-file validation**: `cd superset-frontend && npx tscw --noEmit --allowJs --composite false --project tsconfig.json {relative-path-to-file}`
   - **Avoid `npm run type` during parallel execution** - too many false positives from other agents
6. **ESLint validation** - Run `npm run eslint -- --fix {file}` for each migrated file to auto-fix formatting/linting issues
6. Zero `any` types - use proper TypeScript types
7. Search existing types before creating new ones
8. Follow patterns from this guide

---

## Success Report Format

```
SUCCESS: Atomic Migration of {core-filename}

## Files Migrated (Atomic Unit)
- Core: {core-filename} → {core-filename.ts/tsx}
- Tests: {list-of-test-files} → {list-of-test-files.ts/tsx} OR "CREATED: {basename}.test.ts"
- Mocks: {list-of-mock-files} → {list-of-mock-files.ts}
- Type files modified: {list-of-type-files}

## Types Created/Improved
- {TypeName}: {location} ({scope}) - {rationale}
- {ExistingType}: enhanced in {location} - {improvement-description}

## Documentation Recommendations  
- ADD_TO_DIRECTORY: {TypeName} - {reason}
- NO_DOCUMENTATION: {TypeName} - {reason}

## Quality Validation
- **Downstream Impact Check**: ✅ PASS - Found {N} files importing this module, all validate successfully
  - Downstream files: {list-of-files-that-import-your-module}
  - Individual validation: `npx tscw --noEmit --allowJs --composite false --project tsconfig.json {each-file}`
- **File-level TypeScript compilation**: ✅ PASS (using `npx tscw --noEmit --allowJs --composite false --project tsconfig.json {files}`)
- **ESLint validation**: ✅ PASS (using `npm run eslint -- --fix {files}` to auto-fix formatting)
- **Zero any types**: ✅ PASS
- **Local imports resolved**: ✅ PASS
- **Functionality preserved**: ✅ PASS
- **Tests pass** (if test file): ✅ PASS
- **Follow-up action required**: {YES/NO}

## Migration Learnings
- Type conflicts encountered: {describe any multiple type definitions}
- Mock patterns used: {describe test mocking approaches}
- Import hierarchy decisions: {note authoritative type sources used}
- PropTypes strategy: {AUTO_GENERATED via babel plugin | MANUAL_DUPLICATION_REMOVED | N/A}

## Improvement Suggestions for Documentation
- AGENT.md enhancement: {suggest additions to migration guide}
- Common pattern identified: {note reusable patterns for future migrations}
```

---

## Dependency Block Report Format

```
DEPENDENCY_BLOCK: Cannot migrate {filename}

## Blocking Dependencies
- {path}: {type} - {usage} - {priority}

## Impact Analysis
- Estimated types: {number}
- Expected locations: {list}
- Cross-domain: {YES/NO}

## Recommended Order
{ordered-list}
```

---

## 📚 Quick Reference

**Type Utilities:**
- `Record<K, V>` - Object with specific key/value types
- `Partial<T>` - All properties optional
- `Pick<T, K>` - Subset of properties
- `Omit<T, K>` - Exclude specific properties
- `NonNullable<T>` - Exclude null/undefined

**Event Types:**
- `MouseEvent<HTMLButtonElement>`
- `ChangeEvent<HTMLInputElement>`
- `FormEvent<HTMLFormElement>`

**React Types:**
- `FC<Props>` - Functional component
- `ReactNode` - Any renderable content
- `CSSProperties` - Style objects

---

**Remember:** Every type should add value and clarity. The goal is meaningful type safety that catches bugs and improves developer experience.

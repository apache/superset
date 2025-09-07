# TypeScript Migration Guide for Apache Superset

Comprehensive reference for converting JavaScript/JSX files to TypeScript/TSX in Apache Superset frontend.

## 🎯 Migration Principles

1. **Atomic migration units** - Core file + all related tests/mocks migrate together
2. **Zero `any` types** - Use proper TypeScript throughout
3. **Leverage existing types** - Reuse established definitions
4. **Type inheritance** - Derivatives extend base component types
5. **Strategic placement** - File types for maximum discoverability
6. **Surgical improvements** - Enhance existing types during migration

## ⚛️ Atomic Migration Strategy

**Unit of Work**: Each migration includes:
- **1 core file** (production code)
- **All related test files** (*.test.js/jsx, *.spec.js/jsx)
- **All related mock files** (__mocks__/, *.mock.js)

**Type Consistency**: Tests and mocks must use the same types as the core file to prevent type fragmentation.

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

### Step 0: Dependency Check (MANDATORY)
```bash
grep -E "from '\.\./.*\.jsx?'|from '\./.*\.jsx?'|from 'src/.*\.jsx?'" [target-file]
```
- No matches → Proceed  
- Matches found → Report dependencies and exit

### Step 1: File Conversion (Agent-Safe)
```bash
# Create TypeScript file alongside original (coordinator handles git mv)
cp component.js component.ts    # Agent creates, coordinator moves
cp Component.jsx Component.tsx
```

### Step 2: Import & Type Setup
```typescript
// Import order (enforced by linting)
import React, { FC, ReactNode } from 'react';
import { JsonObject, QueryFormData } from '@superset-ui/core';
import { Dataset } from '@superset-ui/chart-controls';
import type { Dashboard } from 'src/types/Dashboard';
```

### Step 3: Function & Component Typing
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

### Step 4: State & Redux Typing
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

// ❌ Don't create duplicate types
interface UserInfo {
  name: string;
  email: string;
}

// ✅ Extend existing types
import { User } from 'src/types/bootstrapTypes';
type UserDisplayInfo = Pick<User, 'firstName' | 'lastName' | 'email'>;
```

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

## 📋 Coordinator Integration Patterns

### Side-Effect Categories

**Automatic Integration** ✅ (No coordinator action needed):
- TypeScript compilation passes immediately
- No import updates needed across codebase

**Coordinator Integration** 🔧 (Common - expect this):
- TypeScript compilation fails BUT subagent work is high quality
- Type import conflicts need resolution
- Mock objects need complete type satisfaction
- **Action**: Fix type conflicts, maintain subagent's good work

**Rollback Required** ❌ (Rare):
- Subagent introduced `any` types or poor patterns
- Fundamental approach needs rework

### Integration Workflow
1. **Review subagent's types** - Check for `any`, proper inheritance, good placement
2. **Run TypeScript compilation** - `npm run type`
3. **Resolve type conflicts**:
   - Import from authoritative sources
   - Complete mock objects with proper typing
   - Fix stub method references
4. **Verify tests still pass** - `npm test -- filename.test.ts`
5. **Commit with git history** - Git usually auto-detects renames

---

## 🎯 Quality Gates

**Before completing migration:**
- [ ] TypeScript compilation passes
- [ ] Zero `any` types used
- [ ] All imports resolved
- [ ] Functionality unchanged
- [ ] Types placed in discoverable locations
- [ ] Existing types reused where possible

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

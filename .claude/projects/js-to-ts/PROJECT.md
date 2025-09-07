# JavaScript to TypeScript Migration Project

Apache Superset frontend migration from 219 JS/JSX files to TypeScript with dependency-aware coordination.

## 📋 Migration Overview

**Scope**: 219 files total (112 JS + 107 JSX)
- Production files: 139 (63%)  
- Test files: 80 (37%)

**Key Directories**:
- Dashboard: 118 files (54% of total)
- Explore: 60 files (27% of total)  
- Components: 19 files (9% of total)
- Utils: 8 files (4% of total)

## 🎯 Migration Commands

### Agent Command
```bash
/js-to-ts <core-filename>
```
**Agent Role**: Atomic migration of core file + all related tests/mocks. Use `git mv`, NO global changes. Coordinator reviews and commits. See [../../commands/js-to-ts.md](../../commands/js-to-ts.md)

**Migration Patterns**: Reference [.claude/projects/js-to-ts/INSTRUCTIONS.md](./INSTRUCTIONS.md) for type organization, inheritance patterns, and quality gates.

### Coordinator Responsibilities

#### 1. Core File Selection Strategy
**Target ONLY Core Files**: Coordinators identify core files (production code), agents handle related tests/mocks atomically.

**File Analysis Commands**:
```bash
# Find CORE files with no JS/JSX dependencies (exclude tests/mocks)
find superset-frontend/src -name "*.js" -o -name "*.jsx" | grep -v "test\|spec\|mock" | head -10

# Check dependencies for core files only
for file in <core-files>; do
  grep -E "from '\.\./.*\.jsx?'|from '\./.*\.jsx?'|from 'src/.*\.jsx?'" "$file" || echo "LEAF CANDIDATE: $file"
done

# Identify heavily imported files (migrate last)  
grep -r "from.*utils/common" superset-frontend/src/ | wc -l
```

**Priority Order**:
1. **Core leaf files** - No JS/JSX imports, only external libraries (utils, middleware)
2. **Core utility files with minimal dependencies**  
3. **Core component files importing only already-migrated files**
4. **Core foundational files** (utils/common.js, controls.jsx) - migrate last

**Migration Unit**: Each agent call migrates:
- 1 core file (primary target)
- All related `*.test.js/jsx` files
- All related `*.mock.js` files  
- All related `__mocks__/` files

#### 2. Agent Control Workflow
**For Each File**:
1. **Execute**: `/js-to-ts <filename>`
2. **Review**: Evaluate agent's work against criteria
3. **Test**: Run `npm run type` for global TypeScript compilation
4. **Gate**: Decide push forward or rollback based on evaluation

**Agent SUCCESS Report Review**:
- ✅ **Type Usage**: Proper types used, no `any` types
- ✅ **Type Filing**: Types placed in correct hierarchy (component → feature → domain → global)
- ✅ **Side Effects**: No unintended changes to other files
- ✅ **Import Alignment**: Proper .ts/.tsx import extensions

#### 3. Integration Decision Framework

**Automatic Integration** ✅:
- `npm run type` passes without errors
- Agent created clean TypeScript with proper types
- Types appropriately filed in hierarchy

**Coordinator Integration** (Fix Side-Effects) 🔧:
- `npm run type` fails BUT agent's work is high quality
- Good type usage, proper patterns, well-organized
- Side-effects are manageable TypeScript compilation errors
- **Coordinator Action**: Integrate the change, then fix global compilation issues

**Rollback Only** ❌:
- Agent introduced `any` types or poor type choices
- Types poorly organized or conflicting with existing patterns
- Fundamental approach issues requiring complete rework

**Integration Process**:
1. **Review**: Agent already used `git mv` to preserve history
2. **Fix Side-Effects**: Update dependent files with proper import extensions
3. **Resolve Types**: Fix any cascading type issues across codebase
4. **Validate**: Ensure `npm run type` passes after fixes

### Learned Integration Patterns

**Common Side-Effects (Expect These)**:
- **Type import conflicts**: Multiple definitions of same type name
- **Mock object typing**: Tests need complete type satisfaction
- **Stub method references**: Use stub vars instead of original methods

**Coordinator Fixes (Standard Process)**:
1. **Import Resolution**:
   ```bash
   # Find authoritative type source
   grep -r "TypeName" src/*/types.ts
   # Import from domain types (src/dashboard/types.ts) not component types
   ```

2. **Test Mock Completion**:
   ```typescript
   // Use Partial<T> as T pattern for minimal mocking
   const mockDashboard: Partial<DashboardInfo> as DashboardInfo = {
     id: 123,
     json_metadata: '{}',
   };
   ```

3. **Stub Reference Fixes**:
   ```typescript
   // ✅ Use stub variable
   expect(postStub.callCount).toBe(1);
   // ❌ Don't use original method
   expect(SupersetClient.post.callCount).toBe(1);
   ```

4. **Validation Commands**:
   ```bash
   npm run type          # TypeScript compilation
   npm test -- filename  # Test functionality
   git status           # Should show rename, not add/delete
   ```

## 🎯 File Categories for Coordinator

### Leaf Files (Start Here)
**Self-contained files with minimal JS/JSX dependencies**:
- Test files (80 files) - Usually only import the file being tested
- Utility files without internal dependencies
- Components importing only external libraries

### Heavily Imported Files (Migrate Last)
**Core files that many others depend on**:
- `utils/common.js` - Core utility functions
- `utils/reducerUtils.js` - Redux helpers  
- `@superset-ui/core` equivalent files
- Major state management files (`explore/store.js`, `dashboard/actions/`)

### Complex Components (Middle Priority)  
**Large files requiring careful type analysis**:
- `components/Datasource/DatasourceEditor.jsx` (1,809 lines)
- `explore/components/controls/AnnotationLayerControl/AnnotationLayer.jsx` (1,031 lines)
- `explore/components/ExploreViewContainer/index.jsx` (911 lines)

## 📊 Coordinator Success Metrics

**Per-File Gates**:
- ✅ `npm run type` passes after each migration
- ✅ Zero `any` types introduced
- ✅ All imports properly typed
- ✅ Types filed in correct hierarchy

**Overall Progress**:
- Track leaf-to-core migration progress
- Document rollback reasons for learning
- Maintain 100% TypeScript compilation throughout
- Ensure type safety improves with each successful migration

## 🔄 Continuous Improvement Process

**After Each Migration**:
1. **Update guides** with new patterns discovered
2. **Document coordinator fixes** that become common
3. **Enhance subagent instructions** based on recurring issues
4. **Track success metrics** - automatic vs coordinator integration rates

**Guide Enhancement Areas**:
- **INSTRUCTIONS.md**: Type patterns, conflict resolution, test strategies
- **js-to-ts command**: Success report format, learning capture
- **PROJECT.md**: Integration workflows, side-effect patterns

**Success Indicators**:
- Higher automatic integration rate (fewer coordinator fixes needed)
- Faster coordinator resolution of common issues  
- Improved subagent type quality and placement decisions

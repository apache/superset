# JS-to-TS Coordinator Workflow

**Role:** Strategic migration coordination - select leaf-node files, trigger agents, review results, handle integration, manage dependencies.

---

## 1. Core File Selection Strategy

**Target ONLY Core Files**: Coordinators identify core files (production code), agents handle related tests/mocks atomically.

**File Analysis Commands**:
```bash
# Find CORE files with no JS/JSX dependencies (exclude tests/mocks) - SIZE PRIORITIZED
find superset-frontend/src -name "*.js" -o -name "*.jsx" | grep -v "test\|spec\|mock" | xargs wc -l | sort -n | head -20

# Alternative: Get file sizes in lines with paths
find superset-frontend/src -name "*.js" -o -name "*.jsx" | grep -v "test\|spec\|mock" | while read file; do
  lines=$(wc -l < "$file")
  echo "$lines $file"
done | sort -n | head -20

# Check dependencies for core files only (start with smallest)
for file in <core-files-sorted-by-size>; do
  echo "=== $file ($(wc -l < "$file") lines) ==="
  grep -E "from '\.\./.*\.jsx?'|from '\./.*\.jsx?'|from 'src/.*\.jsx?'" "$file" || echo "✅ LEAF CANDIDATE"
done

# Identify heavily imported files (migrate last)  
grep -r "from.*utils/common" superset-frontend/src/ | wc -l

# Quick leaf analysis with size priority
find superset-frontend/src -name "*.js" -o -name "*.jsx" | grep -v "test\|spec\|mock" | head -30 | while read file; do
  deps=$(grep -E "from '\.\./.*\.jsx?'|from '\./.*\.jsx?'|from 'src/.*\.jsx?'" "$file" | wc -l)
  lines=$(wc -l < "$file")
  if [ "$deps" -eq 0 ]; then
    echo "✅ LEAF: $lines lines - $file"
  fi
done | sort -n
```

**Priority Order** (Smallest files first for easier wins):
1. **Small leaf files** (<50 lines) - No JS/JSX imports, quick TypeScript conversion
2. **Medium leaf files** (50-200 lines) - Self-contained utilities and helpers  
3. **Small dependency files** (<100 lines) - Import only already-migrated files
4. **Larger components** (200+ lines) - Complex but well-contained functionality
5. **Core foundational files** (utils/common.js, controls.jsx) - migrate last regardless of size

**Size-First Benefits**:
- Faster completion builds momentum
- Earlier validation of migration patterns
- Easier rollback if issues arise
- Better success rate for agent learning

**Migration Unit**: Each agent call migrates:
- 1 core file (primary target)
- All related `*.test.js/jsx` files
- All related `*.mock.js` files  
- All related `__mocks__/` files

---

## 2. Task Creation & Agent Control

### Task Triggering
When triggering the `/js-to-ts` command:
- **Task Title**: Use the core filename as the task title (e.g., "DebouncedMessageQueue.js migration", "hostNamesConfig.js migration")
- **Task Description**: Include the full relative path to help agent locate the file
- **Reference**: Point agent to [AGENT.md](./AGENT.md) for technical instructions

### Post-Processing Workflow
After each agent completes:

1. **Review Agent Report**: Always read and analyze the complete agent report
2. **Share Summary**: Provide user with key highlights from agent's work:
   - Files migrated (core + tests/mocks)
   - Types created or improved
   - Any validation issues or coordinator actions needed
3. **Quality Assessment**: Evaluate agent's TypeScript implementation against criteria:
   - ✅ **Type Usage**: Proper types used, no `any` types
   - ✅ **Type Filing**: Types placed in correct hierarchy (component → feature → domain → global)
   - ✅ **Side Effects**: No unintended changes to other files
   - ✅ **Import Alignment**: Proper .ts/.tsx import extensions
4. **Integration Decision**:
   - **COMMIT**: If agent work is complete and high quality
   - **FIX & COMMIT**: If minor issues need coordinator fixes
   - **ROLLBACK**: If major issues require complete rework
5. **Next Action**: Ask user preference - commit this work or trigger next migration

---

## 3. Integration Decision Framework

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

---

## 4. Common Integration Patterns

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

---

## 5. File Categories for Planning

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

---

## 6. Success Metrics & Continuous Improvement

**Per-File Gates**:
- ✅ `npm run type` passes after each migration
- ✅ Zero `any` types introduced
- ✅ All imports properly typed
- ✅ Types filed in correct hierarchy

**Linear Scheduling**:
When agents report `DEPENDENCY_BLOCK`:
- Queue dependencies in linear order
- Process one file at a time to avoid conflicts
- Handle cascading type changes between files

**After Each Migration**:
1. **Update guides** with new patterns discovered
2. **Document coordinator fixes** that become common
3. **Enhance agent instructions** based on recurring issues
4. **Track success metrics** - automatic vs coordinator integration rates

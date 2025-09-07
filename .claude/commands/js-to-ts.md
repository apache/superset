# JavaScript to TypeScript Migration Command

Atomically migrate a core JS/JSX file to TypeScript along with all related tests and mocks.

## Usage
```
/js-to-ts <core-filename>
```
- `<core-filename>` - Path to CORE file relative to `superset-frontend/` (e.g., `src/utils/common.js`, `src/middleware/loggerMiddleware.js`)
- **CORE FILES ONLY**: No test files, mock files - agent will find and migrate related files automatically
- **Task Title**: Use core filename as task title (e.g., "DebouncedMessageQueue.js migration")

---

## Agent Instructions

**Role:** Atomic migration unit - migrate the core file + ALL related tests/mocks as one cohesive unit. Use `git mv` to preserve history, NO `git commit`. NO global import changes. Report to coordinator for integration.

**Technical Reference:** Follow patterns in [.claude/projects/js-to-ts/INSTRUCTIONS.md](../projects/js-to-ts/INSTRUCTIONS.md) for type organization, migration recipes, and quality gates.

**Atomic Migration Scope:**
For core file `src/utils/example.js`, also migrate:
- `src/utils/example.test.js` / `src/utils/example.test.jsx`
- `src/utils/example.spec.js` / `src/utils/example.spec.jsx`
- `src/utils/__mocks__/example.js`
- Any other related test/mock files found by pattern matching

### Step 0: Dependency Check (MANDATORY)

**Command:**
```bash
grep -E "from '\.\./.*\.jsx?'|from '\./.*\.jsx?'|from 'src/.*\.jsx?'" superset-frontend/{filename}
```

**Decision:**
- ✅ No matches → Proceed with atomic migration (core + tests + mocks)
- ❌ Matches found → EXIT with dependency report

### Step 1: Identify Related Files (REQUIRED)

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

### Success Report Format
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
- File-level TypeScript compilation: ✅ PASS (using `npx tscw --noEmit --allowJs --composite false --project tsconfig.json {files}`)
- ESLint validation: ✅ PASS (using `npm run eslint -- {files}`)
- Zero any types: ✅ PASS
- Local imports resolved: ✅ PASS
- Functionality preserved: ✅ PASS
- Tests pass (if test file): ✅ PASS
- Project-wide compilation note: {PASS/ISSUES-UNRELATED/ISSUES-RELATED} (from `npm run type`)
- Coordinator action required: {YES/NO}

## Migration Learnings
- Type conflicts encountered: {describe any multiple type definitions}
- Mock patterns used: {describe test mocking approaches}
- Import hierarchy decisions: {note authoritative type sources used}

## Improvement Suggestions for Documentation
- INSTRUCTIONS.md enhancement: {suggest additions to migration guide}
- Common pattern identified: {note reusable patterns for future migrations}
```

### Dependency Block Report Format
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

### Agent Constraints (CRITICAL)
1. **Use git mv** - Run `git mv file.js file.ts` to preserve git history, but NO `git commit`
2. **NO global import changes** - Don't update imports across codebase
3. **Type files OK** - Can modify existing type files to improve/align types
4. **TypeScript validation** - Use proper TypeScript compilation commands:
   - **Per-file validation**: `cd superset-frontend && npx tscw --noEmit --allowJs --composite false --project tsconfig.json {relative-path-to-file}`
   - **Project-wide scan**: `npm run type` (only consider errors related to your files - other agents may be working in parallel)
5. **ESLint validation** - Run `npm run eslint -- {file}` for each migrated file to ensure formatting/linting
6. Zero `any` types - use proper TypeScript types
7. Search existing types before creating new ones
8. Follow patterns from INSTRUCTIONS.md

---

## Coordinator Actions

### Task Creation (Coordinator)
When triggering the `/js-to-ts` command:
- **Task Title**: Use the core filename as the task title (e.g., "DebouncedMessageQueue.js migration", "hostNamesConfig.js migration")
- **Task Description**: Include the full relative path to help agent locate the file

### Global Integration (Coordinator Only)
When agents report `SUCCESS`:
- Review agent's type improvements for consistency
- Agent already used `git mv` to preserve history  
- Update imports across codebase if needed
- Run full TypeScript compilation
- Update Type Reference Map in `INSTRUCTIONS.md`
- Merge any type file conflicts

### Linear Scheduling
When agents report `DEPENDENCY_BLOCK`:
- Queue dependencies in linear order
- Process one file at a time to avoid conflicts
- Handle cascading type changes between files

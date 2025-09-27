---
title: TypeScript Guidelines
sidebar_position: 2
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

# TypeScript Guidelines

🚧 **Coming Soon** 🚧

TypeScript-specific coding standards for Superset frontend development.

## Topics to be covered:

- TypeScript configuration
- Type definitions best practices
- Avoiding `any` types
- Interface vs Type aliases
- Generic types usage
- Utility types
- Strict mode compliance
- Module imports/exports
- Async/await patterns
- Error handling in TypeScript

## Key Rules

1. **No `any` types** - Use proper TypeScript types
2. **Prefer interfaces** for object shapes
3. **Use enums** for fixed sets of values
4. **Enable strict mode** in tsconfig
5. **Export types separately** from implementations

## Quick Examples

```typescript
// ❌ Bad
const data: any = fetchData();

// ✅ Good
interface DataResponse {
  id: number;
  name: string;
}
const data: DataResponse = fetchData();
```

---

*This documentation is under active development. Check back soon for updates!*

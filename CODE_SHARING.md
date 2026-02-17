# Code Sharing Strategy

This document explains the code sharing approach used across KitchenHub and VehicleHub.

## Common Library Structure

The `common/` folder at the project root contains shared code that can be reused across multiple hub services.

### Current Shared Code

1. **`common/database/db-config.js`** - Shared PostgreSQL connection pool configuration
   - Used by: KitchenHub backend, VehicleHub backend
   - Provides: `createDbPool()` and `testConnection()` functions
   - Benefits: Consistent database connection handling, easier maintenance

2. **`common/api/api-client.js`** - Reference implementation for API client setup
   - Used as: Reference only (frontend code inlines this for bundling)
   - Provides: Standard axios configuration pattern
   - Note: Frontend services inline this code since it needs to be bundled with Vite

## How It Works

### Backend Services

Backend services import the shared database configuration:

```javascript
const { createDbPool, testConnection } = require('../../common/database/db-config');

const pool = createDbPool({
  database: process.env.DB_NAME || 'yourdb',
});

testConnection(pool);
```

The Docker build context is set to the project root so the common folder is accessible:

```dockerfile
# In Dockerfile
COPY common ./common
```

```yaml
# In docker-compose.yml
build:
  context: ..
  dockerfile: kitchenhub/backend/Dockerfile
```

### Frontend Services

Frontend services inline the API client code since it needs to be bundled:

```javascript
// In frontend/src/api/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

This approach is used because:
- Vite needs to bundle the code at build time
- The common folder would require additional build configuration
- The API client code is small and simple enough to inline

## Future Improvements

### Potential Shared Code

1. **Validation utilities** - Form validation, data sanitization
2. **Date/time formatting** - Consistent date display across services
3. **Error handling** - Standardized error response formats
4. **Authentication** - If auth is added in the future
5. **Logging utilities** - Consistent logging across services

### Alternative Approaches

1. **npm package** - Create a private npm package for truly shared code
2. **Git submodule** - Use git submodules for the common folder
3. **Monorepo tool** - Use tools like Lerna or Nx for better monorepo management

## Adding New Shared Code

1. Add the shared code to the `common/` folder
2. Update backend services to import from `../../common/`
3. For frontend, either:
   - Inline the code if it's small and simple
   - Create a build step to copy from common if it's more complex
4. Update Dockerfiles to copy the common folder
5. Document the shared code in this file

## Benefits

- **DRY Principle** - Don't Repeat Yourself
- **Consistency** - Same patterns across services
- **Maintainability** - Fix bugs once, benefit everywhere
- **Easier Testing** - Test shared code once

## Trade-offs

- **Build Complexity** - Docker builds need correct context
- **Coupling** - Services are coupled to the common folder structure
- **Versioning** - Changes to common code affect all services

For the current scale of the project, this approach provides good benefits with manageable complexity.

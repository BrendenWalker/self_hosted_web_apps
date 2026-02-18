# Common Library

This folder contains shared code that can be used across multiple hub services (KitchenHub, VehicleHub, etc.).

## Structure

- `database/db-config.js` - Shared PostgreSQL connection pool configuration for backend services
- `api/api-client.js` - Shared API client setup (currently used as reference, frontend implementations inline the code)

## Usage

### Backend Services

Backend services can import the database configuration:

```javascript
const { createDbPool, testConnection } = require('../../common/database/db-config');

const pool = createDbPool({
  database: process.env.DB_NAME || 'yourdb',
});

testConnection(pool);
```

### Frontend Services

Frontend services should inline the API client code since it needs to be bundled. The `api-client.js` file serves as a reference implementation.

## Future Improvements

- Consider creating an npm package for truly shared code
- Add more shared utilities as needed (validation, formatting, etc.)

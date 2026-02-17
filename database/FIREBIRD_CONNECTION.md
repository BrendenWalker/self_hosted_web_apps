# Firebird Connection Troubleshooting

## "No matching plugins on server" Error

This error occurs when the authentication method used by the client doesn't match what the Firebird server expects.

### Solution 1: Specify Authentication Plugin in DBeaver

1. Open DBeaver connection settings
2. Go to **Driver properties** tab
3. Add a new property:
   - **Property name**: `authPlugin`
   - **Property value**: Try one of these:
     - `Srp` (for Firebird 3.0+)
     - `Legacy_UserManager` (for Firebird 2.5 or if Srp doesn't work)
     - `Srp256` (alternative for Firebird 3.0+)

### Solution 2: Use Legacy Authentication

If you're using Firebird 3.0+ but need Legacy authentication:

1. Edit Firebird configuration file (usually `/etc/firebird/3.0/firebird.conf` or similar)
2. Find the `AuthServer` setting
3. Add `Legacy_UserManager` to the list:
   ```
   AuthServer = Legacy_UserManager, Srp, Srp256
   ```
4. Restart Firebird server

### Solution 3: Connection String Format

Try different connection string formats in DBeaver:

**Format 1 (with auth plugin):**
```
jdbc:firebirdsql://poot:3050//home/firebird/hausfrau.fdb?authPlugin=Srp
```

**Format 2 (Legacy auth):**
```
jdbc:firebirdsql://poot:3050//home/firebird/hausfrau.fdb?authPlugin=Legacy_UserManager
```

**Format 3 (with role):**
```
jdbc:firebirdsql://poot:3050//home/firebird/hausfrau.fdb?role=SYSDBA&authPlugin=Srp
```

### Solution 4: Check Firebird Version

Determine your Firebird version:
```bash
# On the server
isql-fb -z
# or
fbguard -version
```

- **Firebird 2.5**: Use `Legacy_UserManager`
- **Firebird 3.0+**: Try `Srp` first, fall back to `Legacy_UserManager` if needed

### Solution 5: Verify User Credentials

Make sure the user exists and password is correct:

```sql
-- Connect as SYSDBA and check users
SELECT SEC$USER_NAME, SEC$PLUGIN 
FROM SEC$USERS;
```

### Solution 6: For the Migration Script

If the migration script fails with authentication errors, edit `migrate-from-firebird.js` and try:

```javascript
const firebirdConfig = {
  // ... other settings ...
  authPlugin: 'Legacy_UserManager',  // Try this if default fails
  // or
  authPlugin: 'Srp',                 // Try this for Firebird 3.0+
};
```

### Solution 7: Direct File Access (Alternative)

If network connection is problematic, you can:

1. Copy the `.fdb` file locally
2. Use local file path in connection:
   ```
   jdbc:firebirdsql:localhost:/path/to/local/hausfrau.fdb
   ```

### Common Connection Strings

**DBeaver (JDBC):**
```
jdbc:firebirdsql://host:port//path/to/database.fdb
```

**isql (command line):**
```bash
isql-fb -user SYSDBA -password masterkey host:/path/to/database.fdb
```

**Node.js (node-firebird):**
```javascript
{
  host: 'hostname',
  port: 3050,
  database: '/path/to/database.fdb',
  user: 'SYSDBA',
  password: 'masterkey',
  authPlugin: 'Srp'  // or 'Legacy_UserManager'
}
```

## Testing Connection

### Using isql (command line)

```bash
# Test with Legacy auth
isql-fb -user SYSDBA -password masterkey poot:/home/firebird/hausfrau.fdb

# If that works, try the migration script with Legacy_UserManager
```

### Using DBeaver

1. Create new connection
2. Select "Firebird" database
3. Set:
   - Host: `poot`
   - Port: `3050`
   - Database: `/home/firebird/hausfrau.fdb`
   - User: `SYSDBA`
   - Password: `masterkey`
4. In Driver properties, add `authPlugin` = `Legacy_UserManager` or `Srp`
5. Test connection

## Still Having Issues?

1. Check Firebird server logs (usually in `/var/log/firebird/` or similar)
2. Verify firewall allows port 3050
3. Check if Firebird server is running: `ps aux | grep firebird`
4. Try connecting from the server itself (localhost) first
5. Verify the database file path is correct and accessible

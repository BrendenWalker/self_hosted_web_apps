# PowerShell script to migrate Firebird data to PostgreSQL using isql
# Usage: .\migrate-with-isql.ps1

$ErrorActionPreference = "Stop"

# Configuration
$isqlPath = "C:\Program Files\Firebird\Firebird_3_0\isql.exe"
$firebirdHost = "poot"
$firebirdDatabase = "/home/firebird/hausfrau.fdb"
$firebirdUser = "SYSDBA"
$firebirdPassword = "masterkey"
$outputFile = Join-Path $PSScriptRoot "seed-data.sql"

# Check if isql exists
if (-not (Test-Path $isqlPath)) {
    Write-Host "Error: isql.exe not found at $isqlPath" -ForegroundColor Red
    Write-Host "Please update the isqlPath variable in this script" -ForegroundColor Yellow
    exit 1
}

Write-Host "Starting Firebird to PostgreSQL migration using isql..." -ForegroundColor Green
Write-Host ""

# Function to escape SQL strings
function Escape-SQLString {
    param([string]$value)
    if ([string]::IsNullOrEmpty($value)) {
        return "NULL"
    }
    # Escape single quotes by doubling them
    $escaped = $value -replace "'", "''"
    return "'$escaped'"
}

# Function to export table data
function Export-Table {
    param(
        [string]$tableName,
        [string]$sqlQuery,
        [string[]]$columns
    )
    
    Write-Host "Exporting $tableName..." -ForegroundColor Cyan
    
    # Create temporary SQL file for isql
    $tempSqlFile = Join-Path $env:TEMP "export_$tableName.sql"
    $sqlContent = @"
SET HEADING OFF;
SET TERM ^;
EXECUTE BLOCK
AS
BEGIN
  FOR SELECT $sqlQuery FROM $tableName INTO :row_data DO
  BEGIN
    SUSPEND;
  END
END^
SET TERM ;^
"@
    
    # Actually, let's use a simpler approach - just SELECT with formatting
    $exportQuery = "SELECT $sqlQuery FROM $tableName ORDER BY 1;"
    
    # Write query to temp file
    $exportQuery | Out-File -FilePath $tempSqlFile -Encoding ASCII
    
    # Run isql and capture output
    $isqlArgs = @(
        "-user", $firebirdUser,
        "-password", $firebirdPassword,
        "$($firebirdHost):$firebirdDatabase",
        "-i", $tempSqlFile
    )
    
    try {
        $output = & $isqlPath $isqlArgs 2>&1 | Out-String
        
        # Parse output and generate INSERT statements
        $lines = $output -split "`n" | Where-Object { $_.Trim() -ne "" -and $_ -notmatch "Database:|Statement|^CON>" }
        
        if ($lines.Count -eq 0) {
            Write-Host "  No data found" -ForegroundColor Yellow
            return "`n-- No data found in $tableName`n`n"
        }
        
        Write-Host "  Found $($lines.Count) row(s)" -ForegroundColor Green
        
        # Generate INSERT statements
        $sql = "`n-- ============================================`n"
        $sql += "-- $($tableName.ToUpper())`n"
        $sql += "-- ============================================`n"
        $sql += "-- $($lines.Count) row(s)`n`n"
        
        # Process in batches
        $batchSize = 100
        for ($i = 0; $i -lt $lines.Count; $i += $batchSize) {
            $batch = $lines[$i..([Math]::Min($i + $batchSize - 1, $lines.Count - 1))]
            
            $columnList = ($columns | ForEach-Object { "`"$_`"" }) -join ", "
            $sql += "INSERT INTO $tableName ($columnList) VALUES`n"
            
            $values = @()
            foreach ($line in $batch) {
                $fields = $line -split "\s*\|\s*" | ForEach-Object { $_.Trim() }
                $rowValues = @()
                for ($j = 0; $j -lt $columns.Count; $j++) {
                    $val = if ($j -lt $fields.Count) { $fields[$j] } else { "" }
                    if ([string]::IsNullOrWhiteSpace($val) -or $val -eq "NULL") {
                        $rowValues += "NULL"
                    } else {
                        $rowValues += (Escape-SQLString $val)
                    }
                }
                $comma = if ($line -ne $batch[-1]) { "," } else { "" }
                $values += "  ($($rowValues -join ', '))$comma"
            }
            
            $sql += ($values -join "`n") + "`n"
            
            # Add ON CONFLICT clause
            if ($tableName -eq "department") {
                $sql += "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;`n`n"
            } elseif ($tableName -eq "store") {
                $sql += "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;`n`n"
            } elseif ($tableName -eq "storezones") {
                $sql += "ON CONFLICT (storeid, zonesequence, departmentid) DO UPDATE SET zonename = EXCLUDED.zonename;`n`n"
            } elseif ($tableName -eq "items") {
                $sql += "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, department = EXCLUDED.department, qty = EXCLUDED.qty, changed = EXCLUDED.changed;`n`n"
            } elseif ($tableName -eq "shopping_list") {
                $sql += "ON CONFLICT (name) DO UPDATE SET department_id = EXCLUDED.department_id, description = EXCLUDED.description, quantity = EXCLUDED.quantity, purchased = EXCLUDED.purchased, item_id = EXCLUDED.item_id;`n`n"
            } elseif ($tableName -eq "unit_type") {
                $sql += "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;`n`n"
            } else {
                $sql += ";`n`n"
            }
        }
        
        return $sql
    } catch {
        Write-Host "  Error: $_" -ForegroundColor Red
        return "`n-- Error exporting $tableName : $_`n`n"
    } finally {
        if (Test-Path $tempSqlFile) {
            Remove-Item $tempSqlFile -Force
        }
    }
}

# Better approach: Use isql with formatted output
function Export-TableSimple {
    param(
        [string]$tableName,
        [string]$selectClause,
        [string[]]$columns
    )
    
    Write-Host "Exporting $tableName..." -ForegroundColor Cyan
    
    # Create temp SQL file
    $tempSqlFile = Join-Path $env:TEMP "export_$tableName.sql"
    $query = "SELECT $selectClause FROM $tableName ORDER BY 1;`nEXIT;"
    $query | Out-File -FilePath $tempSqlFile -Encoding ASCII -NoNewline
    
    # Run isql
    $isqlArgs = @(
        "-user", $firebirdUser,
        "-password", $firebirdPassword,
        "$($firebirdHost):$firebirdDatabase",
        "-i", $tempSqlFile
    )
    
    try {
        $process = Start-Process -FilePath $isqlPath -ArgumentList $isqlArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$env:TEMP\isql_output_$tableName.txt" -RedirectStandardError "$env:TEMP\isql_error_$tableName.txt"
        
        $output = Get-Content "$env:TEMP\isql_output_$tableName.txt" -Raw
        $errorOutput = Get-Content "$env:TEMP\isql_error_$tableName.txt" -Raw
        
        if ($process.ExitCode -ne 0 -and $errorOutput) {
            Write-Host "  Warning: $errorOutput" -ForegroundColor Yellow
        }
        
        # Parse output - isql outputs data with pipe separators
        $lines = $output -split "`n" | Where-Object { 
            $line = $_.Trim()
            $line -ne "" -and 
            $line -notmatch "^Database:" -and 
            $line -notmatch "^Statement" -and 
            $line -notmatch "^CON>" -and
            $line -notmatch "^SQL>" -and
            $line -match "\|"
        }
        
        if ($lines.Count -eq 0) {
            Write-Host "  No data found" -ForegroundColor Yellow
            return "`n-- No data found in $tableName`n`n"
        }
        
        Write-Host "  Found $($lines.Count) row(s)" -ForegroundColor Green
        
        # Generate INSERT statements
        $sql = "`n-- ============================================`n"
        $sql += "-- $($tableName.ToUpper())`n"
        $sql += "-- ============================================`n"
        $sql += "-- $($lines.Count) row(s)`n`n"
        
        $columnList = ($columns | ForEach-Object { "`"$_`"" }) -join ", "
        $sql += "INSERT INTO $tableName ($columnList) VALUES`n"
        
        $values = @()
        foreach ($line in $lines) {
            # Split by pipe, but handle quoted values
            $fields = @()
            $currentField = ""
            $inQuotes = $false
            
            for ($i = 0; $i -lt $line.Length; $i++) {
                $char = $line[$i]
                if ($char -eq '"') {
                    $inQuotes = -not $inQuotes
                    $currentField += $char
                } elseif ($char -eq '|' -and -not $inQuotes) {
                    $fields += $currentField.Trim()
                    $currentField = ""
                } else {
                    $currentField += $char
                }
            }
            if ($currentField) {
                $fields += $currentField.Trim()
            }
            
            # Map fields to columns
            $rowValues = @()
            for ($j = 0; $j -lt $columns.Count; $j++) {
                $val = if ($j -lt $fields.Count) { $fields[$j].Trim('"') } else { "" }
                if ([string]::IsNullOrWhiteSpace($val) -or $val -eq "NULL" -or $val -eq "<null>") {
                    $rowValues += "NULL"
                } else {
                    $rowValues += (Escape-SQLString $val)
                }
            }
            
            $comma = if ($line -ne $lines[-1]) { "," } else { "" }
            $values += "  ($($rowValues -join ', '))$comma"
        }
        
        $sql += ($values -join "`n") + "`n"
        
        # Add ON CONFLICT clause
        switch ($tableName) {
            "department" { $sql += "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;`n`n" }
            "store" { $sql += "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;`n`n" }
            "StoreZones" { $sql += "ON CONFLICT (storeid, zonesequence, departmentid) DO UPDATE SET zonename = EXCLUDED.zonename;`n`n" }
            "storezones" { $sql += "ON CONFLICT (storeid, zonesequence, departmentid) DO UPDATE SET zonename = EXCLUDED.zonename;`n`n" }
            "items" { $sql += "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, department = EXCLUDED.department, qty = EXCLUDED.qty, changed = EXCLUDED.changed;`n`n" }
            "Shopping_List" { 
                if ($columns -contains "purchased") {
                    $sql += "ON CONFLICT (name) DO UPDATE SET department_id = EXCLUDED.department_id, description = EXCLUDED.description, quantity = EXCLUDED.quantity, purchased = EXCLUDED.purchased, item_id = EXCLUDED.item_id;`n`n"
                } else {
                    $sql += "ON CONFLICT (name) DO UPDATE SET department_id = EXCLUDED.department_id, description = EXCLUDED.description, quantity = EXCLUDED.quantity, item_id = EXCLUDED.item_id;`n`n"
                }
            }
            "shopping_list" { $sql += "ON CONFLICT (name) DO UPDATE SET department_id = EXCLUDED.department_id, description = EXCLUDED.description, quantity = EXCLUDED.quantity, purchased = EXCLUDED.purchased, item_id = EXCLUDED.item_id;`n`n" }
            "unit_type" { $sql += "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;`n`n" }
            default { $sql += ";`n`n" }
        }
        
        return $sql
    } catch {
        Write-Host "  Error: $_" -ForegroundColor Red
        return "`n-- Error exporting $tableName : $_`n`n"
    } finally {
        if (Test-Path $tempSqlFile) { Remove-Item $tempSqlFile -Force -ErrorAction SilentlyContinue }
        if (Test-Path "$env:TEMP\isql_output_$tableName.txt") { Remove-Item "$env:TEMP\isql_output_$tableName.txt" -Force -ErrorAction SilentlyContinue }
        if (Test-Path "$env:TEMP\isql_error_$tableName.txt") { Remove-Item "$env:TEMP\isql_error_$tableName.txt" -Force -ErrorAction SilentlyContinue }
    }
}

# Start migration
Write-Host "Building seed-data.sql file..." -ForegroundColor Green
Write-Host ""

$output = @"
-- ============================================
-- Seed data migrated from Firebird database
-- Generated by migrate-with-isql.ps1
-- Generated on: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
-- ============================================

BEGIN;

"@

# Export each table - Firebird table names are case-sensitive
# Try different case variations if needed
$output += Export-TableSimple "department" "ID, NAME" @("id", "name")
$output += Export-TableSimple "store" "ID, NAME" @("id", "name")
$output += Export-TableSimple "StoreZones" "STOREID, ZONESEQUENCE, ZONENAME, DEPARTMENTID" @("storeid", "zonesequence", "zonename", "departmentid")
$output += Export-TableSimple "items" "ID, NAME, DEPARTMENT, QTY, CHANGED" @("id", "name", "department", "qty", "changed")
# Try Shopping_List with PURCHASED, fallback without if it doesn't exist
try {
    $output += Export-TableSimple "Shopping_List" "NAME, DEPARTMENT_ID, DESCRIPTION, QUANTITY, PURCHASED, ITEM_ID" @("name", "department_id", "description", "quantity", "purchased", "item_id")
} catch {
    Write-Host "Trying Shopping_List without PURCHASED column..." -ForegroundColor Yellow
    $output += Export-TableSimple "Shopping_List" "NAME, DEPARTMENT_ID, DESCRIPTION, QUANTITY, ITEM_ID" @("name", "department_id", "description", "quantity", "item_id")
}

# Try unit_type (might not exist)
try {
    $output += Export-TableSimple "unit_type" "ID, NAME" @("id", "name")
} catch {
    $output += "`n-- unit_type table not found or error`n`n"
}

$output += @"
COMMIT;

-- Reset sequences to match imported IDs
SELECT setval('department_id_seq', COALESCE((SELECT MAX(id) FROM department), 1), true);
SELECT setval('store_id_seq', COALESCE((SELECT MAX(id) FROM store), 1), true);
SELECT setval('items_id_seq', COALESCE((SELECT MAX(id) FROM items), 1), true);
SELECT setval('unit_type_id_seq', COALESCE((SELECT MAX(id) FROM unit_type), 1), true);
"@

# Write to file
$output | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host ""
Write-Host "✓ Migration complete!" -ForegroundColor Green
Write-Host "✓ Generated file: $outputFile" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review the generated seed-data.sql file"
Write-Host "  2. Run: psql -U postgres -d hausfrau -f database/seed-data.sql"

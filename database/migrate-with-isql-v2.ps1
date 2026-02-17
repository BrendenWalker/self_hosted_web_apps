# PowerShell script to migrate Firebird data to PostgreSQL using isql
# This version queries the database first to find actual table names

$ErrorActionPreference = "Continue"

$isqlPath = "C:\Program Files\Firebird\Firebird_3_0\isql.exe"
$firebirdHost = "poot"
$firebirdDatabase = "/home/firebird/hausfrau.fdb"
$firebirdUser = "SYSDBA"
$firebirdPassword = "masterkey"
$outputFile = Join-Path $PSScriptRoot "seed-data.sql"

Write-Host "Starting Firebird to PostgreSQL migration..." -ForegroundColor Green
Write-Host ""

# Function to run isql query and get results
function Invoke-IsqlQuery {
    param([string]$query)
    
    $tempSqlFile = Join-Path $env:TEMP "isql_query_$(Get-Random).sql"
    $query | Out-File -FilePath $tempSqlFile -Encoding ASCII -NoNewline
    
    $isqlArgs = @(
        "-user", $firebirdUser,
        "-password", $firebirdPassword,
        "$($firebirdHost):$firebirdDatabase",
        "-i", $tempSqlFile
    )
    
    try {
        $outputFile = Join-Path $env:TEMP "isql_output_$(Get-Random).txt"
        $errorFile = Join-Path $env:TEMP "isql_error_$(Get-Random).txt"
        
        $process = Start-Process -FilePath $isqlPath -ArgumentList $isqlArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput $outputFile -RedirectStandardError $errorFile
        
        $output = if (Test-Path $outputFile) { Get-Content $outputFile -Raw } else { "" }
        $errors = if (Test-Path $errorFile) { Get-Content $errorFile -Raw } else { "" }
        
        # Parse output - get data lines (skip headers and prompts)
        $allLines = $output -split "`n"
        $lines = @()
        $skipNext = $false
        $inData = $false
        
        foreach ($line in $allLines) {
            $trimmed = $line.Trim()
            if ($trimmed -eq "" -or 
                $trimmed -match "^Database:" -or 
                $trimmed -match "^Statement" -or
                $trimmed -match "^CON>" -or
                $trimmed -match "^SQL>" -or
                $trimmed -match "^RDB`$" -or
                $trimmed -match "^===" -or
                $trimmed -match "^Column" -or
                $trimmed.Length -eq 0) {
                continue
            }
            # Skip header separator lines
            if ($trimmed -match "^-+$") {
                continue
            }
            # Include lines that look like data or table names
            # Data lines: have content, not headers/separators, and not just "==="
            # Table names: uppercase with underscores
            if ($trimmed -match "\|" -or 
                ($trimmed -match "^[A-Z_][A-Z0-9_]*$" -and $trimmed.Length -gt 1) -or
                ($trimmed -match "^\s*\d" -and $trimmed.Length -gt 2)) {
                $lines += $trimmed
            }
        }
        
        return @{
            Success = $process.ExitCode -eq 0
            Lines = $lines
            Errors = $errors
        }
    } finally {
        if (Test-Path $tempSqlFile) { Remove-Item $tempSqlFile -Force -ErrorAction SilentlyContinue }
        if (Test-Path $outputFile) { Remove-Item $outputFile -Force -ErrorAction SilentlyContinue }
        if (Test-Path $errorFile) { Remove-Item $errorFile -Force -ErrorAction SilentlyContinue }
    }
}

# Find actual table names
Write-Host "Discovering tables in database..." -ForegroundColor Cyan
$tableQuery = "SELECT RDB`$RELATION_NAME FROM RDB`$RELATIONS WHERE RDB`$SYSTEM_FLAG = 0 ORDER BY RDB`$RELATION_NAME;"
$tableResult = Invoke-IsqlQuery $tableQuery

$tables = @{}
foreach ($line in $tableResult.Lines) {
    $tableName = $line.Trim()
    # Skip header lines, separators, and empty lines
    # Keep lines that look like table names (alphanumeric, underscore, no special chars at start)
    if ($tableName -and 
        $tableName -ne "RDB`$RELATION_NAME" -and 
        $tableName -notmatch "^===" -and
        $tableName -notmatch "^Column" -and
        $tableName.Length -gt 1 -and
        $tableName -notmatch "^-+$" -and
        $tableName -match "^[A-Z_][A-Z0-9_]*$") {
        $tables[$tableName.ToUpper()] = $tableName
        Write-Host "  Found table: $tableName" -ForegroundColor Yellow
    }
}

Write-Host ""

# Function to escape SQL
function Escape-SQLString {
    param([string]$value)
    if ([string]::IsNullOrEmpty($value) -or $value -eq "NULL" -or $value -eq "<null>") {
        return "NULL"
    }
    return "'" + ($value -replace "'", "''") + "'"
}

# Export data from a table
function Export-TableData {
    param(
        [string]$tableName,
        [string]$selectClause,
        [string[]]$columns,
        [string]$pgTableName
    )
    
    if (-not $tables.ContainsKey($tableName.ToUpper())) {
        Write-Host "Table $tableName not found, skipping..." -ForegroundColor Yellow
        return "`n-- Table $tableName not found`n`n"
    }
    
    $actualTableName = $tables[$tableName.ToUpper()]
    Write-Host "Exporting $actualTableName..." -ForegroundColor Cyan
    
    $query = "SELECT $selectClause FROM `"$actualTableName`" ORDER BY 1;"
    $result = Invoke-IsqlQuery $query
    
    if ($result.Lines.Count -eq 0) {
        Write-Host "  No data found" -ForegroundColor Yellow
        return "`n-- No data found in $actualTableName`n`n"
    }
    
    Write-Host "  Found $($result.Lines.Count) row(s)" -ForegroundColor Green
    
    $sql = "`n-- ============================================`n"
    $sql += "-- $($pgTableName.ToUpper())`n"
    $sql += "-- ============================================`n"
    $sql += "-- $($result.Lines.Count) row(s)`n`n"
    
    $columnList = ($columns | ForEach-Object { "`"$_`"" }) -join ", "
    $sql += "INSERT INTO $pgTableName ($columnList) VALUES`n"
    
    $values = @()
    foreach ($line in $result.Lines) {
        # Firebird outputs fixed-width columns
        # Format appears to be: number (12 chars), number (12 chars), text (80 chars padded), number (12 chars)
        # Better approach: split on 2+ consecutive spaces which separates the columns
        
        $rowValues = @()
        
        # Split on 2+ spaces to separate columns (Firebird uses multiple spaces between columns)
        $fields = $line -split '\s{2,}' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
        
        # For storezones: STOREID, ZONESEQUENCE, ZONENAME (may have spaces), DEPARTMENTID
        # The issue is ZONENAME can have spaces, so we need special handling
        # Firebird fixed-width: STOREID (12), ZONESEQUENCE (12), ZONENAME (80), DEPARTMENTID (12)
        if ($pgTableName -eq "storezones" -and $line.Length -gt 0) {
            # Parse fixed-width: positions approximately 0-12, 12-24, 24-104, 104-116
            # But safer: extract first number, second number, text until last number, last number
            if ($line -match '^\s*(\d+)\s+(\d+)\s+(.+?)\s+(\d+)\s*$') {
                $rowValues += Escape-SQLString $matches[1]  # storeid
                $rowValues += Escape-SQLString $matches[2]  # zonesequence
                $rowValues += Escape-SQLString $matches[3].Trim()  # zonename
                $rowValues += Escape-SQLString $matches[4]  # departmentid
            } elseif ($fields.Count -ge 3) {
                # Fallback: use field splitting
                $rowValues += Escape-SQLString $fields[0]  # storeid
                $rowValues += Escape-SQLString $fields[1]  # zonesequence
                
                # Zonename is everything from index 2 to second-to-last
                $zoneNameParts = @()
                for ($j = 2; $j -lt ($fields.Count - 1); $j++) {
                    $zoneNameParts += $fields[$j]
                }
                $zoneName = $zoneNameParts -join " "
                $rowValues += Escape-SQLString $zoneName
                
                # Last field is departmentid
                $rowValues += Escape-SQLString $fields[$fields.Count - 1]
            } else {
                # Last resort: simple field mapping
                for ($i = 0; $i -lt $columns.Count; $i++) {
                    $val = if ($i -lt $fields.Count) { $fields[$i] } else { "" }
                    $rowValues += Escape-SQLString $val
                }
            }
        } else {
            # For other tables, use simple field mapping
            for ($i = 0; $i -lt $columns.Count; $i++) {
                $val = if ($i -lt $fields.Count) { $fields[$i] } else { "" }
                $rowValues += Escape-SQLString $val
            }
        }
        
        $comma = if ($line -ne $result.Lines[-1]) { "," } else { "" }
        $values += "  ($($rowValues -join ', '))$comma"
    }
    
    $sql += ($values -join "`n") + "`n"
    
    # Add ON CONFLICT
    switch ($pgTableName) {
        "department" { $sql += "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;`n`n" }
        "store" { $sql += "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;`n`n" }
        "storezones" { $sql += "ON CONFLICT (storeid, zonesequence, departmentid) DO UPDATE SET zonename = EXCLUDED.zonename;`n`n" }
        "items" { $sql += "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, department = EXCLUDED.department, qty = EXCLUDED.qty, changed = EXCLUDED.changed;`n`n" }
        "shopping_list" { 
            if ($columns -contains "purchased") {
                $sql += "ON CONFLICT (name) DO UPDATE SET department_id = EXCLUDED.department_id, description = EXCLUDED.description, quantity = EXCLUDED.quantity, purchased = EXCLUDED.purchased, item_id = EXCLUDED.item_id;`n`n"
            } else {
                $sql += "ON CONFLICT (name) DO UPDATE SET department_id = EXCLUDED.department_id, description = EXCLUDED.description, quantity = EXCLUDED.quantity, item_id = EXCLUDED.item_id;`n`n"
            }
        }
        default { $sql += ";`n`n" }
    }
    
    return $sql
}

# Start building output
$output = @"
-- ============================================
-- Seed data migrated from Firebird database
-- Generated by migrate-with-isql-v2.ps1
-- Generated on: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
-- ============================================

BEGIN;

"@

# Export tables using actual table names from database
$output += Export-TableData "DEPARTMENT" "ID, NAME" @("id", "name") "department"
$output += Export-TableData "STORE" "ID, NAME" @("id", "name") "store"

# STOREZONE and STOREZONEDEPARTMENT - need to check structure
# Try exporting STOREZONE first
if ($tables.ContainsKey("STOREZONE")) {
    Write-Host "Checking STOREZONE structure..." -ForegroundColor Cyan
    $zoneQuery = "SELECT * FROM STOREZONE LIMIT 1;"
    $zoneTest = Invoke-IsqlQuery $zoneQuery
    # Export based on what we find - for now try the expected columns
    $output += Export-TableData "STOREZONE" "STOREID, ZONESEQUENCE, ZONENAME" @("storeid", "zonesequence", "zonename") "storezones"
}

if ($tables.ContainsKey("STOREZONEDEPARTMENT")) {
    Write-Host "Checking STOREZONEDEPARTMENT structure..." -ForegroundColor Cyan
    $output += Export-TableData "STOREZONEDEPARTMENT" "STOREID, ZONESEQUENCE, DEPARTMENTID" @("storeid", "zonesequence", "departmentid") "storezones"
}

# ITEM (singular, not ITEMS) - check if it has QTY and CHANGED columns
$output += Export-TableData "ITEM" "ID, NAME, DEPARTMENT" @("id", "name", "department") "items"

# Try V_STOREZONES view for store zones data
if ($tables.ContainsKey("V_STOREZONES")) {
    Write-Host "Trying V_STOREZONES view for store zones..." -ForegroundColor Cyan
    $output += Export-TableData "V_STOREZONES" "STOREID, ZONESEQUENCE, ZONENAME, DEPARTMENTID" @("storeid", "zonesequence", "zonename", "departmentid") "storezones"
}

# Try Shopping_List with PURCHASED first, then without
$slResult = Export-TableData "SHOPPING_LIST" "NAME, DEPARTMENT_ID, DESCRIPTION, QUANTITY, PURCHASED, ITEM_ID" @("name", "department_id", "description", "quantity", "purchased", "item_id") "shopping_list"
if ($slResult -match "Column unknown.*PURCHASED") {
    Write-Host "Shopping_List doesn't have PURCHASED column, trying without..." -ForegroundColor Yellow
    $output += Export-TableData "SHOPPING_LIST" "NAME, DEPARTMENT_ID, DESCRIPTION, QUANTITY, ITEM_ID" @("name", "department_id", "description", "quantity", "item_id") "shopping_list"
} else {
    $output += $slResult
}

$output += @"
COMMIT;

-- Reset sequences to match imported IDs
SELECT setval('department_id_seq', COALESCE((SELECT MAX(id) FROM department), 1), true);
SELECT setval('store_id_seq', COALESCE((SELECT MAX(id) FROM store), 1), true);
SELECT setval('items_id_seq', COALESCE((SELECT MAX(id) FROM items), 1), true);
"@

# Write to file
$output | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host ""
Write-Host "Migration complete!" -ForegroundColor Green
Write-Host "Generated file: $outputFile" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review the generated seed-data.sql file"
Write-Host "  2. Run: psql -U postgres -d hausfrau -f database/seed-data.sql"

# Script to list tables and columns in Firebird database
$isqlPath = "C:\Program Files\Firebird\Firebird_3_0\isql.exe"
$firebirdHost = "poot"
$firebirdDatabase = "/home/firebird/hausfrau.fdb"
$firebirdUser = "SYSDBA"
$firebirdPassword = "masterkey"

$tempSqlFile = Join-Path $env:TEMP "list_tables.sql"

# Query to list all tables
$query = @"
SET TERM ^;
SELECT RDB`$RELATION_NAME 
FROM RDB`$RELATIONS 
WHERE RDB`$SYSTEM_FLAG = 0
ORDER BY RDB`$RELATION_NAME;
EXIT;
"@

$query | Out-File -FilePath $tempSqlFile -Encoding ASCII -NoNewline

$isqlArgs = @(
    "-user", $firebirdUser,
    "-password", $firebirdPassword,
    "$($firebirdHost):$firebirdDatabase",
    "-i", $tempSqlFile
)

Write-Host "Listing tables in Firebird database..." -ForegroundColor Green
Write-Host ""

$process = Start-Process -FilePath $isqlPath -ArgumentList $isqlArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$env:TEMP\isql_tables.txt" -RedirectStandardError "$env:TEMP\isql_tables_err.txt"

$output = Get-Content "$env:TEMP\isql_tables.txt" -Raw
$errorOutput = Get-Content "$env:TEMP\isql_tables_err.txt" -Raw

Write-Host "Tables found:" -ForegroundColor Cyan
$lines = $output -split "`n" | Where-Object { 
    $line = $_.Trim()
    $line -ne "" -and 
    $line -notmatch "^Database:" -and 
    $line -notmatch "^Statement" -and 
    $line -notmatch "^CON>" -and
    $line -notmatch "^SQL>" -and
    $line.Length -gt 0
}

foreach ($line in $lines) {
    Write-Host "  $line" -ForegroundColor Yellow
}

# Now list columns for shopping_list table
Write-Host ""
Write-Host "Checking shopping_list table structure..." -ForegroundColor Cyan

$query2 = @"
SELECT RDB`$FIELD_NAME, RDB`$FIELD_SOURCE
FROM RDB`$RELATION_FIELDS
WHERE RDB`$RELATION_NAME = 'SHOPPING_LIST'
ORDER BY RDB`$FIELD_POSITION;
EXIT;
"@

$query2 | Out-File -FilePath $tempSqlFile -Encoding ASCII -NoNewline

$process2 = Start-Process -FilePath $isqlPath -ArgumentList $isqlArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$env:TEMP\isql_columns.txt" -RedirectStandardError "$env:TEMP\isql_columns_err.txt"

$output2 = Get-Content "$env:TEMP\isql_columns.txt" -Raw

Write-Host "Columns in shopping_list:" -ForegroundColor Cyan
$colLines = $output2 -split "`n" | Where-Object { 
    $line = $_.Trim()
    $line -ne "" -and 
    $line -notmatch "^Database:" -and 
    $line -notmatch "^Statement" -and 
    $line -notmatch "^CON>" -and
    $line -notmatch "^SQL>"
}

foreach ($line in $colLines) {
    Write-Host "  $line" -ForegroundColor Yellow
}

# Cleanup
Remove-Item $tempSqlFile -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\isql_tables.txt" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\isql_tables_err.txt" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\isql_columns.txt" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\isql_columns_err.txt" -Force -ErrorAction SilentlyContinue

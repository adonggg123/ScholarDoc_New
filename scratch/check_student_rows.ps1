$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$filePath = (Resolve-Path "scratch\test_filled_form3.xlsx").Path
$wb = $excel.Workbooks.Open($filePath, 0, $true)
$ws = $wb.Sheets.Item(1)

foreach ($r in 34..38) {
    Write-Output "Row $r Height=$($ws.Rows.Item($r).RowHeight) B$r='$($ws.Range("B$r").Text)' (VAlign=$($ws.Range("B$r").VerticalAlignment), HAlign=$($ws.Range("B$r").HorizontalAlignment)) E$r='$($ws.Range("E$r").Text)' (VAlign=$($ws.Range("E$r").VerticalAlignment), HAlign=$($ws.Range("E$r").HorizontalAlignment))"
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null

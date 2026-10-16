$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$filePath = (Resolve-Path "assets\Annex 5-TES New Form 2.xlsx").Path
$wb = $excel.Workbooks.Open($filePath, 0, $true)
$ws = $wb.Sheets.Item(1)

foreach ($r in 42..47) {
    Write-Output "Form 2 - Row $r Height=$($ws.Rows.Item($r).RowHeight) B$r VAlign=$($ws.Range("B$r").VerticalAlignment), HAlign=$($ws.Range("B$r").HorizontalAlignment) E$r VAlign=$($ws.Range("E$r").VerticalAlignment), HAlign=$($ws.Range("E$r").HorizontalAlignment)"
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null

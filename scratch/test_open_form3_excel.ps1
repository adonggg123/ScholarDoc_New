$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$templatePath = (Resolve-Path "assets\Annex 5-TES New Form 3.xlsx").Path
$wb = $excel.Workbooks.Open($templatePath, 0, $true)
$ws = $wb.Sheets.Item(1)

foreach ($addr in @('J2', 'B4', 'B5', 'B6', 'B8', 'B9', 'K11', 'B12', 'B13', 'B33')) {
    $r = $ws.Range($addr)
    Write-Output "$addr -> Text='$($r.Text)' VAlign=$($r.VerticalAlignment) HAlign=$($r.HorizontalAlignment) RowHeight=$($r.RowHeight) Merged=$($r.MergeCells)"
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null

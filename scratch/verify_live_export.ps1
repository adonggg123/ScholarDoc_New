$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$filePath = (Resolve-Path "scratch\live_tested_form3.xlsx").Path
Write-Output "Opening exported file in Excel COM: $filePath"

$wb = $excel.Workbooks.Open($filePath, 0, $true)
$ws = $wb.Sheets.Item(1)

Write-Output "`n=== HEADER INSPECTION ==="
foreach ($addr in @('J2', 'B4', 'B5', 'B6', 'B8', 'B9', 'K11', 'B12', 'B13', 'B33')) {
    $r = $ws.Range($addr)
    Write-Output "$addr -> Text='$($r.Text)' VAlign=$($r.VerticalAlignment) HAlign=$($r.HorizontalAlignment) RowHeight=$($r.RowHeight) Merged=$($r.MergeCells)"
}

Write-Output "`n=== STUDENT ROWS INSPECTION (Rows 34-41) ==="
foreach ($r in 34..41) {
    $b = $ws.Range("B$r")
    $c = $ws.Range("C$r")
    $e = $ws.Range("E$r")
    $f = $ws.Range("F$r")
    $l = $ws.Range("L$r")
    $m = $ws.Range("M$r")
    Write-Output "Row $r (Height=$($ws.Rows.Item($r).RowHeight)): Ctrl='$($b.Text)' (H=$($b.HorizontalAlignment), V=$($b.VerticalAlignment)) | Name='$($e.Text), $($f.Text)' (H=$($e.HorizontalAlignment), V=$($e.VerticalAlignment)) | Status='$($l.Text)' (H=$($l.HorizontalAlignment), V=$($l.VerticalAlignment)) | Remarks='$($m.Text)' (H=$($m.HorizontalAlignment), V=$($m.VerticalAlignment))"
}

Write-Output "`n=== FOOTER INSPECTION ==="
foreach ($addr in @('B42', 'B43', 'G46', 'K46', 'C47', 'G47', 'K49', 'C50', 'G50', 'K50')) {
    $r = $ws.Range($addr)
    if ($r.Text -ne '') {
        Write-Output "$addr -> Text='$($r.Text)' Merged=$($r.MergeCells)"
    }
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
Write-Output "`nTest completed successfully in Excel 16.0!"

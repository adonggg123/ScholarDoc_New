$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
try {
    $wb = $excel.Workbooks.Open('c:\Users\judej\ScholarDoc\assets\Annex 5-TES New Form 2.xlsx')
    $ws = $wb.Sheets.Item(1)
    Write-Host ("Shapes count: " + $ws.Shapes.Count)
    for ($i = 1; $i -le $ws.Shapes.Count; $i++) {
        $shape = $ws.Shapes.Item($i)
        Write-Host ("Shape $i : Name=" + $shape.Name + " Left=" + $shape.Left + " Top=" + $shape.Top + " Width=" + $shape.Width + " Height=" + $shape.Height)
    }
    $wb.Close($false)
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}

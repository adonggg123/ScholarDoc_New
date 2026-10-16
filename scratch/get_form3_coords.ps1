$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
try {
    $wb = $excel.Workbooks.Open('c:\Users\judej\ScholarDoc\assets\Annex 5-TES New Form 3.xlsx')
    $ws = $wb.Sheets.Item(1)
    
    Write-Host "Form 3 Columns (1 to 13):"
    for ($col = 1; $col -le 13; $col++) {
        $c = $ws.Columns.Item($col)
        Write-Host ("Col $col (" + $c.Address($false, $false).Split(':')[0] + "): Left=" + $c.Left + " Width=" + $c.Width)
    }
    
    $rangeHeader = $ws.Range("B4:M6")
    Write-Host ("Header Range B4:M6 Left=" + $rangeHeader.Left + " Width=" + $rangeHeader.Width + " Right=" + ($rangeHeader.Left + $rangeHeader.Width))
    Write-Host ("Header Range B4 Top=" + $ws.Range("B4").Top + " B6 Bottom=" + ($ws.Range("B6").Top + $ws.Range("B6").Height))
    
    $annexBox = $ws.Range("J2:M3")
    Write-Host ("Annex Box J2:M3 Left=" + $annexBox.Left + " Top=" + $annexBox.Top + " Width=" + $annexBox.Width + " Height=" + $annexBox.Height)
    
    $wb.Close($false)
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}

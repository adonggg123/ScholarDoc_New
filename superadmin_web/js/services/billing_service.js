// js/services/billing_service.js

export class BillingService {
    /**
     * Parses an uploaded file (CSV or Excel) and returns an array of objects.
     */
    static async parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                    resolve(json);
                } catch (error) {
                    console.error('BillingService: Error parsing file:', error);
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    }

    static _getValue(row, keys) {
        for (let key of keys) {
            if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
                return row[key];
            }
            // Case insensitive search
            const actualKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
            if (actualKey && row[actualKey] !== undefined && row[actualKey] !== null && String(row[actualKey]).trim() !== '') {
                return row[actualKey];
            }
        }
        return '';
    }

    static _fillIfEmpty(resultRow, match, targetKey, sourceKeys) {
        const existingValue = this._getValue(resultRow, [targetKey]);
        const cleanVal = String(existingValue).trim().toUpperCase();
        if (cleanVal !== '' && cleanVal !== 'N/A') return;

        for (let skey of sourceKeys) {
            if (match[skey] !== undefined && match[skey] !== null && String(match[skey]).trim() !== '') {
                const actualKey = Object.keys(resultRow).find(k => k.toLowerCase() === targetKey.toLowerCase()) || targetKey;
                resultRow[actualKey] = String(match[skey]);
                return;
            }
        }
    }

    /**
     * Matches uploaded records with master list.
     */
    static processBillingData(uploadedData, masterList) {
        let matchedCount = 0;
        let unmatchedCount = 0;
        let duplicateCount = 0;
        const processedData = [];
        const processedIds = new Set();

        for (let row of uploadedData) {
            const studentId = String(this._getValue(row, ['Student ID', 'ID Number', 'Student No', 'ID'])).trim();
            const fullName = String(this._getValue(row, ['Full Name', 'Name', 'Student Name'])).trim();
            const scholarship = String(this._getValue(row, ['Scholarship Type', 'Scholarship', 'Type'])).trim();

            const uniqueKey = studentId !== '' ? studentId : fullName;
            if (uniqueKey !== '' && processedIds.has(uniqueKey)) {
                duplicateCount++;
            }
            if (uniqueKey !== '') processedIds.add(uniqueKey);

            let match = null;

            // 1. Try Student ID match
            if (studentId !== '') {
                match = masterList.find(s => String(s.studentId || '').trim() === studentId);
            }

            // 2. Try Name match
            if (!match && fullName !== '') {
                match = masterList.find(s => String(s.fullName || '').trim().toLowerCase() === fullName.toLowerCase());
            }

            if (!match && fullName !== '' && scholarship !== '') {
                match = masterList.find(s => 
                    String(s.fullName || '').trim().toLowerCase() === fullName.toLowerCase() &&
                    (String(s.scholarship_name || s.scholarshipName || s.scholarship || '').trim().toLowerCase() === scholarship.toLowerCase() ||
                     String(s.scholarshipType || '').trim().toLowerCase() === scholarship.toLowerCase())
                );
            }

            const resultRow = { ...row };

            if (match) {
                matchedCount++;
                resultRow['matchStatus'] = 'matched';

                // Auto-fill missing fields
                this._fillIfEmpty(resultRow, match, 'Student ID', ['studentId']);
                this._fillIfEmpty(resultRow, match, 'Full Name', ['fullName']);
                this._fillIfEmpty(resultRow, match, 'Scholarship Type', ['scholarship_name', 'scholarshipName', 'scholarship', 'scholarshipType']);
                
                this._fillIfEmpty(resultRow, match, 'Course/Program', ['course']);
                this._fillIfEmpty(resultRow, match, 'Degree/Program', ['course']);
                
                this._fillIfEmpty(resultRow, match, 'Year Level', ['year', 'scholarYearLevel']);
                this._fillIfEmpty(resultRow, match, 'Year', ['year', 'scholarYearLevel']);
                
                this._fillIfEmpty(resultRow, match, 'Semester', ['semester']);
                this._fillIfEmpty(resultRow, match, 'Academic Year', ['academicYear', 'ay']);
                
                const family = match.familyDetails || {};
                this._fillIfEmpty(resultRow, match, 'SA Number', ['saNumber', () => family.saNumber]); // Function trick not supported like this, so just mapping to string below
                if (!resultRow['SA Number'] && family.saNumber) resultRow['SA Number'] = family.saNumber;

                this._fillIfEmpty(resultRow, match, 'Sex at Birth (M/F)', ['gender']);
                this._fillIfEmpty(resultRow, match, 'Sex', ['gender']);
                this._fillIfEmpty(resultRow, match, 'Gender', ['gender']);
                
                this._fillIfEmpty(resultRow, match, 'Birthdate (mm/dd/yyyy)', ['birthdate']);
                this._fillIfEmpty(resultRow, match, 'Birthdate', ['birthdate']);
                this._fillIfEmpty(resultRow, match, 'Birth Date', ['birthdate']);
                this._fillIfEmpty(resultRow, match, 'Birthday', ['birthdate']);
                
                this._fillIfEmpty(resultRow, match, 'E-mail address', ['email']);
                this._fillIfEmpty(resultRow, match, 'Email', ['email']);
                this._fillIfEmpty(resultRow, match, 'Email Address', ['email']);
                
                this._fillIfEmpty(resultRow, match, 'Phone Number', ['contactNumber']);
                this._fillIfEmpty(resultRow, match, 'Phone', ['contactNumber']);
                this._fillIfEmpty(resultRow, match, 'Contact Number', ['contactNumber']);
                
                this._fillIfEmpty(resultRow, match, 'Status', ['status']);
            } else {
                unmatchedCount++;
                resultRow['matchStatus'] = 'unmatched';
            }

            processedData.push(resultRow);
        }

        return {
            processedData,
            stats: {
                total: uploadedData.length,
                matched: matchedCount,
                unmatched: unmatchedCount,
                duplicates: duplicateCount,
            }
        };
    }

    /**
     * Exports processed data to Excel or CSV.
     */
    static async exportFile(data, originalFileName, asCsv = false) {
        if (!data || data.length === 0) return;

        const headers = Object.keys(data[0]).filter(k => k !== 'matchStatus');
        
        if (asCsv) {
            const rows = [headers];
            for (let row of data) {
                rows.push(headers.map(h => {
                    let val = String(row[h] || '').replace(/"/g, '""');
                    return `"${val}"`;
                }));
            }
            const csvData = rows.map(r => r.join(',')).join('\n');
            const blob = new Blob(['\uFEFF' + csvData], { type: 'text/csv;charset=utf-8;' });
            const fileName = `AutoFilled_${originalFileName.replace(/\.[^/.]+$/, "")}.csv`;
            saveAs(blob, fileName);
        } else {
            const exportData = data.map(row => {
                const newRow = {};
                headers.forEach(h => newRow[h] = row[h]);
                return newRow;
            });
            const worksheet = XLSX.utils.json_to_sheet(exportData, { header: headers });
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const fileName = `AutoFilled_${originalFileName.replace(/\.[^/.]+$/, "")}.xlsx`;
            saveAs(blob, fileName);
        }
    }

    // --- XML Manipulation Helpers for Annex 5 ---

    static _splitFullName(fullName) {
        fullName = String(fullName || '').trim();
        if (fullName === '') {
            return { lastName: '', givenName: '', middleInitial: '' };
        }

        if (fullName.includes(',')) {
            const parts = fullName.split(',');
            const lastName = parts[0].trim();
            const rest = parts.slice(1).join(',').trim();
            const restParts = rest.split(/\s+/);
            let givenName = '';
            let middleInitial = '';
            
            if (restParts.length > 1) {
                const lastPart = restParts[restParts.length - 1];
                middleInitial = lastPart.charAt(0).toUpperCase();
                givenName = restParts.slice(0, restParts.length - 1).join(' ').trim();
            } else {
                givenName = rest;
            }
            return { lastName, givenName, middleInitial };
        } else {
            const parts = fullName.split(/\s+/);
            if (parts.length === 1) {
                return { lastName: parts[0], givenName: '', middleInitial: '' };
            } else if (parts.length === 2) {
                return { lastName: parts[1], givenName: parts[0], middleInitial: '' };
            } else {
                const lastPart = parts[parts.length - 1];
                const secondToLast = parts[parts.length - 2];
                const middleInitial = secondToLast.charAt(0).toUpperCase();
                const givenName = parts.slice(0, parts.length - 2).join(' ').trim();
                return { lastName: lastPart, givenName, middleInitial };
            }
        }
    }

    static _colLetter(idx) {
        let r = '';
        let n = idx;
        do {
            r = String.fromCharCode(65 + (n % 26)) + r;
            n = Math.floor(n / 26) - 1;
        } while (n >= 0);
        return r;
    }

    static _colIndexFromAddr(addr) {
        const letters = addr.replace(/[0-9]/g, '');
        let index = 0;
        for (let i = 0; i < letters.length; i++) {
            index = index * 26 + (letters.charCodeAt(i) - 64);
        }
        return index - 1;
    }

    static _defaultStyle(colIdx, isForm2) {
        if (isForm2) {
            switch (colIdx) {
                case 1: return '23';  // B: Control No
                case 2: return '32';  // C: Student No
                case 3: return '32';  // D: TES App No
                case 4: return '29';  // E: Last Name
                case 5: return '29';  // F: Given Name
                case 6: return '23';  // G: Middle Initial
                case 7: return '23';  // H: Sex
                case 8: return '23';  // I: Birthdate
                case 9: return '23';  // J: Degree Program
                case 10: return '23'; // K: Year Level
                case 11: return '23'; // L: Email
                case 12: return '23'; // M: Phone
                case 13: return '23'; // N: TES Batch
                case 14: return '34'; // O: TES Amount
                case 15: return '33'; // P: PWD Amount
                case 16: return '33'; // Q: Total Amount
                default: return '23';
            }
        } else {
            // Form 3 column styles:
            // Centered: Control No (1), Student No (2), TES App No (3), MI (6), Sex (7), Birthdate (8), Year (10)
            // Left-aligned: Last Name (4), Given Name (5), Degree Program (9), Remarks (12)
            // Status: (11)
            switch (colIdx) {
                case 4:
                case 5:
                case 9:
                case 12:
                    return '9';
                case 11:
                    return '14';
                default:
                    return '16';
            }
        }
    }

    static _escapeXml(unsafe) {
        return String(unsafe)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    static _getOrCreateRow(doc, sheetData, rowNum) {
        let existing = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === String(rowNum));
        if (existing) return existing;

        const ns = sheetData.namespaceURI;
        const newRow = ns ? doc.createElementNS(ns, 'row') : doc.createElement('row');
        newRow.setAttribute('r', String(rowNum));

        const allRows = Array.from(sheetData.childNodes).filter(n => n.nodeName === 'row');
        let insertBeforeNode = null;
        for (let r of allRows) {
            const rn = parseInt(r.getAttribute('r') || '0', 10);
            if (rn > rowNum) {
                insertBeforeNode = r;
                break;
            }
        }
        if (insertBeforeNode) {
            sheetData.insertBefore(newRow, insertBeforeNode);
        } else {
            sheetData.appendChild(newRow);
        }
        return newRow;
    }

    static _fillCell(doc, rowEl, addr, value, isNumeric, defaultStyle) {
        const escaped = this._escapeXml(value);
        let cell = Array.from(rowEl.childNodes).find(n => n.nodeName === 'c' && n.getAttribute('r') === addr);
        const ns = rowEl.namespaceURI;

        if (!cell) {
            cell = ns ? doc.createElementNS(ns, 'c') : doc.createElement('c');
            cell.setAttribute('r', addr);
            if (defaultStyle) {
                cell.setAttribute('s', defaultStyle);
            }

            const targetIdx = this._colIndexFromAddr(addr);
            const cells = Array.from(rowEl.childNodes).filter(n => n.nodeName === 'c');
            let insertBeforeNode = null;
            for (let c of cells) {
                if (this._colIndexFromAddr(c.getAttribute('r') || '') > targetIdx) {
                    insertBeforeNode = c;
                    break;
                }
            }
            if (insertBeforeNode) {
                rowEl.insertBefore(cell, insertBeforeNode);
            } else {
                rowEl.appendChild(cell);
            }
        } else if (defaultStyle) {
            cell.setAttribute('s', defaultStyle);
        }

        while (cell.firstChild) {
            cell.removeChild(cell.firstChild);
        }

        if (isNumeric) {
            cell.removeAttribute('t');
            const v = ns ? doc.createElementNS(ns, 'v') : doc.createElement('v');
            v.textContent = value;
            cell.appendChild(v);
        } else {
            cell.setAttribute('t', 'inlineStr');
            const is = ns ? doc.createElementNS(ns, 'is') : doc.createElement('is');
            const t = ns ? doc.createElementNS(ns, 't') : doc.createElement('t');
            t.textContent = value;
            is.appendChild(t);
            cell.appendChild(is);
        }
    }

    static _injectForm2Rows(xmlStr, students) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlStr, "application/xml");
        const sheetData = doc.getElementsByTagName("sheetData")[0];
        const startRow = 42;
        const templateCapacity = 6;
        const footerStartRow = 48;
        const shiftCount = students.length > templateCapacity ? students.length - templateCapacity : 0;

        if (shiftCount > 0) {
            // 1. Shift mergeCells with rows >= footerStartRow
            const mergeCells = doc.getElementsByTagName("mergeCell");
            for (let mc of Array.from(mergeCells)) {
                const ref = mc.getAttribute("ref") || "";
                const shiftedRef = ref.split(':').map(part => {
                    const col = part.replace(/[0-9]/g, '');
                    const row = parseInt(part.replace(/[^0-9]/g, ''), 10);
                    if (!isNaN(row) && row >= footerStartRow) {
                        return `${col}${row + shiftCount}`;
                    }
                    return part;
                }).join(':');
                if (shiftedRef !== ref) {
                    mc.setAttribute("ref", shiftedRef);
                }
            }

            // 2. Shift existing rows >= footerStartRow in descending order
            const allRows = Array.from(sheetData.childNodes).filter(n => n.nodeName === 'row');
            const footerRows = allRows
                .map(rowEl => ({ rowEl, rNum: parseInt(rowEl.getAttribute('r') || '0', 10) }))
                .filter(item => item.rNum >= footerStartRow)
                .sort((a, b) => b.rNum - a.rNum);

            for (const { rowEl, rNum } of footerRows) {
                const newR = rNum + shiftCount;
                rowEl.setAttribute('r', String(newR));
                const cellNodes = Array.from(rowEl.childNodes).filter(n => n.nodeName === 'c');
                for (const cell of cellNodes) {
                    const oldAddr = cell.getAttribute('r') || '';
                    const col = oldAddr.replace(/[0-9]/g, '');
                    if (col) {
                        cell.setAttribute('r', `${col}${newR}`);
                    }
                }
            }

            // 3. Pre-create inserted student rows (footerStartRow to footerStartRow + shiftCount - 1)
            const ns = sheetData.namespaceURI;
            for (let r = footerStartRow; r < footerStartRow + shiftCount; r++) {
                const newRow = this._getOrCreateRow(doc, sheetData, r);
                newRow.setAttribute('spans', '1:24');
                newRow.setAttribute('ht', '15.75');
                newRow.setAttribute('customHeight', '1');
                newRow.setAttribute('thickBot', '1');

                const addCell = (col, style) => {
                    const addr = `${col}${r}`;
                    let cell = Array.from(newRow.childNodes).find(n => n.nodeName === 'c' && n.getAttribute('r') === addr);
                    if (!cell) {
                        cell = ns ? doc.createElementNS(ns, 'c') : doc.createElement('c');
                        cell.setAttribute('r', addr);
                        cell.setAttribute('s', style);
                        newRow.appendChild(cell);
                    }
                    return cell;
                };

                addCell('A', '31');
                for (let c = 1; c <= 16; c++) {
                    addCell(this._colLetter(c), this._defaultStyle(c, true));
                }
                for (let col of ['R', 'S', 'T', 'U', 'V', 'W', 'X']) {
                    addCell(col, '1');
                }
            }
        }

        for (let i = 0; i < students.length; i++) {
            const s = students[i];
            const rowNum = startRow + i;
            const ctrl = String(i + 1).padStart(5, '0');

            let lastName = String(s.lastName || s.last_name || '').trim();
            let givenName = String(s.firstName || s.first_name || '').trim();
            let middleName = String(s.middleName || s.middle_name || '').trim();
            let middleInitial = middleName ? middleName.charAt(0).toUpperCase() : '';

            if (!lastName || !givenName) {
                const parsed = this._splitFullName(s.fullName || s.name || '');
                if (!lastName) lastName = parsed.lastName;
                if (!givenName) givenName = parsed.givenName;
                if (!middleInitial) middleInitial = parsed.middleInitial;
            }

            let gender = String(s.gender || s.sex || 'M').toUpperCase();
            gender = gender.startsWith('F') ? 'F' : 'M';

            let rawYear = String(s.year || s.yearLevel || s.scholarYearLevel || '1');
            let year = rawYear.includes('1') ? '1' :
                rawYear.includes('2') ? '2' :
                    rawYear.includes('3') ? '3' :
                        rawYear.includes('4') ? '4' : rawYear;

            const family = s.familyDetails || {};
            const sa = String(s.saNumber || family.saNumber || s.tesAppNumber || s.tesApplicationNumber || '').trim();
            const course = String(s.course || s.program || s.degreeProgram || '').trim();

            let bdate = String(s.birthdate || s.birthday || '').trim();
            if (bdate === '' || bdate.toUpperCase() === 'N/A') {
                bdate = '01/01/2000';
            } else if (/^\d{4}-\d{2}-\d{2}/.test(bdate)) {
                const [y, m, d] = bdate.split('T')[0].split('-');
                bdate = `${m}/${d}/${y}`;
            }

            const studId = String(s.studentId || s.student_id || s.studentNumber || '').trim();
            const email = String(s.email || s.authEmail || s.emailAddress || '').trim();
            const phone = String(s.contactNumber || s.phone || s.phoneNumber || '').trim();
            const batchVal = Number(s.batch ? String(s.batch).replace(/\D/g, '') : 1) || 1;

            const rowEl = this._getOrCreateRow(doc, sheetData, rowNum);
            const addr = (colIdx) => `${this._colLetter(colIdx)}${rowNum}`;

            const str = (colIdx, val) => this._fillCell(doc, rowEl, addr(colIdx), val, false, this._defaultStyle(colIdx, true));
            const num_ = (colIdx, val) => this._fillCell(doc, rowEl, addr(colIdx), val, true, this._defaultStyle(colIdx, true));

            // Template Row 41 Headers:
            // B: 5-digit Control Number (1)
            // C: Student Number (2)
            // D: TES Application Number (3)
            // E: Last Name (4)
            // F: Given Name (5)
            // G: Middle Initial (6)
            // H: Sex at Birth (M/F) (7)
            // I: Birthdate (mm/dd/yyyy) (8)
            // J: Degree Program (9)
            // K: Year Level (10)
            // L: E-mail address (11)
            // M: Phone Number (12)
            // N: TES Batch (13)
            // O: TES Amount (14)
            // P: TES-3A Person with Disability (15)
            // Q: TOTAL AMOUNT (16)
            str(1, ctrl);                            // B: 5-digit Control Number
            str(2, studId !== '' ? studId : 'N/A');   // C: Student Number
            str(3, sa !== '' ? sa : 'N/A');          // D: TES Application Number
            str(4, lastName);                        // E: Last Name
            str(5, givenName);                       // F: Given Name
            str(6, middleInitial);                   // G: Middle Initial
            str(7, gender);                          // H: Sex at Birth (M/F)
            str(8, bdate);                           // I: Birthdate (mm/dd/yyyy)
            str(9, course);                          // J: Degree Program
            str(10, year);                           // K: Year Level
            str(11, email);                          // L: E-mail address
            str(12, phone);                          // M: Phone Number
            num_(13, batchVal);                      // N: TES Batch
            num_(14, 10000);                         // O: TES Amount
            num_(15, 0);                             // P: TES-3A Person with Disability
            num_(16, 10000);                         // Q: TOTAL AMOUNT
        }

        // Summary totals at bottom (shifted dynamically when rows expand)
        const totalTesAmount = students.length * 10000;
        const totalPwdAmount = 0;
        const totalAmount = totalTesAmount + totalPwdAmount;
        const mgmtFee = Math.round(totalAmount * 0.01);
        const campusTotal = totalAmount + mgmtFee;

        const targetRow48 = 48 + shiftCount;
        const targetRow49 = 49 + shiftCount;
        const targetRow50 = 50 + shiftCount;
        const targetRow51 = 51 + shiftCount;
        const targetRow52 = 52 + shiftCount;

        const row48 = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === String(targetRow48));
        if (row48) {
            this._fillCell(doc, row48, `O${targetRow48}`, totalTesAmount, true, '25');
            this._fillCell(doc, row48, `P${targetRow48}`, totalPwdAmount, true, '24');
            this._fillCell(doc, row48, `Q${targetRow48}`, totalAmount, true, '23');
        }
        const row49 = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === String(targetRow49));
        if (row49) {
            this._fillCell(doc, row49, `Q${targetRow49}`, totalAmount, true, '12');
        }
        const row50 = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === String(targetRow50));
        if (row50) {
            this._fillCell(doc, row50, `Q${targetRow50}`, mgmtFee, true, '17');
        }
        const row51 = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === String(targetRow51));
        if (row51) {
            this._fillCell(doc, row51, `Q${targetRow51}`, campusTotal, true, '12');
        }
        const row52 = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === String(targetRow52));
        if (row52) {
            this._fillCell(doc, row52, `Q${targetRow52}`, campusTotal, true, '7');
        }

        const serializer = new XMLSerializer();
        return serializer.serializeToString(doc);
    }

    static _injectForm3Rows(xmlStr, students) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlStr, "application/xml");
        const sheetData = doc.getElementsByTagName("sheetData")[0];
        const startRow = 34;
        const templateCapacity = 6;
        const footerStartRow = 40;
        const shiftCount = students.length > templateCapacity ? students.length - templateCapacity : 0;

        if (shiftCount > 0) {
            // 1. Shift mergeCells with rows >= footerStartRow
            const mergeCells = doc.getElementsByTagName("mergeCell");
            for (let mc of Array.from(mergeCells)) {
                const ref = mc.getAttribute("ref") || "";
                const shiftedRef = ref.split(':').map(part => {
                    const col = part.replace(/[0-9]/g, '');
                    const row = parseInt(part.replace(/[^0-9]/g, ''), 10);
                    if (!isNaN(row) && row >= footerStartRow) {
                        return `${col}${row + shiftCount}`;
                    }
                    return part;
                }).join(':');
                if (shiftedRef !== ref) {
                    mc.setAttribute("ref", shiftedRef);
                }
            }

            // 2. Shift existing rows >= footerStartRow in descending order
            const allRows = Array.from(sheetData.childNodes).filter(n => n.nodeName === 'row');
            const footerRows = allRows
                .map(rowEl => ({ rowEl, rNum: parseInt(rowEl.getAttribute('r') || '0', 10) }))
                .filter(item => item.rNum >= footerStartRow)
                .sort((a, b) => b.rNum - a.rNum);

            for (const { rowEl, rNum } of footerRows) {
                const newR = rNum + shiftCount;
                rowEl.setAttribute('r', String(newR));
                const cellNodes = Array.from(rowEl.childNodes).filter(n => n.nodeName === 'c');
                for (const cell of cellNodes) {
                    const oldAddr = cell.getAttribute('r') || '';
                    const col = oldAddr.replace(/[0-9]/g, '');
                    if (col) {
                        cell.setAttribute('r', `${col}${newR}`);
                    }
                }
            }

            // 3. Pre-create inserted student rows (footerStartRow to footerStartRow + shiftCount - 1)
            const ns = sheetData.namespaceURI;
            for (let r = footerStartRow; r < footerStartRow + shiftCount; r++) {
                const newRow = this._getOrCreateRow(doc, sheetData, r);
                newRow.setAttribute('spans', '1:27');
                newRow.setAttribute('ht', '15.75');
                newRow.setAttribute('customHeight', '1');
                newRow.setAttribute('thickBot', '1');

                const addCell = (col, style) => {
                    const addr = `${col}${r}`;
                    let cell = Array.from(newRow.childNodes).find(n => n.nodeName === 'c' && n.getAttribute('r') === addr);
                    if (!cell) {
                        cell = ns ? doc.createElementNS(ns, 'c') : doc.createElement('c');
                        cell.setAttribute('r', addr);
                        cell.setAttribute('s', style);
                        newRow.appendChild(cell);
                    }
                    return cell;
                };

                addCell('A', '13');
                for (let c = 1; c <= 12; c++) {
                    addCell(this._colLetter(c), this._defaultStyle(c, false));
                }
                for (let col of ['N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA']) {
                    addCell(col, '1');
                }
            }
        }

        for (let i = 0; i < students.length; i++) {
            const s = students[i];
            const rowNum = startRow + i;
            const ctrl = String(i + 1).padStart(5, '0');

            let lastName = String(s.lastName || s.last_name || '').trim();
            let givenName = String(s.firstName || s.first_name || '').trim();
            let middleName = String(s.middleName || s.middle_name || '').trim();
            let middleInitial = middleName ? middleName.charAt(0).toUpperCase() : '';

            if (!lastName || !givenName) {
                const parsed = this._splitFullName(s.fullName || s.name || '');
                if (!lastName) lastName = parsed.lastName;
                if (!givenName) givenName = parsed.givenName;
                if (!middleInitial) middleInitial = parsed.middleInitial;
            }

            let gender = String(s.gender || s.sex || 'M').toUpperCase();
            gender = gender.startsWith('F') ? 'F' : 'M';

            let rawYear = String(s.year || s.yearLevel || s.scholarYearLevel || '1');
            let year = rawYear.includes('1') ? '1' :
                rawYear.includes('2') ? '2' :
                    rawYear.includes('3') ? '3' :
                        rawYear.includes('4') ? '4' : rawYear;

            const family = s.familyDetails || {};
            const sa = String(s.saNumber || family.saNumber || s.tesAppNumber || s.tesApplicationNumber || '').trim();
            const course = String(s.course || s.program || s.degreeProgram || '').trim();

            let bdate = String(s.birthdate || s.birthday || '').trim();
            if (bdate === '' || bdate.toUpperCase() === 'N/A') {
                bdate = '01/01/2000';
            } else if (/^\d{4}-\d{2}-\d{2}/.test(bdate)) {
                const [y, m, d] = bdate.split('T')[0].split('-');
                bdate = `${m}/${d}/${y}`;
            }

            const studId = String(s.studentId || s.student_id || s.studentNumber || '').trim();
            const rawStatus = String(s.status || s.specialStatusReason || s.submissionStatus || 'Not enrolled');
            const status = rawStatus;
            const remarks = String(s.remarks || s.adminRemarks || (status === 'On Leave of Absence (LOA)' ? 'On approved Leave of Absence' : `Categorized: ${status}`));

            const rowEl = this._getOrCreateRow(doc, sheetData, rowNum);
            rowEl.setAttribute('spans', '1:27');
            rowEl.setAttribute('ht', '15.75');
            rowEl.setAttribute('customHeight', '1');
            rowEl.setAttribute('thickBot', '1');
            const addr = (colIdx) => `${this._colLetter(colIdx)}${rowNum}`;

            const str = (colIdx, val) => this._fillCell(doc, rowEl, addr(colIdx), val, false, this._defaultStyle(colIdx, false));

            // Template Row 33 Headers:
            // B: 5-digit Control Number (1)
            // C: Student Number (2)
            // D: TES Application Number (3)
            // E: Last Name (4)
            // F: Given Name (5)
            // G: Middle Initial (6)
            // H: Sex at Birth (M/F) (7)
            // I: Birthdate (mm/dd/yyyy) (8)
            // J: Degree Program (9)
            // K: Year Level (10)
            // L: Status (11)
            // M: Remarks (12)
            str(1, ctrl);                            // B: 5-digit Control Number
            str(2, studId !== '' ? studId : 'N/A');   // C: Student Number
            str(3, sa !== '' ? sa : 'N/A');          // D: TES Application Number
            str(4, lastName);                        // E: Last Name
            str(5, givenName);                       // F: Given Name
            str(6, middleInitial);                   // G: Middle Initial
            str(7, gender);                          // H: Sex at Birth (M/F)
            str(8, bdate);                           // I: Birthdate (mm/dd/yyyy)
            str(9, course);                          // J: Degree Program
            str(10, year);                           // K: Year Level
            str(11, status);                         // L: Status
            str(12, remarks);                        // M: Remarks
        }

        const serializer = new XMLSerializer();
        return serializer.serializeToString(doc);
    }

    /**
     * Fills Annex 5 - Form 2 template (.xlsx)
     */
    static async fillAnnex5Form2(templateBytes, students) {
        const zip = await JSZip.loadAsync(templateBytes);
        if (zip.file('xl/worksheets/sheet1.xml')) {
            let sheet1Xml = await zip.file('xl/worksheets/sheet1.xml').async("string");
            sheet1Xml = this._injectForm2Rows(sheet1Xml, students);
            zip.file('xl/worksheets/sheet1.xml', sheet1Xml);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        return { blob, count: students.length };
    }

    /**
     * Fills Annex 5 - Form 3 template (.xlsx)
     */
    static async fillAnnex5Form3(templateBytes, students) {
        const zip = await JSZip.loadAsync(templateBytes);
        if (zip.file('xl/worksheets/sheet1.xml')) {
            let sheet1Xml = await zip.file('xl/worksheets/sheet1.xml').async("string");
            sheet1Xml = this._injectForm3Rows(sheet1Xml, students);
            zip.file('xl/worksheets/sheet1.xml', sheet1Xml);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        return { blob, count: students.length };
    }

    /**
     * Legacy / Direct Annex 5 Template filler
     */
    static async fillAnnex5Template(templateBytes, students) {
        return this.fillAnnex5Form2(templateBytes, students);
    }

    // ── Consolidated Annex 5 Workbook (Forms 1, 2, and 3) Helpers ───────

    static _findCellInRow(rowEl, addr) {
        if (!rowEl) return null;
        return Array.from(rowEl.childNodes).find(
            n => n.nodeName === 'c' && n.getAttribute('r') === addr
        ) || null;
    }

    static _getCellStyle(doc, sheetData, rowNum, colLetter) {
        const rowEl = Array.from(sheetData.childNodes).find(
            n => n.nodeName === 'row' && n.getAttribute('r') === String(rowNum)
        );
        const cell = this._findCellInRow(rowEl, `${colLetter}${rowNum}`);
        return cell ? (cell.getAttribute('s') || null) : null;
    }

    static _setCellContent(doc, rowEl, addr, { type = 'str', value = '', formula = null, styleId = null } = {}) {
        const ns = rowEl.namespaceURI;
        let cell = this._findCellInRow(rowEl, addr);

        if (!cell) {
            cell = ns ? doc.createElementNS(ns, 'c') : doc.createElement('c');
            cell.setAttribute('r', addr);
            if (styleId !== null && styleId !== undefined && styleId !== '') {
                cell.setAttribute('s', String(styleId));
            }
            const targetIdx = this._colIndexFromAddr(addr);
            const cells = Array.from(rowEl.childNodes).filter(n => n.nodeName === 'c');
            let insertBeforeNode = null;
            for (const c of cells) {
                if (this._colIndexFromAddr(c.getAttribute('r') || '') > targetIdx) {
                    insertBeforeNode = c;
                    break;
                }
            }
            if (insertBeforeNode) {
                rowEl.insertBefore(cell, insertBeforeNode);
            } else {
                rowEl.appendChild(cell);
            }
        } else if (styleId !== null && styleId !== undefined && styleId !== '') {
            cell.setAttribute('s', String(styleId));
        }

        while (cell.firstChild) {
            cell.removeChild(cell.firstChild);
        }
        cell.removeAttribute('t');

        if (type === 'empty') {
            return cell;
        }

        if (formula !== null && formula !== undefined) {
            if (type === 'strFormula') {
                cell.setAttribute('t', 'str');
            }
            const fEl = ns ? doc.createElementNS(ns, 'f') : doc.createElement('f');
            fEl.textContent = String(formula);
            cell.appendChild(fEl);

            if (value !== null && value !== undefined) {
                const vEl = ns ? doc.createElementNS(ns, 'v') : doc.createElement('v');
                vEl.textContent = String(value);
                cell.appendChild(vEl);
            }
            return cell;
        }

        if (type === 'num') {
            const vEl = ns ? doc.createElementNS(ns, 'v') : doc.createElement('v');
            vEl.textContent = String(value);
            cell.appendChild(vEl);
            return cell;
        }

        // Default: inline string
        const strVal = String(value ?? '');
        cell.setAttribute('t', 'inlineStr');
        const isEl = ns ? doc.createElementNS(ns, 'is') : doc.createElement('is');
        const tEl = ns ? doc.createElementNS(ns, 't') : doc.createElement('t');
        if (/^\s|\s$/.test(strVal)) {
            tEl.setAttribute('xml:space', 'preserve');
        }
        tEl.textContent = strVal;
        isEl.appendChild(tEl);
        cell.appendChild(isEl);
        return cell;
    }

    static _ensureCurrencyStyle(stylesDoc, styleCache, baseStyleId, numFmtId = '4', fontIdOverride = null) {
        if (!stylesDoc || baseStyleId === null || baseStyleId === undefined || baseStyleId === '') {
            return baseStyleId;
        }
        const cellXfs = stylesDoc.getElementsByTagName('cellXfs')[0];
        if (!cellXfs) return baseStyleId;

        const xfList = Array.from(cellXfs.childNodes).filter(n => n.nodeName === 'xf');
        const idx = parseInt(baseStyleId, 10);
        if (isNaN(idx) || idx < 0 || idx >= xfList.length) return baseStyleId;

        const cacheKey = `${idx}|${numFmtId}|${fontIdOverride ?? ''}`;
        if (styleCache.has(cacheKey)) {
            return styleCache.get(cacheKey);
        }

        const baseXf = xfList[idx];
        const existingFmt = baseXf.getAttribute('numFmtId') || '0';
        const hasFontMatch = fontIdOverride === null || fontIdOverride === undefined || baseXf.getAttribute('fontId') === String(fontIdOverride);

        if (existingFmt !== '0' && hasFontMatch) {
            styleCache.set(cacheKey, String(idx));
            return String(idx);
        }

        const clonedXf = baseXf.cloneNode(true);
        clonedXf.setAttribute('numFmtId', String(numFmtId));
        clonedXf.setAttribute('applyNumberFormat', '1');
        if (fontIdOverride !== null && fontIdOverride !== undefined && fontIdOverride !== '') {
            clonedXf.setAttribute('fontId', String(fontIdOverride));
            clonedXf.setAttribute('applyFont', '1');
        }

        cellXfs.appendChild(clonedXf);
        const newIdx = xfList.length;
        cellXfs.setAttribute('count', String(newIdx + 1));
        styleCache.set(cacheKey, String(newIdx));
        return String(newIdx);
    }

    static _getFontIdForStyle(stylesDoc, styleId) {
        if (!stylesDoc || styleId === null || styleId === undefined) return null;
        const cellXfs = stylesDoc.getElementsByTagName('cellXfs')[0];
        if (!cellXfs) return null;
        const xfList = Array.from(cellXfs.childNodes).filter(n => n.nodeName === 'xf');
        const idx = parseInt(styleId, 10);
        if (isNaN(idx) || idx < 0 || idx >= xfList.length) return null;
        return xfList[idx].getAttribute('fontId') || null;
    }

    static _cloneTemplateRow(protoRowEl, targetRowNum) {
        const cloned = protoRowEl.cloneNode(true);
        cloned.setAttribute('r', String(targetRowNum));
        const cells = Array.from(cloned.childNodes).filter(n => n.nodeName === 'c');
        for (const cell of cells) {
            const oldAddr = cell.getAttribute('r') || '';
            const col = oldAddr.replace(/[0-9]/g, '');
            if (col) {
                cell.setAttribute('r', `${col}${targetRowNum}`);
            }
            cell.removeAttribute('t');
            while (cell.firstChild) {
                cell.removeChild(cell.firstChild);
            }
        }
        return cloned;
    }

    static _shiftRowsAndInsertClones(doc, sheetData, protoRowEl, footerStartRow, shiftCount) {
        if (shiftCount <= 0) return;

        // 1. Expand worksheet <dimension ref="A1:..."/>
        const dimEl = doc.getElementsByTagName('dimension')[0];
        if (dimEl) {
            const ref = dimEl.getAttribute('ref') || '';
            const parts = ref.split(':');
            if (parts.length === 2) {
                const endCol = parts[1].replace(/[0-9]/g, '');
                const endRow = parseInt(parts[1].replace(/[^0-9]/g, ''), 10);
                if (endCol && !isNaN(endRow)) {
                    dimEl.setAttribute('ref', `${parts[0]}:${endCol}${endRow + shiftCount}`);
                }
            }
        }

        // 2. Shift <mergeCell ref="..."/> definitions at or below footerStartRow
        const mergeCells = doc.getElementsByTagName('mergeCell');
        for (const mc of Array.from(mergeCells)) {
            const ref = mc.getAttribute('ref') || '';
            const shiftedRef = ref.split(':').map(part => {
                const col = part.replace(/[0-9]/g, '');
                const row = parseInt(part.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(row) && row >= footerStartRow) {
                    return `${col}${row + shiftCount}`;
                }
                return part;
            }).join(':');
            if (shiftedRef !== ref) {
                mc.setAttribute('ref', shiftedRef);
            }
        }

        // 3. Shift existing footer rows descending
        const allRows = Array.from(sheetData.childNodes).filter(n => n.nodeName === 'row');
        const footerRows = allRows
            .map(rowEl => ({ rowEl, rNum: parseInt(rowEl.getAttribute('r') || '0', 10) }))
            .filter(item => item.rNum >= footerStartRow)
            .sort((a, b) => b.rNum - a.rNum);

        for (const { rowEl, rNum } of footerRows) {
            const newR = rNum + shiftCount;
            rowEl.setAttribute('r', String(newR));
            const cellNodes = Array.from(rowEl.childNodes).filter(n => n.nodeName === 'c');
            for (const cell of cellNodes) {
                const oldAddr = cell.getAttribute('r') || '';
                const col = oldAddr.replace(/[0-9]/g, '');
                if (col) {
                    cell.setAttribute('r', `${col}${newR}`);
                }
            }
        }

        // 4. Insert cloned data rows in ascending order before the first shifted footer row
        const firstShiftedFooter = Array.from(sheetData.childNodes).find(
            n => n.nodeName === 'row' && parseInt(n.getAttribute('r') || '0', 10) >= footerStartRow + shiftCount
        ) || null;

        for (let r = footerStartRow; r < footerStartRow + shiftCount; r++) {
            const clonedRow = this._cloneTemplateRow(protoRowEl, r);
            if (firstShiftedFooter) {
                sheetData.insertBefore(clonedRow, firstShiftedFooter);
            } else {
                sheetData.appendChild(clonedRow);
            }
        }
    }

    static _normalizeSheetViewTop(doc) {
        const sheetViews = doc.getElementsByTagName('sheetView');
        for (const sv of Array.from(sheetViews)) {
            sv.removeAttribute('tabSelected');
            sv.setAttribute('topLeftCell', 'A1');
        }
    }

    static _normalizeStudentRecord(s) {
        let lastName = String(s.lastName || s.last_name || '').trim();
        let givenName = String(s.firstName || s.first_name || s.givenName || s.given_name || '').trim();
        let middleName = String(s.middleName || s.middle_name || '').trim();
        let middleInitial = String(s.mi || s.middleInitial || s.middle_initial || '').trim();
        if (!middleInitial && middleName) {
            middleInitial = middleName.charAt(0).toUpperCase();
        }

        if (!lastName && !givenName) {
            const parsed = this._splitFullName(s.fullName || s.full_name || s.name || '');
            lastName = parsed.lastName || 'N/A';
            givenName = parsed.givenName || 'N/A';
            if (!middleInitial) middleInitial = parsed.middleInitial || '';
        }

        const rawGender = String(s.gender || s.sex || 'M').trim().toUpperCase();
        const gender = rawGender.startsWith('F') ? 'F' : 'M';

        const rawYear = String(s.year || s.yearLevel || s.year_level || s.scholarYearLevel || '1').trim();
        const yearDigits = rawYear.replace(/[^0-9]/g, '');
        const year = yearDigits || rawYear || '1';

        const family = s.familyDetails || {};
        const sa = String(s.saNumber || family.saNumber || s.tesAppNumber || s.tesApplicationNumber || '').trim() || 'N/A';
        const studId = String(s.studentId || s.student_id || s.student_no || s.studentNo || s.studentNumber || '').trim() || 'N/A';
        const course = String(s.degree || s.program_name || s.programName || s.course || s.program || s.degreeProgram || '').trim() || 'BSIT';

        let bdate = String(s.birthdate || s.birthday || '').trim();
        if (!bdate || bdate.toUpperCase() === 'N/A') {
            bdate = '01/01/2000';
        } else if (/^\d{4}-\d{2}-\d{2}/.test(bdate)) {
            const [y, m, d] = bdate.split('T')[0].split('-');
            bdate = `${m}/${d}/${y}`;
        }

        const email = String(s.email || s.authEmail || s.emailAddress || '').trim() || 'N/A';
        const phone = String(s.phone || s.contactNumber || s.phoneNumber || '').trim() || 'N/A';

        const rawBatch = String(s.batch || s.tes_batch || s.tesBatch || '1').trim();
        const cleanBatch = rawBatch.replace(/^(?:tes\s*)?batch\s*/i, '').trim() || '1';

        return {
            lastName,
            givenName,
            middleInitial,
            gender,
            year,
            sa,
            studId,
            course,
            bdate,
            email,
            phone,
            cleanBatch
        };
    }

    /**
     * Populates the consolidated Annex 5 workbook (0_Annex_5_TES_New_Billing_Form.xlsx)
     * containing Form 1 (Billing Summary), Form 2 (Enrolled Grantees), Form 3 (Not Included),
     * and TES Amount reference sheet into a single .xlsx file while strictly preserving
     * original template layout, styles, borders, merges, logos/drawings, comments, and validations.
     */
    static async fillAnnex5ConsolidatedWorkbook(templateBytes, {
        form2Students = [],
        form3Students = [],
        academicYear = '2024-2025',
        semester = '1st Semester'
    } = {}) {
        const zip = await JSZip.loadAsync(templateBytes);
        const parser = new DOMParser();
        const serializer = new XMLSerializer();

        // Date & Term / Batch metadata
        const now = new Date();
        const exportDateStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;

        const hasSpecificSem = Boolean(semester && semester !== 'All');
        const hasSpecificAy = Boolean(academicYear && academicYear !== 'All');
        const semDisplay = hasSpecificSem ? String(semester).trim() : '1st Semester';
        const ayDisplay = hasSpecificAy ? String(academicYear).trim() : '2024-2025';
        const fyMatch = ayDisplay.match(/\b(20\d{2})\b/);
        const fyDisplay = fyMatch ? fyMatch[1] : String(now.getFullYear());

        const batchSet = new Set();
        for (const s of [...form2Students, ...form3Students]) {
            const raw = String(s.batch || s.tes_batch || s.tesBatch || '').trim();
            const cleaned = raw.replace(/^(?:tes\s*)?batch\s*/i, '').trim();
            if (cleaned) batchSet.add(cleaned);
        }
        const batchArr = Array.from(batchSet);
        const batchLabel = batchArr.length === 1
            ? batchArr[0]
            : (batchArr.length > 1 ? batchArr.join(', ') : '1');
        const batchTermHeader = `TES Batch ${batchLabel} - ${semDisplay}, AY ${ayDisplay}`;

        // Load styles.xml for safe dynamic currency <xf> cloning
        const styleCache = new Map();
        let stylesDoc = null;
        if (zip.file('xl/styles.xml')) {
            const stylesXml = await zip.file('xl/styles.xml').async('string');
            stylesDoc = parser.parseFromString(stylesXml, 'application/xml');
        }

        // ── 1. Sheet 2: Annex 5-TES New Form 2 (Enrolled Grantees & Billing) ──
        const f2StartRow = 42;
        const f2Capacity = 6;
        const f2FooterStart = 48;
        const shiftCount2 = form2Students.length > f2Capacity ? form2Students.length - f2Capacity : 0;
        const f2TotalSlots = Math.max(f2Capacity, form2Students.length);
        const lastF2Row = f2StartRow + f2TotalSlots - 1; // 47 + shiftCount2

        let totalTesAmount = 0;
        let totalPwdAmount = 0;

        if (zip.file('xl/worksheets/sheet2.xml')) {
            const sheet2Xml = await zip.file('xl/worksheets/sheet2.xml').async('string');
            const doc2 = parser.parseFromString(sheet2Xml, 'application/xml');
            const sheetData2 = doc2.getElementsByTagName('sheetData')[0];
            this._normalizeSheetViewTop(doc2);

            // Header metadata (B10 batch/term, O12 date; keep O11 formula linked to Form 1 U11)
            const row10 = this._getOrCreateRow(doc2, sheetData2, 10);
            this._setCellContent(doc2, row10, 'B10', { type: 'str', value: batchTermHeader });
            const row12 = this._getOrCreateRow(doc2, sheetData2, 12);
            this._setCellContent(doc2, row12, 'O12', { type: 'str', value: exportDateStr });

            // Prototype row 45 carries uniform medium 4-sided borders and P45 accounting style
            const protoRow45 = this._getOrCreateRow(doc2, sheetData2, 45);
            const p45BaseStyle = this._getCellStyle(doc2, sheetData2, 45, 'P') || this._getCellStyle(doc2, sheetData2, 45, 'O');
            const f2AccountingStyle = this._ensureCurrencyStyle(stylesDoc, styleCache, p45BaseStyle, '164');

            if (shiftCount2 > 0) {
                this._shiftRowsAndInsertClones(doc2, sheetData2, protoRow45, f2FooterStart, shiftCount2);
            }

            // Clear all data slots B..Q (rows 42..lastF2Row) and normalize O, P, Q currency styles
            for (let r = f2StartRow; r <= lastF2Row; r++) {
                const rowEl = this._getOrCreateRow(doc2, sheetData2, r);
                for (let c = 1; c <= 16; c++) {
                    const col = this._colLetter(c);
                    const styleOverride = (c >= 14 && c <= 16) ? f2AccountingStyle : null;
                    this._setCellContent(doc2, rowEl, `${col}${r}`, { type: 'empty', styleId: styleOverride });
                }
            }

            // Populate Form 2 student rows
            for (let i = 0; i < form2Students.length; i++) {
                const s = form2Students[i];
                const norm = this._normalizeStudentRecord(s);
                const rowNum = f2StartRow + i;
                const rowEl = this._getOrCreateRow(doc2, sheetData2, rowNum);
                const ctrl = String(i + 1).padStart(5, '0');

                const rawTes = s.tesAmount ?? s.tes_amount;
                const rawPwd = s.pwdAmount ?? s.pwd_amount;
                const tesAmt = (rawTes !== undefined && rawTes !== null && rawTes !== '' && Number.isFinite(Number(rawTes)))
                    ? Number(rawTes)
                    : 10000;
                const pwdAmt = (rawPwd !== undefined && rawPwd !== null && rawPwd !== '' && Number.isFinite(Number(rawPwd)))
                    ? Number(rawPwd)
                    : 0;
                const rowTotal = tesAmt + pwdAmt;

                totalTesAmount += tesAmt;
                totalPwdAmount += pwdAmt;

                this._setCellContent(doc2, rowEl, `B${rowNum}`, { type: 'str', value: ctrl });
                this._setCellContent(doc2, rowEl, `C${rowNum}`, { type: 'str', value: norm.studId });
                this._setCellContent(doc2, rowEl, `D${rowNum}`, { type: 'str', value: norm.sa });
                this._setCellContent(doc2, rowEl, `E${rowNum}`, { type: 'str', value: norm.lastName });
                this._setCellContent(doc2, rowEl, `F${rowNum}`, { type: 'str', value: norm.givenName });
                this._setCellContent(doc2, rowEl, `G${rowNum}`, { type: 'str', value: norm.middleInitial });
                this._setCellContent(doc2, rowEl, `H${rowNum}`, { type: 'str', value: norm.gender });
                this._setCellContent(doc2, rowEl, `I${rowNum}`, { type: 'str', value: norm.bdate });
                this._setCellContent(doc2, rowEl, `J${rowNum}`, { type: 'str', value: norm.course });
                this._setCellContent(doc2, rowEl, `K${rowNum}`, { type: 'str', value: norm.year });
                this._setCellContent(doc2, rowEl, `L${rowNum}`, { type: 'str', value: norm.email });
                this._setCellContent(doc2, rowEl, `M${rowNum}`, { type: 'str', value: norm.phone });

                if (/^\d+(\.\d+)?$/.test(norm.cleanBatch)) {
                    this._setCellContent(doc2, rowEl, `N${rowNum}`, { type: 'num', value: Number(norm.cleanBatch) });
                } else {
                    this._setCellContent(doc2, rowEl, `N${rowNum}`, { type: 'str', value: norm.cleanBatch });
                }

                this._setCellContent(doc2, rowEl, `O${rowNum}`, { type: 'num', value: tesAmt, styleId: f2AccountingStyle });
                this._setCellContent(doc2, rowEl, `P${rowNum}`, { type: 'num', value: pwdAmt, styleId: f2AccountingStyle });
                this._setCellContent(doc2, rowEl, `Q${rowNum}`, {
                    formula: `SUM(O${rowNum}:P${rowNum})`,
                    value: rowTotal,
                    styleId: f2AccountingStyle
                });
            }

            // Form 2 Footer Totals (Note: B48:P48 is merged "Page Total", so write ONLY to column Q)
            const totalAmount = totalTesAmount + totalPwdAmount;
            const mgmtFee = Math.round(totalAmount * 0.01 * 100) / 100;
            const grandTotal = Math.round((totalAmount + mgmtFee) * 100) / 100;

            const r48 = 48 + shiftCount2;
            const r49 = 49 + shiftCount2;
            const r50 = 50 + shiftCount2;
            const r51 = 51 + shiftCount2;
            const r52 = 52 + shiftCount2;

            const setFooterFormulaQ = (rNum, formulaStr, cachedVal) => {
                const rEl = this._getOrCreateRow(doc2, sheetData2, rNum);
                const baseS = this._getCellStyle(doc2, sheetData2, rNum, 'Q');
                const currS = this._ensureCurrencyStyle(stylesDoc, styleCache, baseS, '4');
                this._setCellContent(doc2, rEl, `Q${rNum}`, {
                    formula: formulaStr,
                    value: cachedVal,
                    styleId: currS
                });
            };

            setFooterFormulaQ(r48, `SUM(Q${f2StartRow}:Q${lastF2Row})`, totalAmount);
            setFooterFormulaQ(r49, `SUM(Q${f2StartRow}:Q${lastF2Row})`, totalAmount);
            setFooterFormulaQ(r50, `ROUND(Q${r49}*0.01,2)`, mgmtFee);
            setFooterFormulaQ(r51, `Q${r49}+Q${r50}`, grandTotal);
            setFooterFormulaQ(r52, `Q${r51}`, grandTotal);

            zip.file('xl/worksheets/sheet2.xml', serializer.serializeToString(doc2));
        }

        // ── 2. Sheet 3: Annex 5-TES New Form 3 (Not Included Students) ──
        const f3StartRow = 34;
        const f3Capacity = 6;
        const f3FooterStart = 40;
        const shiftCount3 = form3Students.length > f3Capacity ? form3Students.length - f3Capacity : 0;
        const f3TotalSlots = Math.max(f3Capacity, form3Students.length);
        const lastF3Row = f3StartRow + f3TotalSlots - 1; // 39 + shiftCount3

        if (zip.file('xl/worksheets/sheet3.xml')) {
            const sheet3Xml = await zip.file('xl/worksheets/sheet3.xml').async('string');
            const doc3 = parser.parseFromString(sheet3Xml, 'application/xml');
            const sheetData3 = doc3.getElementsByTagName('sheetData')[0];
            this._normalizeSheetViewTop(doc3);

            // Header metadata: B9 formula linked to Form 2 B10, L11 export date
            const row9_3 = this._getOrCreateRow(doc3, sheetData3, 9);
            this._setCellContent(doc3, row9_3, 'B9', {
                type: 'strFormula',
                formula: "'Annex 5-TES New Form 2'!B10",
                value: batchTermHeader
            });
            const row11_3 = this._getOrCreateRow(doc3, sheetData3, 11);
            this._setCellContent(doc3, row11_3, 'L11', { type: 'str', value: exportDateStr });

            // Capture L34's centered wrapText style before clearing sample text in L34
            const statusWrapStyle = this._getCellStyle(doc3, sheetData3, 34, 'L');
            const protoRow35 = this._getOrCreateRow(doc3, sheetData3, 35);

            if (shiftCount3 > 0) {
                this._shiftRowsAndInsertClones(doc3, sheetData3, protoRow35, f3FooterStart, shiftCount3);

                // Expand Status dropdown <dataValidation sqref="L34:L39"> to cover all Form 3 rows
                const dvs = doc3.getElementsByTagName('dataValidation');
                for (const dv of Array.from(dvs)) {
                    const sqref = dv.getAttribute('sqref') || '';
                    if (sqref.includes('L34:L39')) {
                        dv.setAttribute('sqref', sqref.replace('L34:L39', `L34:L${lastF3Row}`));
                    }
                }
            }

            // Clear all data slots B..M (rows 34..lastF3Row), removing template sample text in L34
            for (let r = f3StartRow; r <= lastF3Row; r++) {
                const rowEl = this._getOrCreateRow(doc3, sheetData3, r);
                for (let c = 1; c <= 12; c++) {
                    const col = this._colLetter(c);
                    const styleOverride = (c === 11 && statusWrapStyle) ? statusWrapStyle : null;
                    this._setCellContent(doc3, rowEl, `${col}${r}`, { type: 'empty', styleId: styleOverride });
                }
            }

            // Populate Form 3 student rows
            for (let i = 0; i < form3Students.length; i++) {
                const s = form3Students[i];
                const norm = this._normalizeStudentRecord(s);
                const rowNum = f3StartRow + i;
                const rowEl = this._getOrCreateRow(doc3, sheetData3, rowNum);
                const ctrl = String(i + 1).padStart(5, '0');

                const status = String(s.status || s.specialStatusReason || s.submissionStatus || 'Not enrolled').trim();
                const remarks = String(
                    s.remarks || s.adminRemarks ||
                    (status === 'On Leave of Absence (LOA)' ? 'On approved Leave of Absence' : `Categorized: ${status}`)
                ).trim();

                this._setCellContent(doc3, rowEl, `B${rowNum}`, { type: 'str', value: ctrl });
                this._setCellContent(doc3, rowEl, `C${rowNum}`, { type: 'str', value: norm.studId });
                this._setCellContent(doc3, rowEl, `D${rowNum}`, { type: 'str', value: norm.sa });
                this._setCellContent(doc3, rowEl, `E${rowNum}`, { type: 'str', value: norm.lastName });
                this._setCellContent(doc3, rowEl, `F${rowNum}`, { type: 'str', value: norm.givenName });
                this._setCellContent(doc3, rowEl, `G${rowNum}`, { type: 'str', value: norm.middleInitial });
                this._setCellContent(doc3, rowEl, `H${rowNum}`, { type: 'str', value: norm.gender });
                this._setCellContent(doc3, rowEl, `I${rowNum}`, { type: 'str', value: norm.bdate });
                this._setCellContent(doc3, rowEl, `J${rowNum}`, { type: 'str', value: norm.course });
                this._setCellContent(doc3, rowEl, `K${rowNum}`, { type: 'str', value: norm.year });
                this._setCellContent(doc3, rowEl, `L${rowNum}`, { type: 'str', value: status, styleId: statusWrapStyle });
                this._setCellContent(doc3, rowEl, `M${rowNum}`, { type: 'str', value: remarks });
            }

            // Form 3 Footer Counts (Page Total & Page Accumulated Total in column M)
            const r40_3 = 40 + shiftCount3;
            const r41_3 = 41 + shiftCount3;
            const row40El = this._getOrCreateRow(doc3, sheetData3, r40_3);
            const row41El = this._getOrCreateRow(doc3, sheetData3, r41_3);

            this._setCellContent(doc3, row40El, `M${r40_3}`, {
                formula: `COUNTA(B${f3StartRow}:B${lastF3Row})`,
                value: form3Students.length
            });
            this._setCellContent(doc3, row41El, `M${r41_3}`, {
                formula: `M${r40_3}`,
                value: form3Students.length
            });

            zip.file('xl/worksheets/sheet3.xml', serializer.serializeToString(doc3));
        }

        // ── 3. Sheet 1: Annex 5-TES New Form 1 (Consolidated Billing Summary) ──
        if (zip.file('xl/worksheets/sheet1.xml')) {
            const sheet1Xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
            const doc1 = parser.parseFromString(sheet1Xml, 'application/xml');
            const sheetData1 = doc1.getElementsByTagName('sheetData')[0];
            this._normalizeSheetViewTop(doc1);

            const totalAmount = totalTesAmount + totalPwdAmount;
            const mgmtFee = Math.round(totalAmount * 0.01 * 100) / 100;
            const grandTotal = Math.round((totalAmount + mgmtFee) * 100) / 100;
            const f2MgmtFeeRow = 50 + shiftCount2;

            // Header Batch/Term (B9) & Date (U12)
            const row9_1 = this._getOrCreateRow(doc1, sheetData1, 9);
            this._setCellContent(doc1, row9_1, 'B9', { type: 'str', value: batchTermHeader });
            const row12_1 = this._getOrCreateRow(doc1, sheetData1, 12);
            this._setCellContent(doc1, row12_1, 'U12', { type: 'str', value: exportDateStr });

            // Billing statement body lines (E17, E18, E19) & footer question (C42)
            if (hasSpecificSem) {
                const row17_1 = this._getOrCreateRow(doc1, sheetData1, 17);
                this._setCellContent(doc1, row17_1, 'E17', {
                    type: 'str',
                    value: `Request for payment of the Tertiary Education Subsidy (TES) grant for ${semDisplay},  `
                });
            }
            if (hasSpecificAy) {
                const row18_1 = this._getOrCreateRow(doc1, sheetData1, 18);
                this._setCellContent(doc1, row18_1, 'E18', {
                    type: 'str',
                    value: `Academic Year ${ayDisplay} to be charged against the funds for Universal Access to Quality `
                });
                const row19_1 = this._getOrCreateRow(doc1, sheetData1, 19);
                this._setCellContent(doc1, row19_1, 'E19', {
                    type: 'str',
                    value: `Tertiary Education (UAQTE) under General Appropriation Act (GAA)  for Fiscal Year ${fyDisplay}, `
                });
                const row42_1 = this._getOrCreateRow(doc1, sheetData1, 42);
                this._setCellContent(doc1, row42_1, 'C42', {
                    type: 'str',
                    value: `Is this the last batch of billing for this term of AY ${ayDisplay}?`
                });
            }

            // Form 1 Summary Table live formulas linked to Form 2
            const row24_1 = this._getOrCreateRow(doc1, sheetData1, 24);
            this._setCellContent(doc1, row24_1, 'U24', {
                formula: `COUNTA('Annex 5-TES New Form 2'!B${f2StartRow}:B${lastF2Row})`,
                value: form2Students.length
            });

            const setForm1CurrencyCell = (rNum, formulaStr, cachedVal, boldFromT29 = false) => {
                const rEl = this._getOrCreateRow(doc1, sheetData1, rNum);
                const baseS = this._getCellStyle(doc1, sheetData1, rNum, 'Y');
                let boldFontId = null;
                if (boldFromT29) {
                    const t29Style = this._getCellStyle(doc1, sheetData1, 29, 'T');
                    boldFontId = this._getFontIdForStyle(stylesDoc, t29Style);
                }
                const currS = this._ensureCurrencyStyle(stylesDoc, styleCache, baseS, '4', boldFontId);
                this._setCellContent(doc1, rEl, `Y${rNum}`, {
                    formula: formulaStr,
                    value: cachedVal,
                    styleId: currS
                });
            };

            setForm1CurrencyCell(25, `SUM('Annex 5-TES New Form 2'!O${f2StartRow}:O${lastF2Row})`, totalTesAmount);
            setForm1CurrencyCell(26, `SUM('Annex 5-TES New Form 2'!P${f2StartRow}:P${lastF2Row})`, totalPwdAmount);
            setForm1CurrencyCell(27, 'SUM(Y25:Y26)', totalAmount);
            setForm1CurrencyCell(28, `'Annex 5-TES New Form 2'!Q${f2MgmtFeeRow}`, mgmtFee);
            setForm1CurrencyCell(29, 'SUM(Y27:Y28)', grandTotal, true);

            zip.file('xl/worksheets/sheet1.xml', serializer.serializeToString(doc1));
        }

        // ── 4. Save updated styles.xml & clean calcChain for seamless Excel recalculation ──
        if (stylesDoc) {
            zip.file('xl/styles.xml', serializer.serializeToString(stylesDoc));
        }

        if (zip.file('xl/calcChain.xml')) {
            zip.remove('xl/calcChain.xml');
        }

        if (zip.file('xl/_rels/workbook.xml.rels')) {
            const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');
            const relsDoc = parser.parseFromString(relsXml, 'application/xml');
            const rels = Array.from(relsDoc.getElementsByTagName('Relationship'));
            for (const rel of rels) {
                const target = rel.getAttribute('Target') || '';
                if (target.includes('calcChain.xml') && rel.parentNode) {
                    rel.parentNode.removeChild(rel);
                }
            }
            zip.file('xl/_rels/workbook.xml.rels', serializer.serializeToString(relsDoc));
        }

        if (zip.file('[Content_Types].xml')) {
            const ctXml = await zip.file('[Content_Types].xml').async('string');
            const ctDoc = parser.parseFromString(ctXml, 'application/xml');
            const overrides = Array.from(ctDoc.getElementsByTagName('Override'));
            for (const ov of overrides) {
                const partName = ov.getAttribute('PartName') || '';
                if (partName.includes('calcChain.xml') && ov.parentNode) {
                    ov.parentNode.removeChild(ov);
                }
            }
            zip.file('[Content_Types].xml', serializer.serializeToString(ctDoc));
        }

        if (zip.file('xl/workbook.xml')) {
            const wbXml = await zip.file('xl/workbook.xml').async('string');
            const wbDoc = parser.parseFromString(wbXml, 'application/xml');
            const calcPr = wbDoc.getElementsByTagName('calcPr')[0];
            if (calcPr) {
                calcPr.setAttribute('fullCalcOnLoad', '1');
            }
            const wbView = wbDoc.getElementsByTagName('workbookView')[0];
            if (wbView) {
                wbView.setAttribute('activeTab', '0');
            }
            zip.file('xl/workbook.xml', serializer.serializeToString(wbDoc));
        }

        const blob = await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        return {
            blob,
            form2Count: form2Students.length,
            form3Count: form3Students.length
        };
    }
}

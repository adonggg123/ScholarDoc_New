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
                    (String(s.scholarshipName || '').trim().toLowerCase() === scholarship.toLowerCase() ||
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
                this._fillIfEmpty(resultRow, match, 'Scholarship Type', ['scholarshipName', 'scholarshipType']);
                
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
                case 1: return '279';
                case 2: return '280';
                case 3: return '280';
                case 4: return '268';
                case 5: return '268';
                case 6: return '279';
                case 7: return '279';
                case 8: return '279';
                case 9: return '279';
                case 10: return '279';
                case 11: return '279';
                case 12: return '279';
                case 13: return '279';
                case 14: return '281';
                case 15: return '282';
                case 16: return '282';
                default: return '279';
            }
        } else {
            return colIdx === 11 ? '344' : '321';
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
            cell.setAttribute('s', defaultStyle);

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

    static _injectStudentRows(xmlStr, students, startRow, isForm2) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlStr, "application/xml");
        const sheetData = doc.getElementsByTagName("sheetData")[0];

        for (let i = 0; i < students.length; i++) {
            const s = students[i];
            const rowNum = startRow + i;
            const ctrl = String(i + 1).padStart(5, '0');

            const name = this._splitFullName(s.fullName || '');
            let gender = String(s.gender || 'M').toUpperCase();
            gender = gender.startsWith('F') ? 'F' : 'M';
            
            let rawYear = String(s.year || s.scholarYearLevel || '');
            let year = rawYear.includes('1') ? '1' :
                       rawYear.includes('2') ? '2' :
                       rawYear.includes('3') ? '3' :
                       rawYear.includes('4') ? '4' : rawYear;
                       
            const family = s.familyDetails || {};
            const sa = String(s.saNumber || family.saNumber || '');
            const course = String(s.course || '');
            let bdate = String(s.birthdate || s.birthday || '').trim();
            if (bdate === '' || bdate.toUpperCase() === 'N/A') bdate = '01/01/2000';
            const studId = String(s.studentId || '');

            const rowEl = this._getOrCreateRow(doc, sheetData, rowNum);

            const addr = (colIdx) => `${this._colLetter(colIdx)}${rowNum}`;

            const str = (colIdx, val) => this._fillCell(doc, rowEl, addr(colIdx), val, false, this._defaultStyle(colIdx, isForm2));
            const num_ = (colIdx, val) => this._fillCell(doc, rowEl, addr(colIdx), val, true, this._defaultStyle(colIdx, isForm2));

            str(1, ctrl);
            str(2, studId);
            str(3, sa !== '' ? sa : 'N/A');
            str(4, name.lastName);
            str(5, name.givenName);
            str(6, name.middleInitial);
            str(7, gender);
            str(8, bdate);
            str(9, course);
            str(10, year);

            if (isForm2) {
                const email = String(s.email || '');
                const phone = String(s.contactNumber || s.phone || '');
                str(11, email);
                str(12, phone);
                num_(13, 1);
                num_(14, 10000);
                num_(15, 0);
                num_(16, 10000);
            } else {
                const status = String(s.status || 'Approved');
                str(11, status);
                str(12, 'Active');
            }
        }

        const serializer = new XMLSerializer();
        return serializer.serializeToString(doc);
    }

    /**
     * Fills the Annex 5 template with student data.
     */
    static async fillAnnex5Template(templateBytes, students) {
        const tesScholars = students.filter(s => {
            const sc = String(s.scholarshipName || s.scholarshipType || '').toLowerCase();
            return sc.includes('tes');
        }).sort((a, b) => String(a.fullName || '').toLowerCase().localeCompare(String(b.fullName || '').toLowerCase()));

        const continuingScholars = [];
        const newScholars = [];
        
        // The user explicitly requested all scholars to fill Form 2.
        for (const s of tesScholars) {
            continuingScholars.push(s);
        }

        const zip = await JSZip.loadAsync(templateBytes);

        // The user's new template is a single Form 2 file, so the target sheet is sheet1.xml
        if (zip.file('xl/worksheets/sheet1.xml')) {
            let sheet1Xml = await zip.file('xl/worksheets/sheet1.xml').async("string");
            sheet1Xml = this._injectStudentRows(sheet1Xml, continuingScholars, 42, true);
            zip.file('xl/worksheets/sheet1.xml', sheet1Xml);
        }

        const outputBytes = await zip.generateAsync({ type: 'blob' });

        return {
            blob: outputBytes,
            continuingCount: continuingScholars.length,
            newCount: newScholars.length,
            totalCount: tesScholars.length
        };
    }
}

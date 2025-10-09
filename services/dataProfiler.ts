import { DataProfile, DataProfileColumn } from '../types';

const detectColumnType = (values: string[]): string => {
  if (values.every(v => v === null || v === undefined || v.trim() === '')) {
    return 'EMPTY';
  }

  let isNumeric = true;
  let isInteger = true;
  
  const sample = values.filter(v => v !== null && v !== undefined && v.trim() !== '');

  if (sample.length === 0) return 'EMPTY';

  for (const value of sample) {
    if (isNaN(Number(value))) {
      isNumeric = false;
      break;
    }
    if (!/^-?\d+$/.test(value)) {
      isInteger = false;
    }
  }

  if (isNumeric) {
    return isInteger ? 'INTEGER' : 'FLOAT';
  }
  
  // Basic date check on a sample
  const dateLike = sample.every(v => !isNaN(Date.parse(v)) || /^\d{4}-\d{2}-\d{2}/.test(v));
  if (dateLike && sample.length > 0) {
      return 'DATE';
  }

  return 'STRING';
};


export const profileData = (csvData: string): { profile: DataProfile; jsonData: Record<string, any>[] } => {
  const lines = csvData.trim().split(/\r?\n/);
  const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim().replace(/"/g, '')));

  if (rows.length === 0) {
    throw new Error("CSV file has no data rows.");
  }

  const columnCount = header.length;
  const rowCount = rows.length;
  const columns: DataProfileColumn[] = header.map((name, index) => {
    const colValues = rows.map(row => row[index]);
    const missing = colValues.filter(val => val === null || val === undefined || val.trim() === '').length;
    const type = detectColumnType(colValues);

    return {
      name,
      type,
      missing,
    };
  });
  
  const jsonData = rows.map(row => {
    const obj: Record<string, any> = {};
    header.forEach((key, index) => {
        const val = row[index];
        const type = columns[index].type;
        if (val === null || val === undefined || val.trim() === '') {
            obj[key] = null;
        } else if (type === 'INTEGER') {
            obj[key] = parseInt(val, 10);
        } else if (type === 'FLOAT') {
            obj[key] = parseFloat(val);
        } else {
            obj[key] = val;
        }
    });
    return obj;
  });

  const profile: DataProfile = {
    rowCount,
    columnCount,
    columns,
  };

  return { profile, jsonData };
};

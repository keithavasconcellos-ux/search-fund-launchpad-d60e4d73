const fs = require('fs');
const { parse } = require('csv-parse/sync');

const data = fs.readFileSync('CSVs/initial_places_pull', 'utf8');
const records = parse(data, { columns: true, skip_empty_lines: true, bom: true });

console.log(`Total rows: ${records.length}`);
console.log('--- First Row ---');
console.log(JSON.stringify(records[0], null, 2));

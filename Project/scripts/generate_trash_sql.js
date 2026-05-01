const fs = require('fs');
const path = require('path');

const userId = process.argv[2];
const icsPath = path.join(__dirname, '..', 'Trash-PickUp.ics');
const outputPath = path.join(__dirname, '..', 'migrations', '005_import_trash_pickups.sql');

if (!userId) {
    console.error('ERROR: Please provide your User ID as an argument.');
    console.log('Usage: node generate_trash_sql.js YOUR_USER_ID');
    process.exit(1);
}

if (!fs.existsSync(icsPath)) {
    console.error(`ERROR: File not found: ${icsPath}`);
    process.exit(1);
}

function cleanTitle(summary) {
    return summary
        .replace(/\s+\d+-wöchentlich$/i, '')         // "Restmüll 2-wöchentlich" → "Restmüll"
        .replace(/\s+4-wöchentlich$/i, '')             // "Papier 4-wöchentlich" → "Papier"
        .replace(/\s*\(.*\)$/, '')                     // strip "(Berufsschulzentrum, ...)"
        .trim();
}

function parseICS() {
    const data = fs.readFileSync(icsPath, 'utf8');
    const vevents = data.split('BEGIN:VEVENT');

    let sql = `-- Migration: 005_import_trash_pickups.sql\n`;
    sql += `-- Generated on ${new Date().toISOString()}\n\n`;

    let count = 0;

    vevents.forEach(block => {
        if (!block.includes('END:VEVENT')) return;

        const summaryMatch = block.match(/SUMMARY:(.*)/);
        if (!summaryMatch) return;
        const rawTitle = summaryMatch[1].trim();
        const title = cleanTitle(rawTitle);

        // Use only DTSTART — ignore DTEND
        const dateMatch = block.match(/DTSTART;VALUE=DATE:(\d{8})/);
        if (!dateMatch) return;
        const dateStr = dateMatch[1];

        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const startDate = `${year}-${month}-${day}`;

        sql += `INSERT INTO public.events (user_id, title, start_time, end_time, category, recurrence_type, is_all_day)\n`;
        sql += `VALUES ('${userId}', '${title.replace(/'/g, "''")}', '${startDate}T00:00:00Z', NULL, 'trash', 'none', true);\n\n`;

        count++;
    });

    fs.writeFileSync(outputPath, sql);
    console.log(`\nSUCCESS! Generated ${count} trash pickup entries.`);
    console.log(`SQL file saved to: ${outputPath}`);
    console.log(`\nNext step: Copy the content of this file and run it in the Supabase SQL Editor.`);
}

parseICS();

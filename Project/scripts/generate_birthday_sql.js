const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const userId = process.argv[2]; // Get USER_ID from command line argument
const icsPath = path.join(__dirname, 'birthdays.ics');
const outputPath = path.join(__dirname, 'migrations', '004_import_birthdays.sql');

if (!userId) {
    console.error('ERROR: Please provide your User ID as an argument.');
    console.log('Usage: node generate_birthday_sql.js YOUR_USER_ID');
    process.exit(1);
}

if (!fs.existsSync(icsPath)) {
    console.error(`ERROR: File not found: ${icsPath}`);
    process.exit(1);
}

function parseICS() {
    const data = fs.readFileSync(icsPath, 'utf8');
    const vevents = data.split('BEGIN:VEVENT');
    
    let sql = `-- Migration: 004_import_birthdays.sql\n`;
    sql += `-- Generated on ${new Date().toISOString()}\n\n`;
    
    let count = 0;
    
    vevents.forEach(block => {
        if (!block.includes('END:VEVENT')) return;

        // Extract Summary (Name)
        const summaryMatch = block.match(/SUMMARY:(.*)/);
        if (!summaryMatch) return;
        let name = summaryMatch[1].trim();

        // Check if it's a birthday
        const isBirthday = name.toLowerCase().includes('birthday') || 
                          name.toLowerCase().includes('geburtstag') ||
                          block.toLowerCase().includes('contact');

        if (!isBirthday) return;

        // Extract Date (DTSTART)
        const dateMatch = block.match(/DTSTART;VALUE=DATE:(\d{8})/);
        if (!dateMatch) return;
        const dateStr = dateMatch[1]; // YYYYMMDD
        
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const originalDate = `${year}-${month}-${day}`;

        // Clean Name: Strip "hat Geburtstag" or "Birthday"
        name = name.replace(/\s+(hat Geburtstag|birthday|Geburtstag).*$/gi, '').trim();

        // Build SQL Insert
        sql += `INSERT INTO public.events (user_id, title, start_time, category, recurrence_type, is_all_day)\n`;
        sql += `VALUES ('${userId}', '${name.replace(/'/g, "''")}', '${originalDate}T00:00:00Z', 'birthday', 'yearly', true);\n\n`;
        
        count++;
    });

    fs.writeFileSync(outputPath, sql);
    console.log(`\nSUCCESS! Generated ${count} birthday entries.`);
    console.log(`SQL file saved to: ${outputPath}`);
    console.log(`\nNext step: Copy the content of this file and run it in the Supabase SQL Editor.`);
}

parseICS();

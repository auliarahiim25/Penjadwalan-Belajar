const fs = require('fs');

const file = 'c:\\Users\\megap\\Documents\\penjadwalan-belajar\\admin.js';
let content = fs.readFileSync(file, 'utf8');

// Replace DB.getTeachers()
content = content.replace(/DB\.getTeachers\(\)/g, 'getFilteredTeachers()');

// Replace DB.getSchedules()
content = content.replace(/DB\.getSchedules\(\)/g, 'getFilteredSchedules()');

// Replace DB.getAllAvailability()
content = content.replace(/DB\.getAllAvailability\(\)/g, 'getFilteredAvailability()');

// Fix the replacements inside the helper functions themselves
content = content.replace(/const all = getFilteredTeachers\(\);/, 'const all = DB.getTeachers();');
content = content.replace(/return getFilteredSchedules\(\)\.filter/, 'return DB.getSchedules().filter');
content = content.replace(/return getFilteredAvailability\(\)\.filter/, 'return DB.getAllAvailability().filter');

fs.writeFileSync(file, content);
console.log('Done replacing DB calls in admin.js');

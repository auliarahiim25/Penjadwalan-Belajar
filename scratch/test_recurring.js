// Simulate the exact data and operations
const fs = require('fs');
const dataJs = fs.readFileSync('data.js', 'utf8');

// Evaluate data.js in global context
eval(dataJs);

const baseWeekStart = '2026-11-30';
const curWeekDates = getWeekDates(baseWeekStart);
console.log('curWeekDates:', curWeekDates);
const nextWeekMonday = adjustDateDays(baseWeekStart, 7);
console.log('nextWeekMonday:', nextWeekMonday);
const nextWeekDates = getWeekDates(nextWeekMonday);
console.log('nextWeekDates:', nextWeekDates);

const testDate = '2026-11-30';
const dayIdx = curWeekDates.indexOf(testDate);
const targetDate = (dayIdx !== -1) ? nextWeekDates[dayIdx] : adjustDateDays(testDate, 7);
console.log('testDate:', testDate, '-> targetDate:', targetDate, 'dayIdx:', dayIdx);

const testWed = '2026-12-02';
const dayIdxWed = curWeekDates.indexOf(testWed);
const targetDateWed = (dayIdxWed !== -1) ? nextWeekDates[dayIdxWed] : adjustDateDays(testWed, 7);
console.log('testWed:', testWed, '-> targetDateWed:', targetDateWed, 'dayIdxWed:', dayIdxWed);

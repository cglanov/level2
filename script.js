const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzvbWNgg871SEProfX4IW7r1TcisOv7y1gVDQkPjWO83VQGkcQ9Xa1kp6ccREy2qieD69shDCtoySo/pub?gid=0&single=true&output=csv';

// Replace with your Google Apps Script Web App URL once created
const GOOGLE_APPS_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';

let studentData = [];
let selectedTeacher = null;
let selectedStudent = null;

// DOM Elements
const teacherListEl = document.getElementById('teacher-list');
const studentGridEl = document.getElementById('student-grid');
const studentPanelEl = document.getElementById('panel-students');
const locationPanelEl = document.getElementById('panel-location');
const locationSelectEl = document.getElementById('location-select');
const otherLocationWrapper = document.getElementById('other-location-wrapper');
const otherLocationInput = document.getElementById('other-location-input');
const sendAlertBtn = document.getElementById('send-alert-btn');
const alertStatusEl = document.getElementById('alert-status');

// Initialize App
document.addEventListener('DOMContentLoaded', fetchStudentData);

async function fetchStudentData() {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error('Failed to fetch CSV data');
    const csvText = await response.text();
    
    studentData = parseCSV(csvText);
    
    // Check if the first row contains column headers and skip if needed
    if (studentData.length > 0) {
      const firstRowColC = (studentData[0][2] || '').toLowerCase();
      if (firstRowColC.includes('teacher') || firstRowColC.includes('column c')) {
        studentData.shift();
      }
    }
    
    renderTeacherList();
  } catch (error) {
    console.error('Error fetching CSV:', error);
    teacherListEl.innerHTML = `<p class="status-msg" style="color:red;">Error loading teacher data from sheet.</p>`;
  }
}

// Robust CSV parser handling quoted strings
function parseCSV(csvText) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentCell += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell !== '')) {
      rows.push(currentRow);
    }
  }
  return rows;
}

function renderTeacherList() {
  // Get unique teachers from Column C (index 2)
  const teachersSet = new Set();
  studentData.forEach(row => {
    const teacher = row[2];
    if (teacher) teachersSet.add(teacher.trim());
  });

  const teachers = Array.from(teachersSet).sort();

  if (teachers.length === 0) {
    teacherListEl.innerHTML = `<p class="status-msg">No teachers found.</p>`;
    return;
  }

  teacherListEl.innerHTML = '';
  teachers.forEach(teacher => {
    const btn = document.createElement('button');
    btn.className = 'teacher-item';
    btn.textContent = teacher;
    btn.addEventListener('click', () => selectTeacher(teacher, btn));
    teacherListEl.appendChild(btn);
  });
}

function selectTeacher(teacher, targetElement) {
  selectedTeacher = teacher;
  selectedStudent = null;

  // Highlight selected teacher
  document.querySelectorAll('.teacher-item').forEach(el => el.classList.remove('selected'));
  targetElement.classList.add('selected');

  // Activate/Reset Panels
  studentPanelEl.classList.remove('disabled');
  locationPanelEl.classList.add('disabled');
  sendAlertBtn.disabled = true;

  renderStudentGrid();
}

function renderStudentGrid() {
  studentGridEl.innerHTML = '';

  // Filter rows where Column C matches selected teacher
  const matchingStudents = studentData.filter(row => (row[2] || '').trim() === selectedTeacher);

  if (matchingStudents.length === 0) {
    studentGridEl.innerHTML = `<p class="placeholder-text">No students assigned to this teacher.</p>`;
    return;
  }

  matchingStudents.forEach(row => {
    const colA = (row[0] || '').trim();
    const colB = (row[1] || '').trim();
    const firstLetterB = colB.length > 0 ? colB.charAt(0).toUpperCase() : '';
    
    // Label format: Column A + space + first letter of Column B
    const buttonLabel = `${colA} ${firstLetterB}`.trim();
    const fullStudentName = `${colA} ${colB}`.trim();

    const btn = document.createElement('button');
    btn.className = 'student-btn';
    btn.textContent = buttonLabel;

    btn.addEventListener('click', () => selectStudent(fullStudentName, buttonLabel, btn));
    studentGridEl.appendChild(btn);
  });
}

function selectStudent(fullName, displayLabel, targetElement) {
  selectedStudent = { fullName, displayLabel };

  // Highlight selected student button
  document.querySelectorAll('.student-btn').forEach(el => el.classList.remove('selected'));
  targetElement.classList.add('selected');

  // Enable location panel
  locationPanelEl.classList.remove('disabled');
  sendAlertBtn.disabled = false;
  setupLocationDropdown();
}

function setupLocationDropdown() {
  locationSelectEl.innerHTML = '';

  const defaultOption = `${selectedTeacher}'s Classroom`;
  const locationOptions = [
    defaultOption,
    'recess',
    'cafeteria',
    'art',
    'design',
    'gym',
    'music',
    'spanish',
    'stem',
    'other'
  ];

  locationOptions.forEach(opt => {
    const optionEl = document.createElement('option');
    optionEl.value = opt;
    optionEl.textContent = opt;
    locationSelectEl.appendChild(optionEl);
  });

  otherLocationWrapper.classList.add('hidden');
  otherLocationInput.value = '';

  locationSelectEl.onchange = (e) => {
    if (e.target.value === 'other') {
      otherLocationWrapper.classList.remove('hidden');
      otherLocationInput.focus();
    } else {
      otherLocationWrapper.classList.add('hidden');
    }
  };
}

sendAlertBtn.addEventListener('click', async () => {
  if (!selectedTeacher || !selectedStudent) return;

  let locationValue = locationSelectEl.value;
  if (locationValue === 'other') {
    locationValue = otherLocationInput.value.trim();
    if (!locationValue) {
      alert('Please enter a location in the text box.');
      otherLocationInput.focus();
      return;
    }
  }

  const alertPayload = {
    teacher: selectedTeacher,
    studentName: selectedStudent.fullName,
    studentLabel: selectedStudent.displayLabel,
    location: locationValue,
    timestamp: new Date().toLocaleString()
  };

  sendAlertBtn.disabled = true;
  alertStatusEl.style.color = '#1a73e8';
  alertStatusEl.textContent = 'Sending Level 2 Alert...';

  try {
    if (GOOGLE_APPS_SCRIPT_URL !== 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
      await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertPayload)
      });
    } else {
      console.log('Payload ready for Apps Script:', alertPayload);
    }

    alertStatusEl.style.color = '#137333';
    alertStatusEl.textContent = 'Level 2 Alert Sent!';

    setTimeout(() => {
      alertStatusEl.textContent = '';
      sendAlertBtn.disabled = false;
    }, 3000);

  } catch (error) {
    console.error('Error sending alert:', error);
    alertStatusEl.style.color = '#d93025';
    alertStatusEl.textContent = 'Failed to send alert. Check connection.';
    sendAlertBtn.disabled = false;
  }
});

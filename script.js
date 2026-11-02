const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzvbWNgg871SEProfX4IW7r1TcisOv7y1gVDQkPjWO83VQGkcQ9Xa1kp6ccREy2qieD69shDCtoySo/pub?gid=0&single=true&output=csv';
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxJi5fstpdPXgRx45hU2MGV7OoZ-SAqdWKpVS4rp6V4_dkVRvH6ua8bC9tSM3ZH3PTY/exec';
const EMAIL_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyT2PomSIybLL-WvdkZ8xlx82CK1VQfY0TO17yH8Bg91Nx3WfvIo-ZwNoTaXSdbonDn/exec';

let studentData = [];
let selectedTeacher = null;
let selectedStudent = null;
let trackerPdfBytes = null; // Store PDF template

const teacherListEl = document.getElementById('teacher-list');
const studentGridEl = document.getElementById('student-grid');
const studentPanelEl = document.getElementById('panel-students');
const locationPanelEl = document.getElementById('panel-location');
const locationSelectEl = document.getElementById('location-select');
const otherLocationWrapper = document.getElementById('other-location-wrapper');
const otherLocationInput = document.getElementById('other-location-input');
const sendAlertBtn = document.getElementById('send-alert-btn');
const alertStatusEl = document.getElementById('alert-status');

// Initialize App and load PDF Template
document.addEventListener('DOMContentLoaded', () => {
  fetchStudentData();
  fetch('tracker.pdf')
    .then(res => res.arrayBuffer())
    .then(data => trackerPdfBytes = data)
    .catch(err => console.error("Error loading PDF template:", err));
});

async function fetchStudentData() {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error('Failed to fetch CSV data');
    const csvText = await response.text();
    studentData = parseCSV(csvText);
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
      if (currentRow.some(cell => cell !== '')) rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell !== '')) rows.push(currentRow);
  }
  return rows;
}

function renderTeacherList() {
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
  document.querySelectorAll('.teacher-item').forEach(el => el.classList.remove('selected'));
  targetElement.classList.add('selected');
  studentPanelEl.classList.remove('disabled');
  locationPanelEl.classList.add('disabled');
  sendAlertBtn.disabled = true;
  renderStudentGrid();
}

function renderStudentGrid() {
  studentGridEl.innerHTML = '';
  const matchingStudents = studentData.filter(row => (row[2] || '').trim() === selectedTeacher);
  if (matchingStudents.length === 0) {
    studentGridEl.innerHTML = `<p class="placeholder-text">No students assigned to this teacher.</p>`;
    return;
  }
  matchingStudents.forEach(row => {
    const colA = (row[0] || '').trim();
    const colB = (row[1] || '').trim();
    const firstLetterB = colB.length > 0 ? colB.charAt(0).toUpperCase() : '';
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
  document.querySelectorAll('.student-btn').forEach(el => el.classList.remove('selected'));
  targetElement.classList.add('selected');
  locationPanelEl.classList.remove('disabled');
  sendAlertBtn.disabled = false;
  setupLocationDropdown();
}

function setupLocationDropdown() {
  locationSelectEl.innerHTML = '';
  const defaultOption = `${selectedTeacher}'s Classroom`;
  const locationOptions = [defaultOption, 'recess', 'cafeteria', 'art', 'design', 'gym', 'music', 'spanish', 'stem', 'other'];
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
    const requests = [];
    if (GOOGLE_APPS_SCRIPT_URL && GOOGLE_APPS_SCRIPT_URL !== 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
      requests.push(fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(alertPayload)
      }));
    }
    if (EMAIL_APPS_SCRIPT_URL && EMAIL_APPS_SCRIPT_URL !== 'YOUR_EMAIL_APPS_SCRIPT_URL_HERE') {
      requests.push(fetch(EMAIL_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(alertPayload)
      }));
    }
    await Promise.all(requests);

    // Trigger PDF generation upon successful alert submission
    await generateAndDownloadPDF(selectedTeacher, selectedStudent.fullName, locationValue);

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

// PDF Generation ported to Vanilla JS
async function generateAndDownloadPDF(teacherName, studentFullName, locationStr) {
  if (!trackerPdfBytes) {
    console.error("PDF template is missing or failed to load.");
    return;
  }

  const { PDFDocument, rgb } = PDFLib;
  const pdfDoc = await PDFDocument.load(trackerPdfBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { height } = firstPage.getSize();

  const textPositions = [[176, 242], [191, 281], [505, 278], [643, 277], [261, 320], [576, 319], [223, 395]];
  const scale = 1.5;

  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  const dateStr = `${mm}/${dd}/${yyyy}`;

  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  const displayH = h % 12 || 12;
  const timeStr = `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;

  // Location maps to the 3rd index (previously reserved for gradeLevel)
  const texts = [
    'Aerospace Elementary',
    studentFullName,
    locationStr, 
    teacherName,
    dateStr,
    timeStr
  ];

  for (let i = 0; i < texts.length; i++) {
    if (i >= textPositions.length) break;
    let [px, py] = textPositions[i];
    let pdfX = px / scale;
    let pdfY = height - (py / scale) - 12;
    firstPage.drawText(String(texts[i]), {
      x: pdfX,
      y: pdfY,
      size: 12,
      color: rgb(0, 0, 0),
    });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const initL = studentFullName.split(' ').pop().charAt(0).toUpperCase();
  const filename = `${initL}_Tracker_${mm}_${dd}.pdf`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

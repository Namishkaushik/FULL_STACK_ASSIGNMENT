(() => {
  const state = {
    activeView: 'overview',
    students: [],
    facultyRoster: [],
    facultySelections: new Map(), // rollNo -> 'Present' | 'Absent'
    facultyExisting: new Map(), // rollNo -> attendance record object
    currentSession: {
      subject: 'Data Structures',
      date: new Date().toISOString().slice(0, 10),
      markedBy: 'Dr. Ananya Rao',
    },
  };

  // DOM helpers
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(message, type = 'info') {
    const region = $('#toast-region');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'is-error' : type === 'success' ? 'is-success' : ''}`;
    toast.textContent = message;
    region.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3600);
  }

  function setInlineFeedback(el, message, type = 'error') {
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'inline-feedback';
      return;
    }
    el.hidden = false;
    el.textContent = message;
    el.className = `inline-feedback ${type === 'success' ? 'is-success' : 'is-error'}`;
  }

  async function apiRequest(url, options = {}) {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Request failed with status ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // Navigation
  function switchView(viewName) {
    state.activeView = viewName;
    $$('.view').forEach((section) => {
      section.classList.toggle('is-active', section.id === `view-${viewName}`);
    });
    $$('.nav-link').forEach((link) => {
      link.classList.toggle('is-active', link.dataset.nav === viewName);
    });

    if (viewName === 'admin') {
      loadStudents();
    } else if (viewName === 'faculty') {
      if (state.facultyRoster.length === 0) {
        loadFacultySession();
      }
    } else if (viewName === 'overview') {
      refreshOverviewStats();
    }
  }

  $$('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const target = el.dataset.nav;
      if (target) {
        e.preventDefault();
        switchView(target);
      }
    });
  });

  // Overview stats
  async function refreshOverviewStats() {
    try {
      const students = await apiRequest('/api/students');
      state.students = students;
      $('#overview-student-count').textContent = String(students.length);
      const uniqueCourses = new Set(students.map((s) => s.course));
      $('#overview-course-count').textContent = String(uniqueCourses.size);
    } catch (_err) {
      $('#overview-student-count').textContent = '0';
      $('#overview-course-count').textContent = '0';
    }
  }

  // ==================== ADMIN PORTAL ====================
  async function loadStudents() {
    const tbody = $('#admin-students-tbody');
    const q = $('#admin-search').value.trim();
    const semester = $('#admin-sem-filter').value;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (semester) params.set('semester', semester);

    try {
      const students = await apiRequest(`/api/students?${params.toString()}`);
      state.students = students;
      renderAdminStudents(students);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderAdminStudents(students) {
    const tbody = $('#admin-students-tbody');
    if (!students.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">No matching students found. Add a student on the left or clear your filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = students
      .map(
        (s) => `
      <tr>
        <td><span class="roll-code">${escapeHtml(s.rollNo)}</span></td>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td>${escapeHtml(s.course)}</td>
        <td class="num">${escapeHtml(s.semester)}</td>
        <td>${escapeHtml(s.email)}</td>
        <td class="num">
          <button type="button" class="btn btn-secondary btn-sm view-student-report" data-roll="${escapeHtml(s.rollNo)}">
            View Report
          </button>
        </td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('.view-student-report').forEach((btn) => {
      btn.addEventListener('click', () => {
        const roll = btn.dataset.roll;
        switchView('student');
        $('#lookup-roll').value = roll;
        fetchStudentReport(roll);
      });
    });
  }

  let searchTimer;
  $('#admin-search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadStudents, 180);
  });
  $('#admin-sem-filter').addEventListener('change', loadStudents);
  $('#admin-refresh-btn').addEventListener('click', loadStudents);

  $('#add-student-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const feedback = $('#admin-form-feedback');
    const submitBtn = $('#admin-submit-btn');
    setInlineFeedback(feedback, '');

    const rollNo = $('#stu-roll').value.trim().toUpperCase();
    const name = $('#stu-name').value.trim();
    const course = $('#stu-course').value.trim();
    const semester = Number($('#stu-semester').value);
    const email = $('#stu-email').value.trim();

    if (!rollNo) return setInlineFeedback(feedback, 'Please enter a student roll number.');
    if (name.length < 2) return setInlineFeedback(feedback, 'Please enter the student full name.');
    if (!course) return setInlineFeedback(feedback, 'Please enter a course name.');
    if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
      return setInlineFeedback(feedback, 'Please select a valid semester between 1 and 8.');
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return setInlineFeedback(feedback, 'Please enter a valid university email address.');
    }

    submitBtn.disabled = true;
    try {
      const created = await apiRequest('/api/students', {
        method: 'POST',
        body: JSON.stringify({ rollNo, name, course, semester, email }),
      });
      setInlineFeedback(feedback, `Registered ${created.name} (${created.rollNo}).`, 'success');
      showToast(`Student ${created.rollNo} added`, 'success');
      e.target.reset();
      await loadStudents();
      refreshOverviewStats();
    } catch (err) {
      setInlineFeedback(feedback, err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ==================== FACULTY DESK ====================
  const facSubjectSelect = $('#fac-subject');
  const facCustomSubjectWrap = $('#fac-custom-subject-wrap');
  const facCustomSubjectInput = $('#fac-custom-subject');
  const facDateInput = $('#fac-date');
  const facNameInput = $('#fac-name');

  facDateInput.value = state.currentSession.date;

  facSubjectSelect.addEventListener('change', () => {
    const isCustom = facSubjectSelect.value === '__custom__';
    facCustomSubjectWrap.hidden = !isCustom;
    if (isCustom) {
      facCustomSubjectInput.focus();
    }
  });

  function getSelectedSubject() {
    if (facSubjectSelect.value === '__custom__') {
      return facCustomSubjectInput.value.trim();
    }
    return facSubjectSelect.value;
  }

  async function loadFacultySession() {
    const feedback = $('#faculty-feedback');
    setInlineFeedback(feedback, '');

    const subject = getSelectedSubject();
    const date = facDateInput.value;
    const markedBy = facNameInput.value.trim() || 'Faculty';

    if (!subject) {
      return setInlineFeedback(feedback, 'Please choose or enter a subject name.');
    }
    if (!date) {
      return setInlineFeedback(feedback, 'Please choose a valid lecture date.');
    }

    state.currentSession = { subject, date, markedBy };

    const tbody = $('#faculty-roster-tbody');
    tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">Loading class roster...</td></tr>`;

    try {
      const [students, existingRecords] = await Promise.all([
        apiRequest('/api/students'),
        apiRequest(
          `/api/attendance?subject=${encodeURIComponent(subject)}&date=${encodeURIComponent(date)}`
        ),
      ]);

      state.facultyRoster = students;
      state.facultyExisting.clear();
      state.facultySelections.clear();

      for (const rec of existingRecords) {
        state.facultyExisting.set(rec.studentRollNo, rec);
      }
      for (const stu of students) {
        if (!state.facultyExisting.has(stu.rollNo)) {
          state.facultySelections.set(stu.rollNo, 'Present');
        }
      }

      $('#fac-roster-title').textContent = `${subject} · ${date}`;
      $('#fac-roster-subtitle').textContent = `${students.length} enrolled students · ${existingRecords.length} already marked for this session`;
      $('#fac-bulk-actions').hidden = students.length === 0;

      renderFacultyRoster();
    } catch (err) {
      setInlineFeedback(feedback, err.message, 'error');
      tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderFacultyRoster() {
    const tbody = $('#faculty-roster-tbody');
    const students = state.facultyRoster;

    if (!students.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">No students registered yet. Add students in the Admin Portal first.</td></tr>`;
      return;
    }

    tbody.innerHTML = students
      .map((s) => {
        const existing = state.facultyExisting.get(s.rollNo);
        if (existing) {
          const isPresent = existing.status === 'Present';
          const nextStatus = isPresent ? 'Absent' : 'Present';
          return `
            <tr>
              <td><span class="roll-code">${escapeHtml(s.rollNo)}</span></td>
              <td><strong>${escapeHtml(s.name)}</strong></td>
              <td>${escapeHtml(s.course)} · Sem ${escapeHtml(s.semester)}</td>
              <td>
                <span class="status-label ${isPresent ? 'is-present' : 'is-absent'}">
                  Saved: ${escapeHtml(existing.status)}
                </span>
              </td>
              <td class="num">
                <button
                  type="button"
                  class="btn btn-secondary btn-sm fac-edit-btn"
                  data-id="${escapeHtml(existing._id)}"
                  data-roll="${escapeHtml(s.rollNo)}"
                  data-next="${nextStatus}"
                >
                  Change to ${nextStatus}
                </button>
              </td>
            </tr>`;
        }

        const selected = state.facultySelections.get(s.rollNo) || 'Present';
        return `
          <tr>
            <td><span class="roll-code">${escapeHtml(s.rollNo)}</span></td>
            <td><strong>${escapeHtml(s.name)}</strong></td>
            <td>${escapeHtml(s.course)} · Sem ${escapeHtml(s.semester)}</td>
            <td>
              <span class="status-label is-pending">Unmarked</span>
            </td>
            <td class="num">
              <div class="segmented" role="group" aria-label="Mark attendance for ${escapeHtml(s.name)}">
                <button
                  type="button"
                  class="seg-btn ${selected === 'Present' ? 'is-present' : ''}"
                  data-roll="${escapeHtml(s.rollNo)}"
                  data-status="Present"
                >Present</button>
                <button
                  type="button"
                  class="seg-btn ${selected === 'Absent' ? 'is-absent' : ''}"
                  data-roll="${escapeHtml(s.rollNo)}"
                  data-status="Absent"
                >Absent</button>
              </div>
            </td>
          </tr>`;
      })
      .join('');

    tbody.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.facultySelections.set(btn.dataset.roll, btn.dataset.status);
        renderFacultyRoster();
      });
    });

    tbody.querySelectorAll('.fac-edit-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const rollNo = btn.dataset.roll;
        const nextStatus = btn.dataset.next;
        const markedBy = facNameInput.value.trim() || state.currentSession.markedBy || 'Faculty';
        btn.disabled = true;

        try {
          const updated = await apiRequest(`/api/attendance/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify({ status: nextStatus, markedBy }),
          });
          state.facultyExisting.set(rollNo, updated);
          renderFacultyRoster();
          showToast(`Updated ${rollNo} to ${updated.status}`, 'success');
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false;
        }
      });
    });
  }

  $('#fac-load-btn').addEventListener('click', loadFacultySession);

  $('#fac-mark-all-present').addEventListener('click', () => {
    for (const s of state.facultyRoster) {
      if (!state.facultyExisting.has(s.rollNo)) {
        state.facultySelections.set(s.rollNo, 'Present');
      }
    }
    renderFacultyRoster();
  });

  $('#fac-mark-all-absent').addEventListener('click', () => {
    for (const s of state.facultyRoster) {
      if (!state.facultyExisting.has(s.rollNo)) {
        state.facultySelections.set(s.rollNo, 'Absent');
      }
    }
    renderFacultyRoster();
  });

  $('#fac-submit-btn').addEventListener('click', async () => {
    const feedback = $('#faculty-feedback');
    const submitBtn = $('#fac-submit-btn');
    setInlineFeedback(feedback, '');

    const { subject, date } = state.currentSession;
    const markedBy = facNameInput.value.trim() || 'Faculty';
    const pendingStudents = state.facultyRoster.filter((s) => !state.facultyExisting.has(s.rollNo));

    if (pendingStudents.length === 0) {
      return setInlineFeedback(
        feedback,
        'All students in this session are already marked. Use "Change to ..." on any row to edit an entry.',
        'success'
      );
    }

    submitBtn.disabled = true;
    let markedCount = 0;
    const errors = [];

    for (const stu of pendingStudents) {
      const status = state.facultySelections.get(stu.rollNo) || 'Present';
      try {
        const saved = await apiRequest('/api/attendance', {
          method: 'POST',
          body: JSON.stringify({
            studentRollNo: stu.rollNo,
            subject,
            date,
            status,
            markedBy,
          }),
        });
        state.facultyExisting.set(stu.rollNo, saved);
        state.facultySelections.delete(stu.rollNo);
        markedCount += 1;
      } catch (err) {
        errors.push(`${stu.rollNo}: ${err.message}`);
      }
    }

    submitBtn.disabled = false;
    renderFacultyRoster();
    $('#fac-roster-subtitle').textContent = `${state.facultyRoster.length} enrolled students · ${state.facultyExisting.size} marked for this session`;

    if (errors.length > 0) {
      setInlineFeedback(
        feedback,
        `Saved ${markedCount} entries. ${errors.length} failed: ${errors.join(' | ')}`,
        'error'
      );
    } else {
      setInlineFeedback(
        feedback,
        `Submitted attendance for ${markedCount} students in ${subject} (${date}).`,
        'success'
      );
      showToast(`Attendance saved for ${markedCount} students`, 'success');
    }
  });

  // ==================== STUDENT PORTAL ====================
  async function fetchStudentReport(rollNoInput) {
    const rollNo = String(rollNoInput || '').trim().toUpperCase();
    const feedback = $('#student-feedback');
    const container = $('#student-report-container');
    setInlineFeedback(feedback, '');

    if (!rollNo) {
      container.hidden = true;
      return setInlineFeedback(feedback, 'Please enter a student roll number.');
    }

    try {
      const [summary, subjectRes] = await Promise.all([
        apiRequest(`/api/attendance/${encodeURIComponent(rollNo)}`),
        apiRequest(`/api/attendance/${encodeURIComponent(rollNo)}/subjects`),
      ]);

      renderStudentReport(summary, subjectRes.subjects || []);
      container.hidden = false;
    } catch (err) {
      container.hidden = true;
      setInlineFeedback(feedback, err.message, 'error');
    }
  }

  function renderStudentReport(summary, subjects) {
    const { student, rollNo, total, present, absent, percentage, eligible, records } = summary;

    $('#rep-student-name').textContent = student ? student.name : rollNo;
    $('#rep-student-meta').textContent = student
      ? `${student.rollNo} · ${student.course} · Semester ${student.semester} · ${student.email}`
      : rollNo;

    const flagEl = $('#rep-eligibility-flag');
    if (total === 0) {
      flagEl.textContent = 'No Classes Recorded Yet';
      flagEl.className = 'eligibility-flag';
    } else if (eligible) {
      flagEl.textContent = 'Eligible for Exams (≥ 75%)';
      flagEl.className = 'eligibility-flag is-eligible';
    } else {
      flagEl.textContent = 'Attendance Shortage (< 75%)';
      flagEl.className = 'eligibility-flag is-shortage';
    }

    $('#rep-total').textContent = String(total);
    $('#rep-present').textContent = String(present);
    $('#rep-absent').textContent = String(absent);
    $('#rep-percentage').textContent = `${percentage}%`;
    $('#rep-progress-label').textContent = `${percentage}%`;

    const fill = $('#rep-progress-fill');
    const clampedPct = Math.max(0, Math.min(100, percentage));
    fill.style.width = `${clampedPct}%`;
    fill.className = `progress-fill ${eligible ? 'is-green' : 'is-red'}`;

    const bar = $('#rep-progressbar');
    bar.setAttribute('aria-valuenow', String(percentage));

    $('#rep-progress-note').textContent = eligible
      ? 'Standing meets the 75.0% university attendance requirement.'
      : `Short by ${(75 - percentage).toFixed(2)}% to reach the 75.0% minimum requirement.`;

    const subjBody = $('#rep-subjects-tbody');
    if (!subjects.length) {
      subjBody.innerHTML = `<tr><td colspan="4" class="empty-cell">No subject records logged yet.</td></tr>`;
    } else {
      subjBody.innerHTML = subjects
        .map(
          (sub) => `
        <tr>
          <td><strong>${escapeHtml(sub.subject)}</strong></td>
          <td class="num">${escapeHtml(sub.present)} / ${escapeHtml(sub.total)}</td>
          <td class="num">
            <div class="mini-bar-wrap">
              <div class="mini-bar-track">
                <div class="mini-bar-fill ${sub.eligible ? 'is-green' : 'is-red'}" style="width:${Math.min(100, sub.percentage)}%"></div>
              </div>
              <span>${escapeHtml(sub.percentage)}%</span>
            </div>
          </td>
          <td>
            <span class="status-label ${sub.eligible ? 'is-present' : 'is-absent'}">
              ${sub.eligible ? 'Eligible' : 'Shortage'}
            </span>
          </td>
        </tr>`
        )
        .join('');
    }

    const recBody = $('#rep-records-tbody');
    if (!records.length) {
      recBody.innerHTML = `<tr><td colspan="4" class="empty-cell">No attendance entries recorded yet.</td></tr>`;
    } else {
      recBody.innerHTML = records
        .map(
          (r) => `
        <tr>
          <td class="mono">${escapeHtml(r.date)}</td>
          <td>${escapeHtml(r.subject)}</td>
          <td>
            <span class="status-label ${r.status === 'Present' ? 'is-present' : 'is-absent'}">
              ${escapeHtml(r.status)}
            </span>
          </td>
          <td>${escapeHtml(r.markedBy)}</td>
        </tr>`
        )
        .join('');
    }
  }

  $('#student-lookup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    fetchStudentReport($('#lookup-roll').value);
  });

  $$('.quick-roll-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const roll = btn.dataset.roll;
      $('#lookup-roll').value = roll;
      fetchStudentReport(roll);
    });
  });

  // Initial load
  refreshOverviewStats();
})();

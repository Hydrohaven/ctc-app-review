// CTC Application Reviewer - Main Logic
(function () {
  'use strict';

  // --- Storage Keys ---
  const STORAGE_KEY_APPLICANTS = 'ctc_review_applicants_v2';
  const STORAGE_KEY_DECISIONS = 'ctc_review_decisions';
  const STORAGE_KEY_THEME = 'ctc_review_theme';

  // --- State ---
  let applicants = [];
  let decisions = {}; // { [id]: { verdict: 'interview'|'maybe'|'reject'|null, notes: '', starred: false } }
  let selectedApplicantId = null;
  let filteredApplicants = [];

  // --- DOM Elements ---
  const applicantListEl = document.getElementById('applicantList');
  const emptyStateEl = document.getElementById('emptyState');
  const applicantDetailEl = document.getElementById('applicantDetail');
  const searchInput = document.getElementById('searchInput');
  const verdictFilter = document.getElementById('verdictFilter');
  const standingFilter = document.getElementById('standingFilter');
  const memberFilter = document.getElementById('memberFilter');
  const reviewedCounter = document.getElementById('reviewedCounter');
  const csvFileInput = document.getElementById('csvFileInput');
  const exportBtn = document.getElementById('exportBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  // Detail Elements
  const detailName = document.getElementById('detailName');
  const starBtn = document.getElementById('starBtn');
  const detailReturningBadge = document.getElementById('detailReturningBadge');
  const detailPortfolioBadge = document.getElementById('detailPortfolioBadge');
  const detailMetaRow = document.getElementById('detailMetaRow');
  const detailLinksBar = document.getElementById('detailLinksBar');
  const detailResponses = document.getElementById('detailResponses');
  const reviewerNotesInput = document.getElementById('reviewerNotesInput');
  const notesSaveIndicator = document.getElementById('notesSaveIndicator');
  const verdictButtons = document.querySelectorAll('.btn-verdict');

  // --- Initialization ---
  function init() {
    loadTheme();
    loadDecisions();
    loadApplicants();
    bindEvents();
    renderSidebar();
    if (applicants.length > 0) {
      selectApplicant(applicants[0].id);
    }
  }

  // --- Storage Helpers ---
  function loadTheme() {
    const saved = localStorage.getItem(STORAGE_KEY_THEME) || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEY_THEME, next);
  }

  function loadDecisions() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_DECISIONS);
      decisions = stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.error('Failed to parse saved decisions:', e);
      decisions = {};
    }
  }

  function saveDecisions() {
    localStorage.setItem(STORAGE_KEY_DECISIONS, JSON.stringify(decisions));
    updateReviewedCounter();
  }

  function getDecision(id) {
    if (!decisions[id]) {
      decisions[id] = { verdict: null, notes: '', starred: false };
    }
    return decisions[id];
  }

  function loadApplicants() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_APPLICANTS);
      if (stored) {
        applicants = JSON.parse(stored);
      } else if (window.INITIAL_APPLICANTS && Array.isArray(window.INITIAL_APPLICANTS)) {
        applicants = window.INITIAL_APPLICANTS;
        localStorage.setItem(STORAGE_KEY_APPLICANTS, JSON.stringify(applicants));
      } else {
        applicants = [];
      }
    } catch (e) {
      console.error('Error loading applicants from storage:', e);
      applicants = window.INITIAL_APPLICANTS || [];
    }
    updateReviewedCounter();
  }

  function updateReviewedCounter() {
    const total = applicants.length;
    const reviewed = applicants.filter(a => {
      const d = decisions[a.id];
      return d && d.verdict;
    }).length;
    reviewedCounter.textContent = `${reviewed} / ${total} Reviewed`;
  }

  // --- Filtering & Selection ---
  function getFilteredApplicants() {
    const query = searchInput.value.trim().toLowerCase();
    const verdictVal = verdictFilter.value;
    const standingVal = standingFilter.value;
    const memberVal = memberFilter.value;

    return applicants.filter(app => {
      const dec = getDecision(app.id);

      // Search query filter (matches name, email, major, or answers text)
      if (query) {
        const nameMatch = (app.name || '').toLowerCase().includes(query);
        const emailMatch = (app.email || '').toLowerCase().includes(query);
        const majorMatch = (app.major || '').toLowerCase().includes(query);
        const essayMatch = (app.answers || []).some(a => (a.answer || '').toLowerCase().includes(query));
        if (!nameMatch && !emailMatch && !majorMatch && !essayMatch) return false;
      }

      // Verdict filter
      if (verdictVal === 'unreviewed' && dec.verdict) return false;
      if (verdictVal === 'interview' && dec.verdict !== 'interview') return false;
      if (verdictVal === 'maybe' && dec.verdict !== 'maybe') return false;
      if (verdictVal === 'reject' && dec.verdict !== 'reject') return false;
      if (verdictVal === 'starred' && !dec.starred) return false;

      // Standing / Year filter
      if (standingVal !== 'all' && !(app.standing || '').toLowerCase().includes(standingVal.toLowerCase())) {
        return false;
      }

      // Member filter
      if (memberVal === 'returning' && !app.isReturning) return false;
      if (memberVal === 'new' && app.isReturning) return false;

      return true;
    });
  }

  // --- Render Sidebar List ---
  function renderSidebar() {
    filteredApplicants = getFilteredApplicants();
    applicantListEl.innerHTML = '';

    if (filteredApplicants.length === 0) {
      applicantListEl.innerHTML = `
        <div style="padding: 30px 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
          No matching applicants found.
        </div>
      `;
      return;
    }

    filteredApplicants.forEach(app => {
      const dec = getDecision(app.id);
      const card = document.createElement('div');
      card.className = `applicant-card ${app.id === selectedApplicantId ? 'active' : ''}`;
      card.dataset.id = app.id;

      // Verdict pill
      let pillText = 'Unreviewed';
      let pillClass = 'pill-unreviewed';
      if (dec.verdict === 'interview') {
        pillText = 'Interview';
        pillClass = 'pill-interview';
      } else if (dec.verdict === 'maybe') {
        pillText = 'Maybe';
        pillClass = 'pill-maybe';
      } else if (dec.verdict === 'reject') {
        pillText = 'Pass';
        pillClass = 'pill-reject';
      }

      card.innerHTML = `
        <div class="card-top">
          <span class="card-name">
            ${dec.starred ? '<span class="card-star">★</span>' : ''}
            ${escapeHtml(app.name || 'Unnamed')}
          </span>
          <span class="card-pill ${pillClass}">${pillText}</span>
        </div>
        <div class="card-meta">
          <span>${escapeHtml(app.standing || '')} Year</span>
          <span>&bull;</span>
          <span>${escapeHtml(app.major || '')}</span>
        </div>
        <div class="card-tags">
          ${app.isReturning ? '<span class="tag-badge">Returning</span>' : ''}
          ${app.hasPortfolio ? '<span class="tag-badge">Portfolio</span>' : ''}
          ${dec.notes ? '<span class="tag-badge">📝 Notes</span>' : ''}
        </div>
      `;

      card.addEventListener('click', () => selectApplicant(app.id));
      applicantListEl.appendChild(card);
    });

    const activeCard = applicantListEl.querySelector('.applicant-card.active');
    if (activeCard) {
      activeCard.scrollIntoView({ block: 'nearest' });
    }
  }

  // --- Select Applicant & Render Detail ---
  function selectApplicant(id) {
    selectedApplicantId = id;
    const app = applicants.find(a => a.id === id);

    if (!app) {
      emptyStateEl.classList.remove('hidden');
      applicantDetailEl.classList.add('hidden');
      return;
    }

    emptyStateEl.classList.add('hidden');
    applicantDetailEl.classList.remove('hidden');

    const dec = getDecision(app.id);

    // Update active state in list
    document.querySelectorAll('.applicant-card').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });

    // Populate Header
    detailName.textContent = app.name || 'Unnamed Applicant';
    starBtn.classList.toggle('starred', !!dec.starred);
    detailReturningBadge.style.display = app.isReturning ? 'inline-block' : 'none';
    detailPortfolioBadge.style.display = app.hasPortfolio ? 'inline-block' : 'none';

    // Metadata items
    detailMetaRow.innerHTML = `
      <span class="meta-item">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        <a href="mailto:${escapeHtml(app.email)}" style="color: inherit; text-decoration: underline;">${escapeHtml(app.email)}</a>
      </span>
      ${app.pronouns ? `<span class="meta-item"><span>Pronouns:</span> <strong>${escapeHtml(app.pronouns)}</strong></span>` : ''}
      <span class="meta-item"><span>Standing:</span> <strong>${escapeHtml(app.standing || 'N/A')} Year</strong></span>
      ${app.gradDate ? `<span class="meta-item"><span>Graduation:</span> <strong>${escapeHtml(app.gradDate)}</strong></span>` : ''}
      <span class="meta-item"><span>Major:</span> <strong>${escapeHtml(app.major || 'Undeclared')}</strong></span>
      ${app.minor ? `<span class="meta-item"><span>Details:</span> <em>${escapeHtml(app.minor)}</em></span>` : ''}
    `;

    // Render Action Links (Resume, Portfolio, LinkedIn)
    renderActionLinks(app);

    // Update Verdict buttons
    verdictButtons.forEach(btn => {
      const v = btn.dataset.verdict;
      btn.classList.toggle('active', v === dec.verdict);
    });

    // Update Reviewer Notes
    reviewerNotesInput.value = dec.notes || '';
    notesSaveIndicator.textContent = 'All changes saved';

    // Render Answers
    renderResponses(app);

    // Scroll reader pane back to top
    document.getElementById('readerPane').scrollTop = 0;
  }

  function getLinkLabel(url) {
    const u = url.toLowerCase();
    if (u.includes('linkedin.com')) return 'LinkedIn';
    if (u.includes('figma.com') || u.includes('figma.site')) return 'Figma Prototype';
    if (u.includes('framer.website') || u.includes('framer.com')) return 'Framer Portfolio';
    if (u.includes('github.com') || u.includes('github.io')) return 'GitHub';
    if (u.includes('devpost.com')) return 'Devpost';
    if (u.includes('canva.link') || u.includes('canva.com')) return 'Canva';
    if (u.includes('drive.google.com') || u.includes('docs.google.com')) return 'Drive Work Folder';
    return 'Portfolio Website';
  }

  function renderActionLinks(app) {
    detailLinksBar.innerHTML = '';

    // 1. Resume Link
    if (app.resumeUrl && app.resumeUrl !== 'x') {
      const a = document.createElement('a');
      a.href = app.resumeUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'link-btn link-btn-accent';
      a.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Open Resume`;
      detailLinksBar.appendChild(a);
    } else {
      const span = document.createElement('span');
      span.className = 'link-btn link-btn-disabled';
      span.innerHTML = `📄 No Resume Link`;
      detailLinksBar.appendChild(span);
    }

    // 2. Portfolio Links
    const pLinks = (app.portfolioLinks && app.portfolioLinks.length > 0) 
      ? app.portfolioLinks 
      : (app.portfolioUrl ? [{ url: app.portfolioUrl, label: getLinkLabel(app.portfolioUrl) }] : []);

    if (pLinks.length > 0) {
      pLinks.forEach(p => {
        const a = document.createElement('a');
        let linkUrl = p.url;
        if (!linkUrl.startsWith('http://') && !linkUrl.startsWith('https://')) {
          linkUrl = 'https://' + linkUrl;
        }
        a.href = linkUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'link-btn link-btn-portfolio';
        a.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="12 8 8 12 12 16 12 8"/><line x1="16" y1="12" x2="12" y2="12"/></svg> ${escapeHtml(p.label || getLinkLabel(p.url))}`;
        detailLinksBar.appendChild(a);
      });
    } else {
      const span = document.createElement('span');
      span.className = 'link-btn link-btn-disabled';
      span.innerHTML = `🎨 No Portfolio Link`;
      detailLinksBar.appendChild(span);
    }

    // 3. LinkedIn Link
    if (app.linkedInUrl && app.linkedInUrl.toLowerCase().includes('linkedin.com')) {
      let formatted = app.linkedInUrl;
      if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
        formatted = 'https://' + formatted;
      }
      const a = document.createElement('a');
      a.href = formatted;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'link-btn link-btn-linkedin';
      a.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg> LinkedIn`;
      detailLinksBar.appendChild(a);
    } else {
      const span = document.createElement('span');
      span.className = 'link-btn link-btn-disabled';
      span.innerHTML = `🔗 No LinkedIn`;
      detailLinksBar.appendChild(span);
    }
  }

  function renderResponses(app) {
    detailResponses.innerHTML = '';

    if (app.portfolioNote) {
      const noteDiv = document.createElement('div');
      noteDiv.className = 'callout-box';
      noteDiv.innerHTML = `<strong>Note on Portfolio/Work Samples:</strong> ${escapeHtml(app.portfolioNote)}`;
      detailResponses.appendChild(noteDiv);
    }

    if (app.additionalNotes) {
      const addDiv = document.createElement('div');
      addDiv.className = 'callout-box';
      addDiv.innerHTML = `<strong>Additional Applicant Note:</strong> ${escapeHtml(app.additionalNotes)}`;
      detailResponses.appendChild(addDiv);
    }

    if (!app.answers || app.answers.length === 0) {
      detailResponses.innerHTML += `<div style="padding: 20px; color: var(--text-muted);">No written responses recorded.</div>`;
      return;
    }

    app.answers.forEach((item, index) => {
      const block = document.createElement('div');
      block.className = 'question-block';
      block.innerHTML = `
        <div class="question-label">Question ${index + 1}</div>
        <div class="question-title">${escapeHtml(item.question || `Prompt ${index + 1}`)}</div>
        <div class="answer-content">${escapeHtml(item.answer || '(No response provided)')}</div>
      `;
      detailResponses.appendChild(block);
    });
  }

  // --- Verdict & Decision Actions ---
  function setVerdict(verdictVal) {
    if (!selectedApplicantId) return;
    const dec = getDecision(selectedApplicantId);
    if (verdictVal === 'clear') {
      dec.verdict = null;
    } else {
      dec.verdict = verdictVal;
    }
    saveDecisions();
    renderSidebar();

    verdictButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.verdict === dec.verdict);
    });
  }

  function toggleStar() {
    if (!selectedApplicantId) return;
    const dec = getDecision(selectedApplicantId);
    dec.starred = !dec.starred;
    saveDecisions();
    starBtn.classList.toggle('starred', dec.starred);
    renderSidebar();
  }

  // --- Navigation Helpers ---
  function navigateApplicant(direction) {
    if (filteredApplicants.length === 0) return;
    const currentIndex = filteredApplicants.findIndex(a => a.id === selectedApplicantId);
    let nextIndex = currentIndex + direction;

    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= filteredApplicants.length) nextIndex = filteredApplicants.length - 1;

    if (nextIndex !== currentIndex) {
      selectApplicant(filteredApplicants[nextIndex].id);
    }
  }

  // --- CSV Parser with Smart Link & Header Detection ---
  function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        if (currentRow.some(val => val.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(val => val.length > 0)) {
        rows.push(currentRow);
      }
    }
    return rows;
  }

  function extractUrlsFromText(text) {
    if (!text) return [];
    const urlRegex = /(https?:\/\/[^\s,，;]+|[a-zA-Z0-9-]+\.(?:com|me|site|website|app|art|tech|net|org|io|dev|cloud|cc|ai|xyz|github\.io|framer\.website|figma\.site)[^\s,，;]*|linkedin\.com\/[^\s,，;]+|inkedin\.com\/[^\s,，;]+|github\.com\/[^\s,，;]+)/gi;
    const matches = text.match(urlRegex) || [];
    return matches.map(u => {
      let clean = u.replace(/[，,;)"'\]]+$/, '');
      if (clean.toLowerCase().startsWith('inkedin.com/')) {
        clean = 'https://www.l' + clean;
      } else if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = 'https://' + clean;
      }
      return clean;
    });
  }

  function importCSVContent(csvText) {
    const rawRows = parseCSV(csvText);
    if (rawRows.length < 2) {
      alert('The uploaded CSV file is empty or missing headers.');
      return;
    }

    const headers = rawRows[0];
    const dataRows = rawRows.slice(1);

    // Identify standard columns with flexible fuzzy matching
    const colIndex = {
      name: -1,
      email: -1,
      timestamp: -1,
      pronouns: -1,
      standing: -1,
      gradDate: -1,
      major: -1,
      minor: -1,
      returning: -1,
      resume: -1,
      webDevPrompt: -1,
      workExpCol: -1,
      optionalLinksCol: -1,
      linkedInCol: -1,
      questionIndices: []
    };

    headers.forEach((h, idx) => {
      const hl = h.toLowerCase().trim();

      // Skip internal reviewer columns
      if (hl.includes('reviewer') || hl.startsWith('column 7')) {
        return;
      }
      if (hl === 'column 14') {
        colIndex.minor = idx;
        return;
      }

      if (colIndex.timestamp === -1 && hl.includes('timestamp')) {
        colIndex.timestamp = idx;
      } else if (colIndex.name === -1 && (hl.includes('full name') || hl.includes('applicant name') || (hl.includes('name') && hl.includes('donald')))) {
        colIndex.name = idx;
      } else if (colIndex.email === -1 && (hl.includes('email') || hl.includes('uci email'))) {
        colIndex.email = idx;
      } else if (colIndex.pronouns === -1 && hl.includes('pronoun')) {
        colIndex.pronouns = idx;
      } else if (colIndex.standing === -1 && (hl === 'year' || (hl.includes('standing') && !hl.includes('notstanding')))) {
        colIndex.standing = idx;
      } else if (colIndex.gradDate === -1 && (hl.includes('grad') || hl.includes('graduation'))) {
        colIndex.gradDate = idx;
      } else if (colIndex.major === -1 && (hl === 'major' || hl.includes('major(s)'))) {
        colIndex.major = idx;
      } else if (colIndex.minor === -1 && (hl.includes('minor') || hl.includes('specify'))) {
        colIndex.minor = idx;
      } else if (colIndex.returning === -1 && (hl.includes('returning') || hl.includes('previously been a member'))) {
        colIndex.returning = idx;
      } else if (colIndex.resume === -1 && (hl.includes('resumé') || hl.includes('resume') || hl.includes('cv'))) {
        colIndex.resume = idx;
      } else if (colIndex.linkedInCol === -1 && hl.includes('linkedin')) {
        colIndex.linkedInCol = idx;
      } else if (hl.includes('web development') && hl.includes('previous work')) {
        colIndex.webDevPrompt = idx;
      } else if (hl.includes('technical/coding experience') || hl.includes('technical experience')) {
        colIndex.workExpCol = idx;
      } else if (hl.includes('optional') && (hl.includes('github') || hl.includes('portfolio') || hl.includes('personal website') || hl.includes('materials that showcase'))) {
        colIndex.optionalLinksCol = idx;
      } else if (hl.includes('fee') || hl.includes('$10')) {
        // Ignored membership fee acknowledgment
      } else {
        colIndex.questionIndices.push({ index: idx, question: h });
      }
    });

    // Fallbacks if headers weren't named descriptively
    if (colIndex.name === -1 && headers.length > 7) colIndex.name = 7;
    if (colIndex.email === -1 && headers.length > 8) colIndex.email = 8;
    if (colIndex.workExpCol === -1 && headers.length > 26) colIndex.workExpCol = 26;
    if (colIndex.optionalLinksCol === -1 && headers.length > 27) colIndex.optionalLinksCol = 27;

    const parsedApplicants = dataRows.map((row, rIdx) => {
      const getVal = (idx) => (idx >= 0 && row[idx] ? row[idx].trim() : '');

      const isReturning = getVal(colIndex.returning).toLowerCase().includes('yes');
      const resumeUrl = getVal(colIndex.resume);

      // Collect all candidate text sources for URLs
      const textPool = [];
      if (colIndex.workExpCol >= 0) textPool.push(getVal(colIndex.workExpCol));
      if (colIndex.optionalLinksCol >= 0) textPool.push(getVal(colIndex.optionalLinksCol));
      if (colIndex.linkedInCol >= 0) textPool.push(getVal(colIndex.linkedInCol));

      // Scan all cells in this row for any missed links (like in the last column, or in text boxes)
      row.forEach((cellVal, cIdx) => {
        if (cIdx <= 5 || cIdx === colIndex.resume) return; // Skip internal reviewer columns
        if (cellVal && (cellVal.toLowerCase().includes('linkedin.com') || cellVal.toLowerCase().includes('inkedin.com') || cellVal.toLowerCase().includes('github.com'))) {
          textPool.push(cellVal);
        }
      });

      const allExtractedUrls = [];
      textPool.forEach(txt => {
        extractUrlsFromText(txt).forEach(u => {
          if (!allExtractedUrls.includes(u)) allExtractedUrls.push(u);
        });
      });

      let linkedInUrl = '';
      const portfolioLinks = [];

      allExtractedUrls.forEach(url => {
        const uLower = url.toLowerCase();
        if (uLower.includes('linkedin.com')) {
          if (!linkedInUrl) linkedInUrl = url;
        } else if (url !== resumeUrl && !portfolioLinks.some(p => p.url === url)) {
          portfolioLinks.push({
            url: url,
            label: getLinkLabel(url)
          });
        }
      });

      // Also check if dedicated linkedInCol had raw text without url scheme
      if (!linkedInUrl && colIndex.linkedInCol >= 0) {
        const rawL = getVal(colIndex.linkedInCol);
        if (rawL && (rawL.includes('linkedin.com') || rawL.includes('inkedin.com'))) {
          linkedInUrl = rawL.startsWith('http') ? rawL : 'https://' + rawL.replace(/^www\./, '');
        }
      }

      // If no portfolio link was found in workExpCol, check if it had a text note
      let portfolioNote = '';
      const workVal = getVal(colIndex.workExpCol);
      if (workVal && !workVal.startsWith('http') && !workVal.includes('.com') && !workVal.includes('.site') && !workVal.includes('.app')) {
        portfolioNote = workVal;
      }

      const answers = [];
      colIndex.questionIndices.forEach(q => {
        const val = getVal(q.index);
        if (val) {
          answers.push({
            question: q.question,
            answer: val
          });
        }
      });

      return {
        id: `csv-app-${Date.now()}-${rIdx}`,
        timestamp: getVal(colIndex.timestamp),
        name: getVal(colIndex.name) || `Applicant #${rIdx + 1}`,
        email: getVal(colIndex.email),
        pronouns: getVal(colIndex.pronouns),
        standing: getVal(colIndex.standing),
        gradDate: getVal(colIndex.gradDate),
        major: getVal(colIndex.major),
        minor: getVal(colIndex.minor),
        isReturning: isReturning,
        resumeUrl: resumeUrl,
        portfolioLinks: portfolioLinks,
        portfolioUrl: portfolioLinks.length > 0 ? portfolioLinks[0].url : '',
        hasPortfolio: portfolioLinks.length > 0 || getVal(colIndex.webDevPrompt).toLowerCase().includes('yes'),
        portfolioNote: portfolioNote,
        linkedInUrl: linkedInUrl,
        additionalNotes: '',
        answers: answers
      };
    });

    applicants = parsedApplicants.filter(a => a.name && a.name.trim() !== '');
    localStorage.setItem(STORAGE_KEY_APPLICANTS, JSON.stringify(applicants));
    renderSidebar();
    if (applicants.length > 0) {
      selectApplicant(applicants[0].id);
    }
    updateReviewedCounter();
    alert(`Successfully loaded ${applicants.length} applications with verified Resumes, Portfolios, and LinkedIn profiles!`);
  }

  // --- Export Decisions ---
  function exportDecisions() {
    if (applicants.length === 0) {
      alert('No applicants to export.');
      return;
    }

    const headers = [
      'Name',
      'Email',
      'Standing',
      'Major',
      'Returning Member',
      'Verdict',
      'Starred',
      'Reviewer Notes',
      'Resume URL',
      'Portfolio URL',
      'LinkedIn URL'
    ];

    const escapeCsv = (str) => {
      const clean = (str || '').replace(/"/g, '""');
      return `"${clean}"`;
    };

    const lines = [headers.join(',')];

    applicants.forEach(app => {
      const dec = getDecision(app.id);
      const portUrl = app.portfolioLinks && app.portfolioLinks.length > 0 
        ? app.portfolioLinks.map(p => p.url).join('; ')
        : (app.portfolioUrl || '');

      const row = [
        escapeCsv(app.name),
        escapeCsv(app.email),
        escapeCsv(app.standing),
        escapeCsv(app.major),
        escapeCsv(app.isReturning ? 'Yes' : 'No'),
        escapeCsv(dec.verdict ? dec.verdict.toUpperCase() : 'UNREVIEWED'),
        escapeCsv(dec.starred ? 'Yes' : 'No'),
        escapeCsv(dec.notes),
        escapeCsv(app.resumeUrl),
        escapeCsv(portUrl),
        escapeCsv(app.linkedInUrl)
      ];
      lines.push(row.join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CTC_Application_Decisions_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // --- Event Bindings ---
  function bindEvents() {
    themeToggleBtn.addEventListener('click', toggleTheme);

    searchInput.addEventListener('input', renderSidebar);
    verdictFilter.addEventListener('change', renderSidebar);
    standingFilter.addEventListener('change', renderSidebar);
    memberFilter.addEventListener('change', renderSidebar);

    starBtn.addEventListener('click', toggleStar);

    verdictButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.verdict;
        setVerdict(v);
      });
    });

    let saveTimeout = null;
    reviewerNotesInput.addEventListener('input', () => {
      if (!selectedApplicantId) return;
      notesSaveIndicator.textContent = 'Saving...';
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        const dec = getDecision(selectedApplicantId);
        dec.notes = reviewerNotesInput.value;
        saveDecisions();
        notesSaveIndicator.textContent = 'All changes saved';
        renderSidebar();
      }, 350);
    });

    csvFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        importCSVContent(event.target.result);
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    exportBtn.addEventListener('click', exportDecisions);

    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName : '';
      const isInputActive = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

      if (e.key === '/' && !isInputActive) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
        return;
      }

      if (e.key === 'Escape') {
        if (isInputActive) {
          document.activeElement.blur();
        }
        return;
      }

      if (isInputActive) return;

      if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown') {
        e.preventDefault();
        navigateApplicant(1);
      } else if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp') {
        e.preventDefault();
        navigateApplicant(-1);
      } else if (e.key === '1') {
        setVerdict('interview');
      } else if (e.key === '2') {
        setVerdict('maybe');
      } else if (e.key === '3') {
        setVerdict('reject');
      } else if (e.key === '4') {
        setVerdict('clear');
      } else if (e.key === 's' || e.key === 'S') {
        toggleStar();
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  document.addEventListener('DOMContentLoaded', init);
})();

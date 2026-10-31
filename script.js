/**
 * ============================================================================
 * TypeKey – Typing Practice & Skill Assessment
 * Pure Vanilla JavaScript Implementation
 * 
 * Key Features:
 * - Real-time WPM, Accuracy, and Streak calculations
 * - Multi-difficulty passage library (Easy, Medium, Hard)
 * - Dynamic Weak-Key detection and automated drill generator
 * - Dual training modes: Speed Mode vs Accuracy Mode
 * - 100% Client-Side with LocalStorage persistence
 * ============================================================================
 */

// ============================================================================
// 1. TYPING PASSAGES REPOSITORY (Grouped by Difficulty)
// ============================================================================
const PASSAGES = {
  easy: [
    "The quick brown fox jumps over the lazy dog. Practice makes typing easy and smooth every single day.",
    "Sunlight filtered through the green leaves of the tall oak trees in the quiet park on a warm spring morning.",
    "Learning to type fast requires patience, good posture, and resting your fingers gently on the home row keys.",
    "Water flows down the gentle river while birds sing sweet songs in the bright blue morning sky above.",
    "Keep your eyes on the screen and trust your muscle memory as you type each simple word with care."
  ],
  medium: [
    "Computer programming is not just about writing code; it is the art of solving complex logical puzzles with clarity.",
    "Regular typing practice trains neural pathways in your brain, turning hesitant keystrokes into fluid, instinctive muscle memory.",
    "Modern web applications often combine responsive design, client-side interactivity, and persistent local data storage.",
    "Discipline and deliberate practice always outperform natural talent when mastering any technical keyboard skill.",
    "The keyboard layout known as QWERTY was designed in the nineteenth century for early mechanical typewriters."
  ],
  hard: [
    "function calculateWpm(chars, minutes) { return minutes > 0 ? Math.round((chars / 5) / minutes) : 0; }",
    "In 2026, developers utilize strict types: const [val, setVal] = useState<number | null>(404); // status: OK!",
    "System error: [Code #503] Unable to establish socket connection on port 8080; check firewall & DNS settings.",
    "Regex query pattern: ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,4}$ tested against 1,024 user strings.",
    "Matrix dimensions: A(m x k) * B(k x n) = C(m x n); total operations = O(n^3) under naive matrix multiplication!"
  ]
};

// ============================================================================
// 2. STATE MANAGEMENT & LOCAL STORAGE HELPERS
// ============================================================================
const STORAGE_KEYS = {
  STATS: "typekey_lifetime_stats",
  MISTAKES: "typekey_mistakes_map",
  USERS: "typekey_registered_users",
  CURRENT_USER: "typekey_auth_user"
};

// Application State
const state = {
  // Navigation & Config
  activeSection: "home",
  activeMode: "speed", // 'speed' | 'accuracy'
  activeDifficulty: "easy", // 'easy' | 'medium' | 'hard' | 'weakkeys'
  
  // Active Test Session
  targetText: "",
  currentIndex: 0,
  charStatuses: [], // 'untyped' | 'correct' | 'incorrect'
  
  // Timing & Live Engine State
  isTestRunning: false,
  isTestFinished: false,
  startTime: null,
  timerInterval: null,
  elapsedSeconds: 0,
  
  // Keystrokes & Metrics
  totalCorrectChars: 0,
  totalIncorrectChars: 0,
  totalTypedChars: 0,
  currentStreak: 0,
  bestStreakInTest: 0,
  
  // Mistake Tracker for current session (char -> count)
  currentSessionMistakes: {}
};

// ============================================================================
// 3. LOCAL STORAGE ACCESSORS
// ============================================================================

/**
 * Retrieves lifetime statistics from localStorage.
 * Initializes default structure if not found.
 */
function getStoredStats() {
  const fallback = {
    testsCompleted: 0,
    bestWpm: 0,
    bestAccuracy: 0,
    bestStreak: 0
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STATS);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn("LocalStorage access failed:", e);
    return fallback;
  }
}

/**
 * Saves lifetime statistics into localStorage.
 */
function saveStoredStats(stats) {
  try {
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  } catch (e) {
    console.warn("Failed to save stats to LocalStorage:", e);
  }
}

/**
 * Retrieves the cumulative mistake frequency map: { 'q': 4, 'p': 2, ... }
 */
function getStoredMistakes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MISTAKES);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn("LocalStorage access failed:", e);
    return {};
  }
}

/**
 * Saves updated mistakes map into localStorage.
 */
function saveStoredMistakes(map) {
  try {
    localStorage.setItem(STORAGE_KEYS.MISTAKES, JSON.stringify(map));
  } catch (e) {
    console.warn("Failed to save mistakes to LocalStorage:", e);
  }
}

// ============================================================================
// 4. CORE MATHEMATICAL CALCULATIONS (WPM & ACCURACY)
// ============================================================================

/**
 * Calculates Words Per Minute (WPM) using standard typing formula:
 * WPM = (correct characters / 5) / elapsed time in minutes
 * Handles division by zero safely.
 * 
 * @param {number} correctChars Number of correctly typed characters
 * @param {number} seconds Elapsed time in seconds
 * @returns {number} Computed WPM rounded to nearest integer
 */
function calculateWPM(correctChars, seconds) {
  if (seconds <= 0 || correctChars <= 0) return 0;
  const minutes = seconds / 60;
  const words = correctChars / 5;
  const rawWpm = words / minutes;
  return Math.max(0, Math.round(rawWpm));
}

/**
 * Calculates typing accuracy percentage:
 * Accuracy = (correct characters / total typed characters) * 100
 * Handles zero typed characters safely by returning 100%.
 * 
 * @param {number} correctChars
 * @param {number} totalTyped
 * @returns {number} Accuracy percentage (0 - 100)
 */
function calculateAccuracy(correctChars, totalTyped) {
  if (totalTyped <= 0) return 100;
  const rawAcc = (correctChars / totalTyped) * 100;
  // Bound strictly between 0 and 100
  return Math.min(100, Math.max(0, Math.round(rawAcc)));
}

/**
 * Calculates a unified overall score combining speed and accuracy:
 * Score = Math.round(WPM * (Accuracy / 100))
 */
function calculateScore(wpm, accuracy) {
  return Math.round(wpm * (accuracy / 100));
}

/**
 * Evaluates skill level tier based on performance metrics.
 */
function getPerformanceLevel(wpm, accuracy) {
  if (wpm >= 60 && accuracy >= 95) return "Advanced";
  if (wpm >= 35 && accuracy >= 88) return "Intermediate";
  return "Beginner";
}

/**
 * Provides an encouraging motivational assessment message.
 */
function getPerformanceMessage(wpm, accuracy) {
  if (accuracy >= 98 && wpm >= 55) {
    return "Outstanding! Elite speed with pinpoint precision!";
  }
  if (wpm >= 50 && accuracy >= 90) {
    return "Great job! Excellent momentum and speed!";
  }
  if (accuracy >= 95) {
    return "Great accuracy! Keep typing to unlock higher speed.";
  }
  if (wpm >= 35) {
    return "Good progress! Focus on steady rhythm to reduce mistakes.";
  }
  return "Keep practicing! Take your time and build muscle memory.";
}

// ============================================================================
// 5. DOM ELEMENTS CACHE
// ============================================================================
const DOM = {
  // Navigation
  navLinks: document.querySelectorAll(".nav-link"),
  sections: document.querySelectorAll(".section"),
  mobileMenuBtn: document.getElementById("mobile-menu-btn"),
  navMenu: document.getElementById("nav-menu"),
  brandLink: document.getElementById("brand-link"),
  quickStartBtn: document.getElementById("quick-start-btn"),
  heroStartBtn: document.getElementById("hero-start-btn"),
  heroWeakKeysBtn: document.getElementById("hero-weak-keys-btn"),

  // Lifetime Dashboard Stats
  dashBestWpm: document.getElementById("dash-best-wpm"),
  dashBestAcc: document.getElementById("dash-best-acc"),
  dashBestStreak: document.getElementById("dash-best-streak"),
  dashTestsDone: document.getElementById("dash-tests-done"),

  // Test Controls & Modes
  modePills: document.querySelectorAll("#mode-selector .pill-btn"),
  diffPills: document.querySelectorAll("#diff-selector .pill-btn"),
  weakPill: document.getElementById("weak-pill"),
  newTextBtn: document.getElementById("new-text-btn"),
  restartTestBtn: document.getElementById("restart-test-btn"),
  finishTestBtn: document.getElementById("finish-test-btn"),
  modeBannerInfo: document.getElementById("mode-banner-info"),
  liveMetricsBar: document.getElementById("live-metrics-bar"),

  // Live Metrics
  liveWpm: document.getElementById("live-wpm"),
  liveAccuracy: document.getElementById("live-accuracy"),
  liveTimer: document.getElementById("live-timer"),
  liveStreak: document.getElementById("live-streak"),
  liveCorrect: document.getElementById("live-correct"),
  liveIncorrect: document.getElementById("live-incorrect"),

  // Typing Arena
  typingArena: document.getElementById("typing-arena"),
  targetTextContainer: document.getElementById("target-text-container"),
  targetText: document.getElementById("target-text"),
  hiddenInput: document.getElementById("hidden-typing-input"),
  passageDifficultyBadge: document.getElementById("passage-difficulty-badge"),
  passageProgress: document.getElementById("passage-progress"),

  // Results Modal
  resultsModal: document.getElementById("results-modal"),
  resultLevelBadge: document.getElementById("result-level-badge"),
  resultMessage: document.getElementById("result-message"),
  resWpm: document.getElementById("res-wpm"),
  resAccuracy: document.getElementById("res-accuracy"),
  resScore: document.getElementById("res-score"),
  resTime: document.getElementById("res-time"),
  resCorrect: document.getElementById("res-correct"),
  resIncorrect: document.getElementById("res-incorrect"),
  resStreak: document.getElementById("res-streak"),
  resDifficulty: document.getElementById("res-difficulty"),
  resMode: document.getElementById("res-mode"),
  resWeakAlert: document.getElementById("res-weak-alert"),
  resWeakTags: document.getElementById("res-weak-tags"),
  resTryAgainBtn: document.getElementById("res-try-again-btn"),
  resNextPassageBtn: document.getElementById("res-next-passage-btn"),
  resPracticeWeakBtn: document.getElementById("res-practice-weak-btn"),

  // Weak Key Trainer Section
  weakEmptyState: document.getElementById("weak-empty-state"),
  weakActiveState: document.getElementById("weak-active-state"),
  weakKeyChipsContainer: document.getElementById("weak-key-chips-container"),
  drillPreviewSample: document.getElementById("drill-preview-sample"),
  startWeakDrillBtn: document.getElementById("start-weak-drill-btn"),
  clearWeakDataBtn: document.getElementById("clear-weak-data-btn"),
  weakGoTestBtn: document.getElementById("weak-go-test-btn"),

  // Mode Selection Page Action Buttons
  selectSpeedModeBtn: document.getElementById("select-speed-mode-btn"),
  selectAccuracyModeBtn: document.getElementById("select-accuracy-mode-btn"),

  // Auth & Profile Elements
  navAuthLink: document.getElementById("nav-auth-link"),
  headerUserStatus: document.getElementById("header-user-status"),
  headerUserEmail: document.getElementById("header-user-email"),
  headerLogoutBtn: document.getElementById("header-logout-btn"),
  headerLoginBtn: document.getElementById("header-login-btn"),
  authTabLogin: document.getElementById("tab-login"),
  authTabSignup: document.getElementById("tab-signup"),
  authForm: document.getElementById("auth-form"),
  authFormTitle: document.getElementById("auth-form-title"),
  authFormSubtitle: document.getElementById("auth-form-subtitle"),
  authAlert: document.getElementById("auth-alert"),
  authEmailInput: document.getElementById("auth-email-input"),
  authPasswordInput: document.getElementById("auth-password-input"),
  authConfirmPasswordInput: document.getElementById("auth-confirm-password-input"),
  confirmPasswordGroup: document.getElementById("confirm-password-group"),
  authSubmitBtn: document.getElementById("auth-submit-btn"),
  authGuestBtn: document.getElementById("auth-guest-btn"),
  authLoggedInBox: document.getElementById("auth-logged-in-box"),
  authCurrentEmail: document.getElementById("auth-current-email"),
  authGoPracticeBtn: document.getElementById("auth-go-practice-btn"),
  authLogoutBtn: document.getElementById("auth-logout-btn"),

  // Screen Recorder Elements
  startRecordBtn: document.getElementById("start-record-btn"),
  stopRecordBtn: document.getElementById("stop-record-btn"),
  recordingStatusPill: document.getElementById("recording-status-pill"),
  recordingTimer: document.getElementById("recording-timer"),
  recordingsCountBadge: document.getElementById("recordings-count-badge"),
  noRecordingsMsg: document.getElementById("no-recordings-msg"),
  recordingsList: document.getElementById("recordings-list"),
  videoModal: document.getElementById("video-modal"),
  videoModalTitle: document.getElementById("video-modal-title"),
  videoModalSubtitle: document.getElementById("video-modal-subtitle"),
  playbackVideo: document.getElementById("playback-video"),
  videoDownloadBtn: document.getElementById("video-download-btn"),
  closeVideoModalBtn: document.getElementById("close-video-modal-btn"),

  // Footer Actions
  footerResetAll: document.getElementById("footer-reset-all")
};

// ============================================================================
// 6. TYPING TEST ENGINE
// ============================================================================

/**
 * Picks a random passage or generates weak key practice.
 */
function getNextPassage(difficulty) {
  if (difficulty === "weakkeys") {
    return generateWeakKeyPassage();
  }
  const list = PASSAGES[difficulty] || PASSAGES.easy;
  const randomIndex = Math.floor(Math.random() * list.length);
  return list[randomIndex];
}

/**
 * Initializes and resets the typing arena with a given text.
 */
function initTest(passageText = null) {
  // Clear any active timer
  clearInterval(state.timerInterval);
  state.timerInterval = null;

  // Determine target text
  if (!passageText) {
    state.targetText = getNextPassage(state.activeDifficulty);
  } else {
    state.targetText = passageText;
  }

  // Reset session counters
  state.currentIndex = 0;
  state.charStatuses = new Array(state.targetText.length).fill("untyped");
  state.isTestRunning = false;
  state.isTestFinished = false;
  state.startTime = null;
  state.elapsedSeconds = 0;
  state.totalCorrectChars = 0;
  state.totalIncorrectChars = 0;
  state.totalTypedChars = 0;
  state.currentStreak = 0;
  state.bestStreakInTest = 0;
  state.currentSessionMistakes = {};

  // Close results modal if open
  DOM.resultsModal.style.display = "none";

  // Render characters in DOM
  renderTargetText();

  // Reset live stats bar
  updateLiveMetricsDisplay();

  // Update header badges
  updatePassageInfoBadge();

  // Focus input
  focusTypingArena();
}

/**
 * Renders the target text into individual <span> elements for character-level feedback.
 */
function renderTargetText() {
  DOM.targetText.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < state.targetText.length; i++) {
    const span = document.createElement("span");
    span.className = "char";
    span.dataset.index = i;

    // Handle space display
    const char = state.targetText[i];
    span.textContent = char;

    if (i === 0) {
      span.classList.add("char-current");
    }

    fragment.appendChild(span);
  }

  DOM.targetText.appendChild(fragment);
  updatePassageCounter();
}

/**
 * Formats seconds into mm:ss display string.
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const pad = (n) => (n < 10 ? "0" + n : n);
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Starts the live timer on the first user keystroke.
 */
function startLiveTimer() {
  if (state.isTestRunning) return;
  state.isTestRunning = true;
  state.startTime = Date.now();

  state.timerInterval = setInterval(() => {
    state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
    DOM.liveTimer.textContent = formatTime(state.elapsedSeconds);

    // Continuous WPM recalculation
    const wpm = calculateWPM(state.totalCorrectChars, state.elapsedSeconds);
    DOM.liveWpm.textContent = wpm;
  }, 1000);
}

/**
 * Updates the live stats bar during active typing.
 */
function updateLiveMetricsDisplay() {
  const wpm = calculateWPM(state.totalCorrectChars, state.elapsedSeconds);
  const acc = calculateAccuracy(state.totalCorrectChars, state.totalTypedChars);

  DOM.liveWpm.textContent = wpm;
  DOM.liveAccuracy.textContent = `${acc}%`;
  DOM.liveTimer.textContent = formatTime(state.elapsedSeconds);
  DOM.liveStreak.textContent = state.currentStreak;
  DOM.liveCorrect.textContent = state.totalCorrectChars;
  DOM.liveIncorrect.textContent = state.totalIncorrectChars;

  updatePassageCounter();
}

/**
 * Updates the characters progress label (e.g. 15 / 120).
 */
function updatePassageCounter() {
  DOM.passageProgress.textContent = `${state.currentIndex} / ${state.targetText.length} characters`;
}

/**
 * Updates the difficulty badge on top of the arena.
 */
function updatePassageInfoBadge() {
  const map = {
    easy: "Easy Passage",
    medium: "Medium Passage",
    hard: "Hard Passage",
    weakkeys: "Weak Key Drill"
  };
  DOM.passageDifficultyBadge.textContent = map[state.activeDifficulty] || "Custom Passage";
  DOM.passageDifficultyBadge.className = "badge";
  if (state.activeDifficulty === "weakkeys") {
    DOM.passageDifficultyBadge.classList.add("badge-indigo");
  }
}

/**
 * Core Keystroke Handler: processes Backspace and typed characters.
 */
function handleKeystroke(e) {
  // If test is already finished, ignore input
  if (state.isTestFinished) return;

  const key = e.key;

  // Ignore navigation & modifier keys (Shift, Alt, Ctrl, etc.)
  if (
    key === "Shift" ||
    key === "Control" ||
    key === "Alt" ||
    key === "Meta" ||
    key === "CapsLock" ||
    key === "Tab" ||
    key === "Escape" ||
    key.startsWith("Arrow") ||
    key.startsWith("F")
  ) {
    return;
  }

  // Prevent browser default scrolling when typing space
  if (key === " ") {
    e.preventDefault();
  }

  // 1. Handle Backspace (Allow correcting mistakes)
  if (key === "Backspace") {
    e.preventDefault();
    if (state.currentIndex > 0) {
      // Step back one character
      state.currentIndex--;
      const prevStatus = state.charStatuses[state.currentIndex];

      // Update counters based on what we are reverting
      if (prevStatus === "correct") {
        state.totalCorrectChars = Math.max(0, state.totalCorrectChars - 1);
        // Streak is reduced
        state.currentStreak = Math.max(0, state.currentStreak - 1);
      } else if (prevStatus === "incorrect") {
        state.totalIncorrectChars = Math.max(0, state.totalIncorrectChars - 1);
      }

      state.totalTypedChars = Math.max(0, state.totalTypedChars - 1);
      state.charStatuses[state.currentIndex] = "untyped";

      // Refresh character visual classes
      syncCharClasses();
      updateLiveMetricsDisplay();
    }
    return;
  }

  // Only accept single printable characters
  if (key.length !== 1) {
    return;
  }

  // First keystroke: automatically initiate live timer
  if (!state.isTestRunning) {
    startLiveTimer();
  }

  const expectedChar = state.targetText[state.currentIndex];
  state.totalTypedChars++;

  // 2. Validate typed character against expected target
  if (key === expectedChar) {
    // CORRECT KEYSTROKE
    state.charStatuses[state.currentIndex] = "correct";
    state.totalCorrectChars++;
    state.currentStreak++;

    // Track best streak in this session
    if (state.currentStreak > state.bestStreakInTest) {
      state.bestStreakInTest = state.currentStreak;
    }
  } else {
    // INCORRECT KEYSTROKE
    state.charStatuses[state.currentIndex] = "incorrect";
    state.totalIncorrectChars++;

    // Streak resets to 0 immediately on error!
    state.currentStreak = 0;

    // Record mistake for expected character (used for weak key trainer)
    const normalizedKey = expectedChar.toLowerCase();
    state.currentSessionMistakes[normalizedKey] =
      (state.currentSessionMistakes[normalizedKey] || 0) + 1;
  }

  // Clear hidden input buffer
  if (DOM.hiddenInput) {
    DOM.hiddenInput.value = "";
  }

  // Move cursor forward
  state.currentIndex++;

  // Synchronize character span classes
  syncCharClasses();

  // Update live statistics
  updateLiveMetricsDisplay();

  // Check if test completed
  if (state.currentIndex >= state.targetText.length) {
    finishTest();
  }
}

/**
 * Synchronizes DOM classes (.char-correct, .char-incorrect, .char-current)
 * with internal state and auto-scrolls to keep cursor visible.
 */
function syncCharClasses() {
  const spans = DOM.targetText.children;
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const status = state.charStatuses[i];

    span.className = "char";

    if (status === "correct") {
      span.classList.add("char-correct");
    } else if (status === "incorrect") {
      span.classList.add("char-incorrect");
    }

    if (i === state.currentIndex) {
      span.classList.add("char-current");

      // Auto-scroll passage container smoothly if cursor moves off-view
      const containerRect = DOM.targetTextContainer.getBoundingClientRect();
      const spanRect = span.getBoundingClientRect();

      if (spanRect.bottom > containerRect.bottom - 20) {
        DOM.targetTextContainer.scrollTop += (spanRect.bottom - containerRect.bottom + 40);
      } else if (spanRect.top < containerRect.top + 20) {
        DOM.targetTextContainer.scrollTop -= (containerRect.top - spanRect.top + 40);
      }
    }
  }
}

/**
 * Completes the typing test, stops timer, calculates final score,
 * updates lifetime storage, and presents the results dialog.
 */
function finishTest() {
  if (state.isTestFinished) return;
  state.isTestFinished = true;

  // Stop timer
  clearInterval(state.timerInterval);
  state.timerInterval = null;

  // Calculate final elapsed time (ensure at least 1 second if characters were typed)
  if (state.startTime) {
    state.elapsedSeconds = Math.max(1, Math.floor((Date.now() - state.startTime) / 1000));
  } else {
    state.elapsedSeconds = 0;
  }

  // Calculate final metrics
  const finalWpm = calculateWPM(state.totalCorrectChars, state.elapsedSeconds);
  const finalAccuracy = calculateAccuracy(state.totalCorrectChars, state.totalTypedChars);
  const finalScore = calculateScore(finalWpm, finalAccuracy);
  const level = getPerformanceLevel(finalWpm, finalAccuracy);
  const message = getPerformanceMessage(finalWpm, finalAccuracy);

  // Update Lifetime Stats in LocalStorage
  const lifetimeStats = getStoredStats();
  lifetimeStats.testsCompleted = (lifetimeStats.testsCompleted || 0) + 1;

  if (finalWpm > (lifetimeStats.bestWpm || 0)) {
    lifetimeStats.bestWpm = finalWpm;
  }
  if (finalAccuracy > (lifetimeStats.bestAccuracy || 0)) {
    lifetimeStats.bestAccuracy = finalAccuracy;
  }
  const overallBestStreak = Math.max(lifetimeStats.bestStreak || 0, state.bestStreakInTest);
  lifetimeStats.bestStreak = overallBestStreak;

  saveStoredStats(lifetimeStats);

  // Update Lifetime Weak Keys Mistake Counts in LocalStorage
  const storedMistakes = getStoredMistakes();
  for (const [key, count] of Object.entries(state.currentSessionMistakes)) {
    storedMistakes[key] = (storedMistakes[key] || 0) + count;
  }
  saveStoredMistakes(storedMistakes);

  // Refresh Lifetime UI on Home & Weak Keys view
  renderDashboardLifetimeStats();
  renderWeakKeysView();

  // Populate Results Modal
  DOM.resultLevelBadge.textContent = level;
  DOM.resultMessage.textContent = message;
  DOM.resWpm.textContent = finalWpm;
  DOM.resAccuracy.textContent = `${finalAccuracy}%`;
  DOM.resScore.textContent = finalScore;
  DOM.resTime.textContent = `${state.elapsedSeconds}s`;
  DOM.resCorrect.textContent = state.totalCorrectChars;
  DOM.resIncorrect.textContent = state.totalIncorrectChars;
  DOM.resStreak.textContent = state.bestStreakInTest;
  DOM.resDifficulty.textContent = state.activeDifficulty.toUpperCase();
  DOM.resMode.textContent = state.activeMode === "speed" ? "Speed Mode" : "Accuracy Mode";

  // Display session weak keys alert if any mistakes occurred
  const sessionErrors = Object.keys(state.currentSessionMistakes);
  if (sessionErrors.length > 0) {
    DOM.resWeakTags.innerHTML = "";
    sessionErrors.forEach((char) => {
      const badge = document.createElement("span");
      badge.className = "weak-key-mini-badge";
      badge.textContent = char.toUpperCase();
      DOM.resWeakTags.appendChild(badge);
    });
    DOM.resWeakAlert.style.display = "flex";
  } else {
    DOM.resWeakAlert.style.display = "none";
  }

  // Display Modal
  DOM.resultsModal.style.display = "flex";
}

/**
 * Ensures typing arena has active focus.
 */
function focusTypingArena() {
  DOM.typingArena.classList.add("focused");
  DOM.hiddenInput.focus();
}

// ============================================================================
// 7. WEAK KEY TRAINER & REPETITIVE DRILL GENERATION
// ============================================================================

/**
 * Generates an algorithmic repetitive typing drill using identified weak keys.
 * Pattern: "q p q p m m q p ..." designed for targeted finger muscle memory.
 */
function generateWeakKeyPassage() {
  const mistakes = getStoredMistakes();
  const sortedKeys = Object.entries(mistakes)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);

  // If no recorded mistakes yet, use common difficult keys
  const keysToPractice = sortedKeys.length > 0 ? sortedKeys.slice(0, 4) : ["q", "p", "z", "x"];
  
  // Build a rhythmic repetitive pattern of 25-30 words
  const words = [];
  const kLen = keysToPractice.length;

  for (let i = 0; i < 28; i++) {
    const k1 = keysToPractice[i % kLen];
    const k2 = keysToPractice[(i + 1) % kLen];
    const k3 = keysToPractice[(i + 2) % kLen];

    if (i % 3 === 0) {
      words.push(`${k1}${k2} ${k1}${k2}`);
    } else if (i % 3 === 1) {
      words.push(`${k2}${k2} ${k3}${k1}`);
    } else {
      words.push(`${k1}${k3}${k2}`);
    }
  }

  return words.join(" ").trim();
}

/**
 * Updates the Weak Key Trainer section with sorted mistake chips and drill preview.
 */
function renderWeakKeysView() {
  const mistakes = getStoredMistakes();
  const entries = Object.entries(mistakes).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    DOM.weakEmptyState.style.display = "block";
    DOM.weakActiveState.style.display = "none";
  } else {
    DOM.weakEmptyState.style.display = "none";
    DOM.weakActiveState.style.display = "block";

    // Populate top weak key chips
    DOM.weakKeyChipsContainer.innerHTML = "";
    // Show top 8 error keys
    const topErrors = entries.slice(0, 8);
    topErrors.forEach(([key, count]) => {
      const card = document.createElement("div");
      card.className = "weak-key-card";
      
      const letter = document.createElement("span");
      letter.className = "weak-key-letter";
      letter.textContent = key === " " ? "SPACE" : key.toUpperCase();

      const badge = document.createElement("span");
      badge.className = "weak-key-count";
      badge.textContent = `${count} mistake${count > 1 ? "s" : ""}`;

      card.appendChild(letter);
      card.appendChild(badge);
      DOM.weakKeyChipsContainer.appendChild(card);
    });

    // Generate sample preview
    const sampleDrill = generateWeakKeyPassage().slice(0, 45) + "...";
    DOM.drillPreviewSample.textContent = sampleDrill;
  }
}

/**
 * Launches the generated weak key practice drill in the typing arena.
 */
function launchWeakKeyDrill() {
  state.activeDifficulty = "weakkeys";

  // Show and activate the weak key pill in test bar
  DOM.weakPill.style.display = "inline-block";
  DOM.diffPills.forEach((p) => p.classList.remove("active"));
  DOM.weakPill.classList.add("active");

  const drillText = generateWeakKeyPassage();
  switchSection("typing-test");
  initTest(drillText);
}

// ============================================================================
// 8. SPEED VS ACCURACY MODE TOGGLE LOGIC
// ============================================================================

/**
 * Sets active training mode ('speed' or 'accuracy') and updates UI styling.
 */
function setTestMode(mode) {
  state.activeMode = mode;

  // Update pills in test bar
  DOM.modePills.forEach((pill) => {
    pill.classList.toggle("active", pill.dataset.mode === mode);
  });

  // Update mode banner description
  if (mode === "speed") {
    DOM.modeBannerInfo.className = "mode-banner";
    DOM.modeBannerInfo.innerHTML = `
      <span class="mode-banner-icon">⚡</span>
      <span class="mode-banner-text"><strong>Speed Mode Active:</strong> Push your tempo. WPM and elapsed time are emphasized.</span>
    `;
    DOM.liveMetricsBar.className = "live-metrics-bar mode-speed-highlight";
  } else {
    DOM.modeBannerInfo.className = "mode-banner accuracy-active";
    DOM.modeBannerInfo.innerHTML = `
      <span class="mode-banner-icon">🎯</span>
      <span class="mode-banner-text"><strong>Accuracy Mode Active:</strong> Precision first. Minimize errors and maintain clean keystrokes.</span>
    `;
    DOM.liveMetricsBar.className = "live-metrics-bar mode-accuracy-highlight";
  }
}

// ============================================================================
// 9. NAVIGATION & SINGLE PAGE APPLICATION (SPA) CONTROLLER
// ============================================================================

/**
 * Seamlessly switches active view between sections without page reload.
 */
function switchSection(targetSectionId) {
  state.activeSection = targetSectionId;

  // Update navbar links active state
  DOM.navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.section === targetSectionId);
  });

  // Toggle visible section
  DOM.sections.forEach((section) => {
    section.classList.toggle("active", section.id === targetSectionId);
  });

  // Close mobile drawer if opened
  DOM.navMenu.classList.remove("open");

  // Specific section activations
  if (targetSectionId === "typing-test") {
    // If test hasn't started or text is empty, initialize it
    if (!state.targetText) {
      initTest();
    } else {
      focusTypingArena();
    }
  } else if (targetSectionId === "weak-keys") {
    renderWeakKeysView();
  } else if (targetSectionId === "home") {
    renderDashboardLifetimeStats();
    renderRecordingsHistory();
  } else if (targetSectionId === "auth") {
    updateAuthUI();
  }

  // Smooth scroll to top of page
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Loads and renders lifetime statistics on the Home / Dashboard.
 */
function renderDashboardLifetimeStats() {
  const stats = getStoredStats();
  DOM.dashBestWpm.textContent = stats.bestWpm || 0;
  DOM.dashBestAcc.textContent = `${stats.bestAccuracy || 0}%`;
  DOM.dashBestStreak.textContent = stats.bestStreak || 0;
  DOM.dashTestsDone.textContent = stats.testsCompleted || 0;
}

// ============================================================================
// 10. INDEXEDDB RECORDINGS STORAGE HELPER
// ============================================================================
const DB_NAME = "TypeKeyRecordingsDB";
const DB_VERSION = 1;
const STORE_NAME = "recordings";

function openRecordingsDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.warn("IndexedDB not supported.");
      return resolve(null);
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveRecordingToDB(recording) {
  try {
    const db = await openRecordingsDB();
    if (!db) return false;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(recording);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error("Failed to save recording to DB:", err);
    return false;
  }
}

async function getAllRecordingsFromDB() {
  try {
    const db = await openRecordingsDB();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => b.timestamp - a.timestamp);
        resolve(list);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error("Failed to read recordings from DB:", err);
    return [];
  }
}

async function getRecordingById(id) {
  try {
    const db = await openRecordingsDB();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error("Failed to get recording by id:", err);
    return null;
  }
}

async function deleteRecordingFromDB(id) {
  try {
    const db = await openRecordingsDB();
    if (!db) return false;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error("Failed to delete recording from DB:", err);
    return false;
  }
}

// ============================================================================
// 11. SCREEN RECORDER ENGINE & PLAYBACK
// ============================================================================
let screenStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordStartTime = null;
let recordTimerInterval = null;
let activeVideoUrl = null;

async function startScreenRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    alert("Screen recording is not supported in this browser environment.");
    return;
  }

  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "always" },
      audio: false
    });

    // Handle user clicking "Stop Sharing" on the browser native bar
    screenStream.getVideoTracks()[0].addEventListener("ended", () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        stopScreenRecording();
      }
    });

    recordedChunks = [];
    let mimeType = "video/webm";
    if (window.MediaRecorder && MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
      mimeType = "video/webm;codecs=vp9";
    } else if (window.MediaRecorder && MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
      mimeType = "video/webm;codecs=vp8";
    }

    mediaRecorder = new MediaRecorder(screenStream, { mimeType });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      clearInterval(recordTimerInterval);
      recordTimerInterval = null;

      const durationSecs = Math.max(1, Math.floor((Date.now() - recordStartTime) / 1000));
      const blob = new Blob(recordedChunks, { type: "video/webm" });

      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
        screenStream = null;
      }

      const now = new Date();
      const dateStr = now.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
      const timeStr = now.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit"
      });

      const recordingItem = {
        id: "rec_" + Date.now(),
        title: `Typing Session - ${dateStr}, ${timeStr}`,
        timestamp: Date.now(),
        duration: durationSecs,
        durationFormatted: formatTime(durationSecs),
        sizeBytes: blob.size,
        sizeFormatted: (blob.size / (1024 * 1024)).toFixed(1) + " MB",
        blob: blob
      };

      await saveRecordingToDB(recordingItem);
      updateRecorderUI(false);
      renderRecordingsHistory();
    };

    mediaRecorder.start(1000);
    recordStartTime = Date.now();
    updateRecorderUI(true);

    recordTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
      DOM.recordingTimer.textContent = formatTime(elapsed);
    }, 1000);

  } catch (err) {
    console.warn("Screen recording was cancelled or rejected:", err);
    updateRecorderUI(false);
  }
}

function stopScreenRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  updateRecorderUI(false);
}

function updateRecorderUI(isRecording) {
  if (isRecording) {
    DOM.startRecordBtn.style.display = "none";
    DOM.stopRecordBtn.style.display = "inline-flex";
    DOM.recordingStatusPill.style.display = "inline-flex";
    DOM.recordingTimer.textContent = "00:00";
  } else {
    DOM.startRecordBtn.style.display = "inline-flex";
    DOM.stopRecordBtn.style.display = "none";
    DOM.recordingStatusPill.style.display = "none";
  }
}

async function renderRecordingsHistory() {
  const list = await getAllRecordingsFromDB();
  DOM.recordingsCountBadge.textContent = `${list.length} saved`;

  if (list.length === 0) {
    DOM.noRecordingsMsg.style.display = "block";
    DOM.recordingsList.style.display = "none";
    DOM.recordingsList.innerHTML = "";
    return;
  }

  DOM.noRecordingsMsg.style.display = "none";
  DOM.recordingsList.style.display = "grid";
  DOM.recordingsList.innerHTML = "";

  list.forEach((rec) => {
    const card = document.createElement("div");
    card.className = "recording-item-card";

    card.innerHTML = `
      <div class="recording-item-header">
        <div>
          <div class="recording-item-title">${rec.title}</div>
          <div class="recording-item-date">${new Date(rec.timestamp).toLocaleString()}</div>
        </div>
      </div>
      <div class="recording-item-meta">
        <span class="meta-pill">⏱ ${rec.durationFormatted}</span>
        <span class="meta-pill">💾 ${rec.sizeFormatted}</span>
      </div>
      <div class="recording-item-actions">
        <button class="btn btn-sm btn-primary watch-rec-btn" data-id="${rec.id}">▶ Watch</button>
        <button class="btn btn-sm btn-secondary download-rec-btn" data-id="${rec.id}">⬇ Download</button>
        <button class="btn btn-sm btn-ghost text-danger delete-rec-btn" data-id="${rec.id}" title="Delete recording">🗑</button>
      </div>
    `;

    DOM.recordingsList.appendChild(card);
  });

  DOM.recordingsList.querySelectorAll(".watch-rec-btn").forEach((btn) => {
    btn.addEventListener("click", () => playRecording(btn.dataset.id));
  });

  DOM.recordingsList.querySelectorAll(".download-rec-btn").forEach((btn) => {
    btn.addEventListener("click", () => downloadRecording(btn.dataset.id));
  });

  DOM.recordingsList.querySelectorAll(".delete-rec-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteRecording(btn.dataset.id));
  });
}

async function playRecording(id) {
  const rec = await getRecordingById(id);
  if (!rec || !rec.blob) {
    alert("Recording file could not be retrieved.");
    return;
  }

  if (activeVideoUrl) {
    URL.revokeObjectURL(activeVideoUrl);
  }

  activeVideoUrl = URL.createObjectURL(rec.blob);
  DOM.playbackVideo.src = activeVideoUrl;
  DOM.videoModalTitle.textContent = rec.title;
  DOM.videoModalSubtitle.textContent = `Duration: ${rec.durationFormatted} • Size: ${rec.sizeFormatted}`;
  DOM.videoDownloadBtn.href = activeVideoUrl;
  DOM.videoDownloadBtn.download = `${rec.id}.webm`;

  DOM.videoModal.style.display = "flex";
  DOM.playbackVideo.play().catch(() => {});
}

function closeVideoModal() {
  DOM.videoModal.style.display = "none";
  DOM.playbackVideo.pause();
  DOM.playbackVideo.currentTime = 0;
  if (activeVideoUrl) {
    URL.revokeObjectURL(activeVideoUrl);
    activeVideoUrl = null;
  }
}

async function downloadRecording(id) {
  const rec = await getRecordingById(id);
  if (!rec || !rec.blob) return;
  const url = URL.createObjectURL(rec.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${rec.id}.webm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function deleteRecording(id) {
  if (confirm("Are you sure you want to delete this recording from history?")) {
    await deleteRecordingFromDB(id);
    renderRecordingsHistory();
  }
}

// ============================================================================
// 12. AUTHENTICATION (LOGIN & SIGN UP VIA LOCALSTORAGE)
// ============================================================================

function getStoredUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveStoredUsers(users) {
  try {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  } catch (e) {}
}

function getAuthUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setAuthUser(user) {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  } catch (e) {}
}

function updateAuthUI() {
  const currentUser = getAuthUser();
  if (currentUser) {
    DOM.headerUserStatus.style.display = "inline-flex";
    DOM.headerUserEmail.textContent = currentUser.email;
    DOM.headerLoginBtn.style.display = "none";
    DOM.navAuthLink.textContent = "Profile";

    DOM.authLoggedInBox.style.display = "block";
    DOM.authForm.style.display = "none";
    DOM.authCurrentEmail.textContent = currentUser.email;
  } else {
    DOM.headerUserStatus.style.display = "none";
    DOM.headerLoginBtn.style.display = "inline-flex";
    DOM.navAuthLink.textContent = "Login";

    DOM.authLoggedInBox.style.display = "none";
    DOM.authForm.style.display = "block";
  }
}

let activeAuthTab = "login";

function setAuthTab(tab) {
  activeAuthTab = tab;
  DOM.authTabLogin.classList.toggle("active", tab === "login");
  DOM.authTabSignup.classList.toggle("active", tab === "signup");

  DOM.authAlert.style.display = "none";

  if (tab === "login") {
    DOM.authFormTitle.textContent = "Account Login";
    DOM.authFormSubtitle.textContent = "Enter your email and email password to log in";
    DOM.confirmPasswordGroup.style.display = "none";
    DOM.authConfirmPasswordInput.removeAttribute("required");
    DOM.authSubmitBtn.textContent = "Log In";
  } else {
    DOM.authFormTitle.textContent = "Create an Account";
    DOM.authFormSubtitle.textContent = "Register with your email and password to track your progress";
    DOM.confirmPasswordGroup.style.display = "block";
    DOM.authConfirmPasswordInput.setAttribute("required", "required");
    DOM.authSubmitBtn.textContent = "Create Account";
  }
}

function showAuthAlert(message, type = "error") {
  DOM.authAlert.className = `auth-alert ${type}`;
  DOM.authAlert.textContent = message;
  DOM.authAlert.style.display = "block";
}

function handleAuthSubmit(e) {
  e.preventDefault();
  const email = DOM.authEmailInput.value.trim().toLowerCase();
  const password = DOM.authPasswordInput.value;
  const users = getStoredUsers();

  if (activeAuthTab === "signup") {
    const confirmPassword = DOM.authConfirmPasswordInput.value;

    if (!email || !email.includes("@") || !email.includes(".")) {
      showAuthAlert("Please enter a valid email address.", "error");
      return;
    }

    if (password.length < 4) {
      showAuthAlert("Password must be at least 4 characters long.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showAuthAlert("Passwords do not match. Please re-enter.", "error");
      return;
    }

    const existing = users.find((u) => u.email === email);
    if (existing) {
      showAuthAlert("An account with this email already exists. Please log in.", "error");
      return;
    }

    const newUser = {
      email,
      password,
      registeredAt: Date.now()
    };
    users.push(newUser);
    saveStoredUsers(users);

    setAuthUser({ email, loggedInAt: Date.now() });
    showAuthAlert("Account created successfully! Welcome to TypeKey.", "success");
    setTimeout(() => {
      DOM.authForm.reset();
      updateAuthUI();
      switchSection("typing-test");
    }, 900);

  } else {
    // LOGIN
    const user = users.find((u) => u.email === email && u.password === password);
    if (!user) {
      showAuthAlert("Invalid email or password. Please try again or sign up.", "error");
      return;
    }

    setAuthUser({ email: user.email, loggedInAt: Date.now() });
    showAuthAlert("Logged in successfully! Loading TypeKey...", "success");
    setTimeout(() => {
      DOM.authForm.reset();
      updateAuthUI();
      switchSection("typing-test");
    }, 800);
  }
}

function handleLogout() {
  setAuthUser(null);
  updateAuthUI();
  setAuthTab("login");
  showAuthAlert("You have logged out.", "success");
}

// ============================================================================
// 13. EVENT LISTENERS & INITIALIZATION
// ============================================================================

function setupEventListeners() {
  // Navigation Links
  DOM.navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.dataset.section;
      switchSection(target);
    });
  });

  DOM.brandLink.addEventListener("click", (e) => {
    e.preventDefault();
    switchSection("home");
  });

  // Mobile menu toggle
  DOM.mobileMenuBtn.addEventListener("click", () => {
    DOM.navMenu.classList.toggle("open");
  });

  // Quick Action Buttons
  DOM.quickStartBtn.addEventListener("click", () => switchSection("typing-test"));
  DOM.heroStartBtn.addEventListener("click", () => switchSection("typing-test"));
  DOM.heroWeakKeysBtn.addEventListener("click", () => switchSection("weak-keys"));
  DOM.weakGoTestBtn.addEventListener("click", () => switchSection("typing-test"));

  // Mode Pill Clicks in Test Bar
  DOM.modePills.forEach((pill) => {
    pill.addEventListener("click", () => {
      setTestMode(pill.dataset.mode);
    });
  });

  // Difficulty Pill Clicks in Test Bar
  DOM.diffPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const diff = pill.dataset.diff;
      state.activeDifficulty = diff;
      DOM.diffPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      initTest();
    });
  });

  // Test Actions: New Text, Restart, Finish Early
  DOM.newTextBtn.addEventListener("click", () => initTest());
  DOM.restartTestBtn.addEventListener("click", () => initTest(state.targetText));
  DOM.finishTestBtn.addEventListener("click", () => {
    finishTest();
  });

  // Arena Click to Focus
  DOM.targetTextContainer.addEventListener("click", focusTypingArena);
  DOM.typingArena.addEventListener("click", focusTypingArena);

  // Unfocus styling when clicking outside
  document.addEventListener("click", (e) => {
    if (DOM.typingArena && !DOM.typingArena.contains(e.target) && e.target !== DOM.quickStartBtn) {
      DOM.typingArena.classList.remove("focused");
    }
  });

  // Global Keyboard Listener (captures typing and hotkeys)
  window.addEventListener("keydown", (e) => {
    // If modal is open and user presses Enter or Escape, restart test
    if (DOM.resultsModal.style.display === "flex") {
      if (e.key === "Escape" || e.key === "Enter") {
        initTest(state.targetText);
      }
      return;
    }

    // Only capture typing when in the Typing Test section
    if (state.activeSection === "typing-test") {
      // Escape key restarts current test as a quick shortcut
      if (e.key === "Escape") {
        initTest(state.targetText);
        return;
      }
      handleKeystroke(e);
    }
  });

  // Results Modal Buttons
  DOM.resTryAgainBtn.addEventListener("click", () => {
    initTest(state.targetText);
  });

  DOM.resNextPassageBtn.addEventListener("click", () => {
    initTest();
  });

  DOM.resPracticeWeakBtn.addEventListener("click", () => {
    DOM.resultsModal.style.display = "none";
    launchWeakKeyDrill();
  });

  // Weak Key Trainer Drill Generator Buttons
  DOM.startWeakDrillBtn.addEventListener("click", launchWeakKeyDrill);

  DOM.clearWeakDataBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to reset all weak keys mistake history?")) {
      saveStoredMistakes({});
      renderWeakKeysView();
    }
  });

  // Speed vs Accuracy Landing Page Quick Launchers
  DOM.selectSpeedModeBtn.addEventListener("click", () => {
    setTestMode("speed");
    switchSection("typing-test");
  });

  DOM.selectAccuracyModeBtn.addEventListener("click", () => {
    setTestMode("accuracy");
    switchSection("typing-test");
  });

  // Footer: Reset All LocalStorage
  DOM.footerResetAll.addEventListener("click", () => {
    if (confirm("Reset ALL lifetime typing stats, streaks, and weak key history?")) {
      localStorage.removeItem(STORAGE_KEYS.STATS);
      localStorage.removeItem(STORAGE_KEYS.MISTAKES);
      renderDashboardLifetimeStats();
      renderWeakKeysView();
      initTest();
      alert("All local data has been successfully reset.");
    }
  });

  // Auth & Profile Event Listeners
  DOM.headerLoginBtn.addEventListener("click", () => switchSection("auth"));
  DOM.headerLogoutBtn.addEventListener("click", handleLogout);
  DOM.authLogoutBtn.addEventListener("click", handleLogout);
  DOM.authGoPracticeBtn.addEventListener("click", () => switchSection("typing-test"));
  DOM.authGuestBtn.addEventListener("click", () => switchSection("home"));
  DOM.authTabLogin.addEventListener("click", () => setAuthTab("login"));
  DOM.authTabSignup.addEventListener("click", () => setAuthTab("signup"));
  DOM.authForm.addEventListener("submit", handleAuthSubmit);

  // Screen Recorder Event Listeners
  DOM.startRecordBtn.addEventListener("click", startScreenRecording);
  DOM.stopRecordBtn.addEventListener("click", stopScreenRecording);
  DOM.closeVideoModalBtn.addEventListener("click", closeVideoModal);
  DOM.videoModal.addEventListener("click", (e) => {
    if (e.target === DOM.videoModal) {
      closeVideoModal();
    }
  });
}

// ============================================================================
// 14. APPLICATION BOOTSTRAP
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  renderDashboardLifetimeStats();
  renderWeakKeysView();
  renderRecordingsHistory();
  updateAuthUI();
  setTestMode("speed");

  // Check URL hash if opened with #typing-test, etc.
  const hash = window.location.hash.replace("#", "");
  if (hash && document.getElementById(hash)) {
    switchSection(hash);
  } else {
    switchSection("home");
  }

  // Pre-initialize the first test passage ready to type
  initTest();
});

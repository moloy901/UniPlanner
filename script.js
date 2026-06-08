const SUPABASE_URL = "https://nxlcpxgvtznwiummiuhv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Jo8q0qxwouHxJtWboT04LQ_EfHKLj8o";

let supabaseClient = null;
const SIGNUP_EMAIL_COOLDOWN_MS = 60 * 1000;

// ---------- Helpers ----------

function showMessage(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = `message show ${type}`;
}

function hideMessage(el) {
  if (!el) return;
  el.textContent = "";
  el.className = "message";
}

function validateEmail(email) {
  const normalizedEmail = email.toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (!emailPattern.test(normalizedEmail)) {
    return "Please enter a valid email address.";
  }

  const [localPart, domain] = normalizedEmail.split("@");
  const typoDomains = {
    "gmai.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gnail.com": "gmail.com",
    "gmail.con": "gmail.com",
    "yaho.com": "yahoo.com",
    "yahoo.con": "yahoo.com",
    "hotmial.com": "hotmail.com",
    "hotmai.com": "hotmail.com",
    "outlok.com": "outlook.com",
    "outlook.con": "outlook.com",
  };

  if (typoDomains[domain]) {
    return `Did you mean ${localPart}@${typoDomains[domain]}?`;
  }

  return "";
}

function isEmailConfirmed(user) {
  return Boolean(user && (user.email_confirmed_at || user.confirmed_at));
}

function getAuthPageUrl() {
  return new URL("index.html", window.location.href).href;
}

function getAuthUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);

  hashParams.forEach((value, key) => {
    if (!params.has(key)) {
      params.set(key, value);
    }
  });

  return params;
}

function clearAuthUrl() {
  window.history.replaceState(null, "", window.location.pathname);
}

function getSignupCooldownKey(email) {
  return `signup-email-cooldown:${email.toLowerCase()}`;
}

function getSignupCooldownSeconds(email) {
  const cooldownUntil = Number(localStorage.getItem(getSignupCooldownKey(email)) || 0);
  const remainingMs = cooldownUntil - Date.now();

  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / 1000);
}

function startSignupCooldown(email) {
  localStorage.setItem(
    getSignupCooldownKey(email),
    String(Date.now() + SIGNUP_EMAIL_COOLDOWN_MS)
  );
}

function getAuthErrorMessage(error) {
  const message = error && error.message ? error.message : "Authentication failed.";

  if (/rate limit/i.test(message)) {
    return "Too many confirmation emails were sent. Please wait a few minutes before trying again.";
  }

  return message;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";

  const d = new Date(dateStr + "T00:00:00");

  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function priorityLabel(p) {
  if (!p) return "";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function getUserDisplayName(user) {
  const metadata = (user && user.user_metadata) || {};
  const name = metadata.full_name || metadata.name;

  return name || (user && user.email) || "";
}

// ---------- Auth Page ----------

async function initAuth() {
  const messageEl = document.getElementById("auth-message");
  const authParams = getAuthUrlParams();
  const authError = authParams.get("error_description") || authParams.get("error");
  const isConfirmationReturn =
    authParams.get("type") === "signup" ||
    authParams.has("access_token") ||
    authParams.has("code");

  const { data, error } = await supabaseClient.auth.getSession();

  if (authError) {
    clearAuthUrl();
    showMessage(messageEl, authError.replace(/\+/g, " "), "error");
    return;
  }

  let callbackSession = null;

  if (authParams.has("code")) {
    const { data: exchangeData, error: exchangeError } =
      await supabaseClient.auth.exchangeCodeForSession(authParams.get("code"));

    if (exchangeError) {
      clearAuthUrl();
      showMessage(messageEl, exchangeError.message, "error");
      return;
    }

    callbackSession = exchangeData.session;
  }

  if (error) {
    showMessage(messageEl, error.message, "error");
    return;
  }

  if (isConfirmationReturn) {
    if (callbackSession || data.session) {
      await supabaseClient.auth.signOut();
    }

    clearAuthUrl();
    showMessage(messageEl, "Email confirmed successfully. Please log in now.", "success");
    return;
  }

  if (data.session && isEmailConfirmed(data.session.user)) {
    window.location.href = "./dashboard.html";
    return;
  }

  if (data.session) {
    await supabaseClient.auth.signOut();
    showMessage(messageEl, "Please confirm your email before logging in.", "error");
  }

  const tabs = document.querySelectorAll(".tab");
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");

  if (!loginForm || !signupForm) {
    showMessage(messageEl, "Login form not found.", "error");
    return;
  }

  const signupButton = signupForm.querySelector('button[type="submit"]');
  let isSignupSubmitting = false;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle("active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
      });

      loginForm.classList.toggle("active", target === "login");
      signupForm.classList.toggle("active", target === "signup");

      hideMessage(messageEl);
    });
  });

  // Login
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    hideMessage(messageEl);

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    if (!email || !password) {
      showMessage(messageEl, "Please enter email and password.", "error");
      return;
    }

    const emailError = validateEmail(email);
    if (emailError) {
      showMessage(messageEl, emailError, "error");
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      showMessage(messageEl, error.message, "error");
      return;
    }

    if (!data.session) {
      showMessage(messageEl, "Login failed. Please try again.", "error");
      return;
    }

    if (!isEmailConfirmed(data.session.user)) {
      await supabaseClient.auth.signOut();
      showMessage(messageEl, "Please confirm your email before logging in.", "error");
      return;
    }

    showMessage(messageEl, "Welcome back! Redirecting...", "success");

    setTimeout(() => {
      window.location.href = "./dashboard.html";
    }, 700);
  });

  // Signup
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSignupSubmitting) {
      return;
    }

    hideMessage(messageEl);

    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const confirm = document.getElementById("signup-confirm").value;

    if (!name || !email || !password || !confirm) {
      showMessage(messageEl, "Please fill in all fields.", "error");
      return;
    }

    const emailError = validateEmail(email);
    if (emailError) {
      showMessage(messageEl, emailError, "error");
      return;
    }

    const cooldownSeconds = getSignupCooldownSeconds(email);
    if (cooldownSeconds > 0) {
      showMessage(
        messageEl,
        `Please wait ${cooldownSeconds}s before sending another confirmation email.`,
        "error"
      );
      return;
    }

    if (password.length < 6) {
      showMessage(messageEl, "Password must be at least 6 characters.", "error");
      return;
    }

    if (password !== confirm) {
      showMessage(messageEl, "Passwords do not match.", "error");
      return;
    }

    isSignupSubmitting = true;
    if (signupButton) {
      signupButton.disabled = true;
      signupButton.textContent = "Sending confirmation...";
    }

    let signUpError = null;

    try {
      const { error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: getAuthPageUrl(),
          data: {
            full_name: name,
            name: name,
          },
        },
      });
      signUpError = error;
    } catch (error) {
      signUpError = error;
    } finally {
      if (signupButton) {
        signupButton.disabled = false;
        signupButton.textContent = "Create account";
      }
      isSignupSubmitting = false;
    }

    if (signUpError) {
      if (/rate limit/i.test(signUpError.message || "")) {
        startSignupCooldown(email);
      }
      showMessage(messageEl, getAuthErrorMessage(signUpError), "error");
      return;
    }

    startSignupCooldown(email);

    // Account create er por auto login hole logout kore dibo
    await supabaseClient.auth.signOut();

    signupForm.reset();

    tabs.forEach((tab) => {
      const isLogin = tab.dataset.tab === "login";
      tab.classList.toggle("active", isLogin);
      tab.setAttribute("aria-selected", isLogin ? "true" : "false");
    });

    loginForm.classList.add("active");
    signupForm.classList.remove("active");

    document.getElementById("login-email").value = email;
    document.getElementById("login-password").value = "";

    showMessage(
      messageEl,
      "Confirmation link sent. Please check your email before logging in.",
      "success"
    );
  });
}

// ---------- Dashboard ----------

let currentUser = null;
let allTasks = [];
let activeFilter = "all";
let activeSearch = "";
let activeSort = "deadline";
let editingTaskId = null;

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isTaskOverdue(task) {
  return task.status !== "completed" && task.deadline < getTodayDateString();
}

function isTaskDueToday(task) {
  return task.status !== "completed" && task.deadline === getTodayDateString();
}

function getDaysUntil(deadline) {
  const today = new Date(`${getTodayDateString()}T00:00:00`);
  const dueDate = new Date(`${deadline}T00:00:00`);
  const diffMs = dueDate - today;

  return Math.round(diffMs / 86400000);
}

function getDueStatus(task) {
  if (task.status === "completed") {
    return { label: "Done", className: "due-done" };
  }

  const days = getDaysUntil(task.deadline);

  if (days < 0) {
    return {
      label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`,
      className: "due-overdue",
    };
  }

  if (days === 0) {
    return { label: "Due today", className: "due-today" };
  }

  if (days === 1) {
    return { label: "Due tomorrow", className: "due-soon" };
  }

  if (days <= 3) {
    return { label: `Due in ${days} days`, className: "due-soon" };
  }

  return { label: `Due in ${days} days`, className: "due-normal" };
}

async function initDashboard() {
  const messageEl = document.getElementById("dashboard-message");

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    showMessage(messageEl, error.message, "error");
    return;
  }

  if (!data.session) {
    window.location.href = "./index.html";
    return;
  }

  if (!isEmailConfirmed(data.session.user)) {
    await supabaseClient.auth.signOut();
    window.location.href = "./index.html";
    return;
  }

  currentUser = data.session.user;

  const userEmailEl = document.getElementById("user-email");
  if (userEmailEl) {
    userEmailEl.textContent = getUserDisplayName(currentUser);
    userEmailEl.title = currentUser.email || "";
  }

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      window.location.href = "./index.html";
    }
  });

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.href = "./index.html";
    });
  }

  const taskForm = document.getElementById("task-form");
  if (taskForm) {
    taskForm.addEventListener("submit", handleAddTask);
  }

  const cancelEditBtn = document.getElementById("cancel-edit-btn");
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", resetTaskForm);
  }

  const deadlineInput = document.getElementById("task-deadline");
  if (deadlineInput) {
    deadlineInput.min = getTodayDateString();
  }

  const searchInput = document.getElementById("task-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      activeSearch = searchInput.value.trim().toLowerCase();
      renderTasks();
    });
  }

  const sortSelect = document.getElementById("task-sort");
  if (sortSelect) {
    activeSort = sortSelect.value;
    sortSelect.addEventListener("change", () => {
      activeSort = sortSelect.value;
      renderTasks();
    });
  }

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => {
        b.classList.remove("active");
      });

      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  await loadTasks();
}

async function handleAddTask(e) {
  e.preventDefault();
  e.stopPropagation();

  const messageEl = document.getElementById("dashboard-message");
  hideMessage(messageEl);

  const title = document.getElementById("task-title").value.trim();
  const subject = document.getElementById("task-subject").value.trim();
  const deadline = document.getElementById("task-deadline").value;
  const priority = document.getElementById("task-priority").value;
  const status = document.getElementById("task-status").value;

  if (!title || !subject || !deadline) {
    showMessage(messageEl, "Please fill in title, subject, and deadline.", "error");
    return;
  }

  if (!editingTaskId && deadline < getTodayDateString()) {
    showMessage(messageEl, "Deadline cannot be in the past.", "error");
    return;
  }

  if (editingTaskId) {
    await updateTask(editingTaskId, {
      title: title,
      subject: subject,
      deadline: deadline,
      priority: priority,
      status: status,
    });
    return;
  }

  const { data, error } = await supabaseClient
    .from("tasks")
    .insert({
      user_id: currentUser.id,
      title: title,
      subject: subject,
      deadline: deadline,
      priority: priority,
      status: status,
    })
    .select()
    .single();

  if (error) {
    showMessage(messageEl, error.message, "error");
    return;
  }

  allTasks.unshift(data);
  renderTasks();

  resetTaskForm();

  showMessage(messageEl, "Task added successfully!", "success");

  setTimeout(() => {
    hideMessage(messageEl);
  }, 2500);
}

async function updateTask(id, updates) {
  const messageEl = document.getElementById("dashboard-message");

  const { data, error } = await supabaseClient
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .eq("user_id", currentUser.id)
    .select()
    .single();

  if (error) {
    showMessage(messageEl, error.message, "error");
    return;
  }

  allTasks = allTasks.map((task) => (task.id === id ? data : task));
  resetTaskForm();
  renderTasks();

  showMessage(messageEl, "Task updated successfully!", "success");

  setTimeout(() => {
    hideMessage(messageEl);
  }, 2500);
}

function startEditTask(id) {
  const task = allTasks.find((item) => item.id === id);
  const taskForm = document.getElementById("task-form");
  const submitBtn = document.getElementById("task-submit-btn");
  const cancelEditBtn = document.getElementById("cancel-edit-btn");

  if (!task || !taskForm || !submitBtn || !cancelEditBtn) {
    return;
  }

  editingTaskId = id;
  const deadlineInput = document.getElementById("task-deadline");

  document.getElementById("task-title").value = task.title;
  document.getElementById("task-subject").value = task.subject;
  deadlineInput.min = task.deadline < getTodayDateString() ? task.deadline : getTodayDateString();
  deadlineInput.value = task.deadline;
  document.getElementById("task-priority").value = task.priority;
  document.getElementById("task-status").value = task.status;

  submitBtn.textContent = "Update task";
  cancelEditBtn.classList.remove("hidden");
  taskForm.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("task-title").focus();
}

function resetTaskForm() {
  const taskForm = document.getElementById("task-form");
  const submitBtn = document.getElementById("task-submit-btn");
  const cancelEditBtn = document.getElementById("cancel-edit-btn");

  editingTaskId = null;

  if (taskForm) {
    taskForm.reset();
  }

  const priorityEl = document.getElementById("task-priority");
  const statusEl = document.getElementById("task-status");
  const deadlineInput = document.getElementById("task-deadline");

  if (priorityEl) {
    priorityEl.value = "medium";
  }

  if (statusEl) {
    statusEl.value = "pending";
  }

  if (deadlineInput) {
    deadlineInput.min = getTodayDateString();
  }

  if (submitBtn) {
    submitBtn.textContent = "Add task";
  }

  if (cancelEditBtn) {
    cancelEditBtn.classList.add("hidden");
  }
}

async function loadTasks() {
  const loading = document.getElementById("task-loading");
  const messageEl = document.getElementById("dashboard-message");

  if (loading) {
    loading.classList.remove("hidden");
  }

  const { data, error } = await supabaseClient
    .from("tasks")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("deadline", { ascending: true });

  if (loading) {
    loading.classList.add("hidden");
  }

  if (error) {
    showMessage(messageEl, error.message, "error");
    return;
  }

  allTasks = data || [];
  renderTasks();
}

function getFilteredTasks() {
  let tasks = [...allTasks];

  if (activeFilter === "today") {
    tasks = tasks.filter(isTaskDueToday);
  } else if (activeFilter === "overdue") {
    tasks = tasks.filter(isTaskOverdue);
  } else if (activeFilter === "pending") {
    tasks = tasks.filter((t) => t.status === "pending");
  } else if (activeFilter === "completed") {
    tasks = tasks.filter((t) => t.status === "completed");
  } else if (activeFilter === "high") {
    tasks = tasks.filter((t) => t.priority === "high");
  }

  if (activeSearch) {
    tasks = tasks.filter((task) => {
      const searchableText = `${task.title} ${task.subject}`.toLowerCase();
      return searchableText.includes(activeSearch);
    });
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };

  tasks.sort((a, b) => {
    if (activeSort === "priority") {
      return (
        priorityRank[a.priority] - priorityRank[b.priority] ||
        a.deadline.localeCompare(b.deadline)
      );
    }

    if (activeSort === "created") {
      return new Date(b.created_at) - new Date(a.created_at);
    }

    return (
      a.deadline.localeCompare(b.deadline) ||
      priorityRank[a.priority] - priorityRank[b.priority]
    );
  });

  return tasks;
}

function updateTaskStats() {
  const totalEl = document.getElementById("stat-total");
  const todayEl = document.getElementById("stat-today");
  const overdueEl = document.getElementById("stat-overdue");
  const completedEl = document.getElementById("stat-completed");

  if (!totalEl || !todayEl || !overdueEl || !completedEl) {
    return;
  }

  totalEl.textContent = allTasks.length;
  todayEl.textContent = allTasks.filter(isTaskDueToday).length;
  overdueEl.textContent = allTasks.filter(isTaskOverdue).length;
  completedEl.textContent = allTasks.filter((task) => task.status === "completed").length;
}

function renderTasks() {
  const list = document.getElementById("task-list");
  const empty = document.getElementById("empty-state");

  if (!list || !empty) return;

  updateTaskStats();

  const filtered = getFilteredTasks();

  list.innerHTML = "";

  if (filtered.length === 0) {
    empty.classList.remove("hidden");

    empty.querySelector("p").textContent =
      activeFilter === "all" && !activeSearch
        ? "No tasks here yet. Add one to get started!"
        : "No tasks match this filter.";

    return;
  }

  empty.classList.add("hidden");

  filtered.forEach((task) => {
    const card = document.createElement("article");

    card.className = `task-card${task.status === "completed" ? " completed" : ""}`;
    card.dataset.id = task.id;

    const isCompleted = task.status === "completed";
    const dueStatus = getDueStatus(task);

    card.innerHTML = `
      <input
        type="checkbox"
        class="task-check"
        ${isCompleted ? "checked" : ""}
        aria-label="Mark ${escapeHtml(task.title)} as ${isCompleted ? "pending" : "completed"}"
      >

      <div class="task-body">
        <h3 class="task-title">${escapeHtml(task.title)}</h3>

        <div class="task-meta">
          <span>📖 ${escapeHtml(task.subject)}</span>
          <span>📅 ${formatDate(task.deadline)}</span>
          <span class="due-chip ${dueStatus.className}">
            ${escapeHtml(dueStatus.label)}
          </span>
          <span class="badge badge-priority-${task.priority}">
            ${priorityLabel(task.priority)}
          </span>
          <span class="badge badge-status-${task.status}">
            ${escapeHtml(task.status)}
          </span>
        </div>
      </div>

      <div class="task-actions">
        <button type="button" class="btn btn-secondary btn-sm edit-btn">
          Edit
        </button>
        <button type="button" class="btn btn-danger btn-sm delete-btn">
          Delete
        </button>
      </div>
    `;

    const checkbox = card.querySelector(".task-check");
    const editBtn = card.querySelector(".edit-btn");
    const deleteBtn = card.querySelector(".delete-btn");

    checkbox.addEventListener("change", (e) => {
      toggleComplete(task.id, e.target.checked);
    });

    editBtn.addEventListener("click", () => {
      startEditTask(task.id);
    });

    deleteBtn.addEventListener("click", () => {
      deleteTask(task.id);
    });

    list.appendChild(card);
  });
}

async function toggleComplete(id, completed) {
  const messageEl = document.getElementById("dashboard-message");
  const newStatus = completed ? "completed" : "pending";

  const { error } = await supabaseClient
    .from("tasks")
    .update({ status: newStatus })
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {
    showMessage(messageEl, error.message, "error");
    await loadTasks();
    return;
  }

  const task = allTasks.find((t) => t.id === id);

  if (task) {
    task.status = newStatus;
  }

  renderTasks();
}

async function deleteTask(id) {
  const messageEl = document.getElementById("dashboard-message");

  const confirmDelete = confirm("Are you sure you want to delete this task?");
  if (!confirmDelete) return;

  const { error } = await supabaseClient
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {
    showMessage(messageEl, error.message, "error");
    return;
  }

  allTasks = allTasks.filter((t) => t.id !== id);
  renderTasks();

  showMessage(messageEl, "Task deleted successfully!", "success");

  setTimeout(() => {
    hideMessage(messageEl);
  }, 2000);
}

// ---------- Boot ----------

document.addEventListener("DOMContentLoaded", () => {
  if (!window.supabase) {
    alert("Supabase library not loaded. Check your script tag in HTML.");
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const page = document.body.classList.contains("auth-page") ? "auth" : "dashboard";

  if (page === "auth") {
    initAuth();
  } else {
    initDashboard();
  }
});

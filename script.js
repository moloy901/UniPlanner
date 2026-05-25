const SUPABASE_URL = "https://nxlcpxgvtznwiummiuhv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Jo8q0qxwouHxJtWboT04LQ_EfHKLj8o";

let supabaseClient = null;

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

// ---------- Auth Page ----------

async function initAuth() {
  const messageEl = document.getElementById("auth-message");

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    showMessage(messageEl, error.message, "error");
    return;
  }

  if (data.session) {
    window.location.href = "./dashboard.html";
    return;
  }

  const tabs = document.querySelectorAll(".tab");
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");

  if (!loginForm || !signupForm) {
    showMessage(messageEl, "Login form not found.", "error");
    return;
  }

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

    showMessage(messageEl, "Welcome back! Redirecting...", "success");

    setTimeout(() => {
      window.location.href = "./dashboard.html";
    }, 700);
  });

  // Signup
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    hideMessage(messageEl);

    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const confirm = document.getElementById("signup-confirm").value;

    if (!email || !password || !confirm) {
      showMessage(messageEl, "Please fill in all fields.", "error");
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

    const { error } = await supabaseClient.auth.signUp({
      email: email,
      password: password,
    });

    if (error) {
      showMessage(messageEl, error.message, "error");
      return;
    }

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
      "Account created successfully! Please log in now.",
      "success"
    );
  });
}

// ---------- Dashboard ----------

let currentUser = null;
let allTasks = [];
let activeFilter = "all";

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

  currentUser = data.session.user;

  const userEmailEl = document.getElementById("user-email");
  if (userEmailEl) {
    userEmailEl.textContent = currentUser.email;
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

  e.target.reset();
  document.getElementById("task-priority").value = "medium";
  document.getElementById("task-status").value = "pending";

  showMessage(messageEl, "Task added successfully!", "success");

  setTimeout(() => {
    hideMessage(messageEl);
  }, 2500);
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
  if (activeFilter === "pending") {
    return allTasks.filter((t) => t.status === "pending");
  }

  if (activeFilter === "completed") {
    return allTasks.filter((t) => t.status === "completed");
  }

  if (activeFilter === "high") {
    return allTasks.filter((t) => t.priority === "high");
  }

  return allTasks;
}

function renderTasks() {
  const list = document.getElementById("task-list");
  const empty = document.getElementById("empty-state");

  if (!list || !empty) return;

  const filtered = getFilteredTasks();

  list.innerHTML = "";

  if (filtered.length === 0) {
    empty.classList.remove("hidden");

    empty.querySelector("p").textContent =
      activeFilter === "all"
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
          <span class="badge badge-priority-${task.priority}">
            ${priorityLabel(task.priority)}
          </span>
          <span class="badge badge-status-${task.status}">
            ${escapeHtml(task.status)}
          </span>
        </div>
      </div>

      <div class="task-actions">
        <button type="button" class="btn btn-danger btn-sm delete-btn">
          Delete
        </button>
      </div>
    `;

    const checkbox = card.querySelector(".task-check");
    const deleteBtn = card.querySelector(".delete-btn");

    checkbox.addEventListener("change", (e) => {
      toggleComplete(task.id, e.target.checked);
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
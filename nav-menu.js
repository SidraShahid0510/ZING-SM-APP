// nav-menu.js (ESM)
export function initNav(root = document) {
  // ===== Main user menu =====
  const navMenu = root.querySelector(".nav-menu");
  const navUserIcon = root.querySelector(".nav-user-icon");
  const navMenuClose = root.getElementById
    ? root.getElementById("close-nav-menu")
    : document.getElementById("close-nav-menu");
  const logoutBtn = root.getElementById
    ? root.getElementById("logout")
    : document.getElementById("logout");

  if (navMenu) {
    navMenu.style.display = "none"; // start hidden
    navMenu.setAttribute("aria-hidden", "true");
  }

  function openNavMenu() {
    if (!navMenu) return;
    navMenu.style.display = "block";
    requestAnimationFrame(() => {
      navMenu.classList.add("show");
      navMenu.setAttribute("aria-hidden", "false");
      navUserIcon?.setAttribute("aria-expanded", "true");
    });
  }

  function closeNavMenu() {
    if (!navMenu) return;
    navMenu.classList.remove("show");
    navMenu.addEventListener(
      "transitionend",
      () => {
        navMenu.style.display = "none";
        navMenu.setAttribute("aria-hidden", "true");
        navUserIcon?.setAttribute("aria-expanded", "false");
      },
      { once: true }
    );
  }

  navUserIcon?.addEventListener("click", openNavMenu);
  navUserIcon?.setAttribute("aria-expanded", "false");
  navUserIcon?.setAttribute("role", "button");
  navMenuClose?.addEventListener("click", closeNavMenu);

  // Close with ESC and outside-click
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeNavMenu();
  });
  document.addEventListener("click", (e) => {
    if (!navMenu || !navMenu.classList.contains("show")) return;
    if (!navMenu.contains(e.target) && e.target !== navUserIcon) closeNavMenu();
  });

  // ===== Friends menu (optional on some pages) =====
  const friendMenu = root.querySelector(".nav-friends");
  const friendsBtn = root.querySelector(
    ".left-sidebar-menu-items:nth-child(3)"
  );
  const closeFriendBtn = root.getElementById
    ? root.getElementById("close-friend-btn")
    : document.getElementById("close-friend-btn");

  if (friendMenu) friendMenu.setAttribute("aria-hidden", "true");

  function openFriendMenu() {
    if (!friendMenu) return;
    friendMenu.classList.add("show");
    friendMenu.setAttribute("aria-hidden", "false");
  }
  function closeFriendMenu() {
    if (!friendMenu) return;
    friendMenu.classList.remove("show");
    friendMenu.setAttribute("aria-hidden", "true");
  }

  friendsBtn?.addEventListener("click", openFriendMenu);
  closeFriendBtn?.addEventListener("click", closeFriendMenu);

  // ===== Events menu (optional on some pages) =====
  const eventMenu = root.querySelector(".event-menu");
  const eventsBtn = root.querySelector(".left-sidebar-menu-items:nth-child(4)");
  const closeEventBtn = root.getElementById
    ? root.getElementById("close-nav-event")
    : document.getElementById("close-nav-event");

  if (eventMenu) eventMenu.setAttribute("aria-hidden", "true");

  function openEventMenu() {
    if (!eventMenu) return;
    eventMenu.classList.add("show");
    eventMenu.setAttribute("aria-hidden", "false");
  }
  function closeEventMenu() {
    if (!eventMenu) return;
    eventMenu.classList.remove("show");
    eventMenu.setAttribute("aria-hidden", "true");
  }

  eventsBtn?.addEventListener("click", openEventMenu);
  closeEventBtn?.addEventListener("click", closeEventMenu);

  // ===== Logout =====
  if (logoutBtn) {
    logoutBtn.style.cursor = "pointer";
    logoutBtn.setAttribute("role", "button");
    logoutBtn.tabIndex = 0;

    logoutBtn.addEventListener("click", () => performLogout(navMenu));
    logoutBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        performLogout(navMenu);
      }
    });
  }
}

export function performLogout(navMenuEl) {
  try {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("name");
    localStorage.removeItem("avatarUrl");
    localStorage.removeItem("avatarVer");
    localStorage.removeItem("email");
  } catch (error) {
    console.warn("Could not clear storage:", error);
  } finally {
    if (navMenuEl) navMenuEl.style.display = "none";
    window.location.href = "index.html";
  }
}

// Auto-init when loaded directly as <script type="module" src="nav-menu.js">
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initNav());
} else {
  initNav();
}

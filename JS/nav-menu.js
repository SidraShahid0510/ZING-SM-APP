// nav-menu.js
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

  // ===== Friends menu  =====
  // ===== Friends menu  =====
  const friendMenu = root.querySelector(".nav-friends");

  // Scope the buttons to the nav menu so we hit the real tiles
  const friendsBtn = navMenu?.querySelectorAll(".left-sidebar-menu-items")?.[2];

  const closeFriendBtn = root.getElementById
    ? root.getElementById("close-friend-btn")
    : document.getElementById("close-friend-btn");

  if (friendMenu) {
    friendMenu.style.display = "none"; // start hidden just like navMenu
    friendMenu.setAttribute("aria-hidden", "true");
  }

  function openFriendMenu() {
    if (!friendMenu) return;
    friendMenu.style.display = "block"; // make it participate in layout
    requestAnimationFrame(() => {
      // allow CSS transition to kick
      friendMenu.classList.add("show");
      friendMenu.setAttribute("aria-hidden", "false");
    });
  }

  function closeFriendMenu() {
    if (!friendMenu) return;
    friendMenu.classList.remove("show");
    friendMenu.addEventListener(
      "transitionend",
      () => {
        friendMenu.style.display = "none";
        friendMenu.setAttribute("aria-hidden", "true");
      },
      { once: true }
    );
  }

  // Keep main nav open while using Friends
  friendsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openFriendMenu();
  });
  closeFriendBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeFriendMenu();
  });

  // ===== Events menu  =====
  const eventMenu = root.querySelector(".event-menu");
  const eventsBtn = navMenu?.querySelectorAll(".left-sidebar-menu-items")?.[3];

  const closeEventBtn = root.getElementById
    ? root.getElementById("close-nav-event")
    : document.getElementById("close-nav-event");

  if (eventMenu) {
    eventMenu.style.display = "none";
    eventMenu.setAttribute("aria-hidden", "true");
  }

  function openEventMenu() {
    if (!eventMenu) return;
    eventMenu.style.display = "block";
    requestAnimationFrame(() => {
      eventMenu.classList.add("show");
      eventMenu.setAttribute("aria-hidden", "false");
    });
  }
  function closeEventMenu() {
    if (!eventMenu) return;
    eventMenu.classList.remove("show");
    eventMenu.addEventListener(
      "transitionend",
      () => {
        eventMenu.style.display = "none";
        eventMenu.setAttribute("aria-hidden", "true");
      },
      { once: true }
    );
  }

  eventsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openEventMenu();
  });
  closeEventBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeEventMenu();
  });

  // ===== Keyboard + outside click =====
  // ESC closes small panels first, then the main menu
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (friendMenu?.classList.contains("show")) return void closeFriendMenu();
    if (eventMenu?.classList.contains("show")) return void closeEventMenu();
    closeNavMenu();
  });

  // Outside-click: ignore clicks inside the small panels so nav stays open
  document.addEventListener("click", (e) => {
    if (!navMenu || !navMenu.classList.contains("show")) return;
    const t = e.target;
    if (friendMenu?.contains(t) || eventMenu?.contains(t)) return; // keep nav open
    if (!navMenu.contains(t) && t !== navUserIcon) closeNavMenu();
  });

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

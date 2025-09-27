import {
  API_BASE,
  Noroff_API_Key,
  DEFAULT_AVATAR,
  DEFAULT_POST_IMAGE,
} from "./config.js";
import {
  fetchPosts,
  updatePost as updatePostApi,
  getSinglePost,
  deletePost as deletePostApi,
  createPost as createPostApi,
} from "./postsApi.js";
import { generatePosts } from "./render.js";
import { attachImgFallback, debounce } from "./utils.js";
import { reactThumbsUp } from "./reactionsApi.js";
import { followUser, unfollowUser } from "./followApi.js";

document.addEventListener("DOMContentLoaded", () => {
  /**
   * Add emoji “feelings” to a textarea from small preset buttons.
   * @param {NodeListOf<HTMLElement>} feelingOptions
   * @param {HTMLTextAreaElement|null} textareaElement
   * @param {HTMLElement|null} feelingsSection
   */
  function setupEmojiPicker(feelingOptions, textareaElement, feelingsSection) {
    if (!feelingOptions || !textareaElement || !feelingsSection) return;
    feelingOptions.forEach((feeling) => {
      feeling.addEventListener("click", () => {
        const emoji = feeling.querySelector("span")?.textContent || "";
        if (!emoji) return;
        textareaElement.value += emoji + " ";
        feelingsSection.style.display = "none";
        textareaElement.focus();
      });
    });
  }

  /**
   * Attach a small 🙂 button that opens post detail (used by render.js).
   * Exposed on window for cross-file use.
   * @param {HTMLElement|null} activityContainerEl
   * @param {string|number} postId
   */
  function attachOpenDetailSmiley(activityContainerEl, postId) {
    if (!activityContainerEl) return;
    const btn = document.createElement("button");
    btn.className = "activity-emoji-open-btn";
    btn.type = "button";
    btn.title = "React / comment with emoji";
    btn.innerHTML = `<i class="fa-solid fa-face-smile"></i>`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPostDetail(postId);
    });
    activityContainerEl.appendChild(btn);
  }
  // make available to render.js
  window.attachOpenDetailSmiley = attachOpenDetailSmiley;

  function insertAtCursor(el, text) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const val = el.value || "";
    el.value = val.slice(0, start) + text + val.slice(end);
    const pos = start + text.length;
    el.selectionStart = el.selectionEnd = pos;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /**
   * Simple emoji picker for the comment composer in the detail modal.
   * (Insert-only. Does NOT call the reactions API.)
   * @param {HTMLElement|null} modalRootEl
   */
  function setupCommentEmojiUI(modalRootEl) {
    if (!modalRootEl) return;

    const composer = modalRootEl.querySelector(".pd-write-comment");
    const textarea = modalRootEl.querySelector(".pd-comment-textarea");
    const sendBtn = modalRootEl.querySelector(".pd-send-comment");
    if (!composer || !textarea || !sendBtn) return;

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "pd-emoji-toggle";
    toggleBtn.title = "Insert emoji";
    toggleBtn.innerHTML = `<i class="fa-solid fa-face-smile"></i>`;
    sendBtn.insertAdjacentElement("beforebegin", toggleBtn);

    const panel = document.createElement("div");
    panel.className = "pd-emoji-panel";
    panel.style.display = "none";
    const emojis = [
      "😀",
      "😁",
      "😂",
      "🤣",
      "😊",
      "😍",
      "😎",
      "🥳",
      "👍",
      "👏",
      "🙌",
      "🤝",
      "🔥",
      "💯",
      "✨",
      "🌟",
      "😮",
      "😢",
      "🥲",
      "🤔",
      "😋",
      "🍕",
      "🍔",
      "🥞",
      "☕",
      "🍩",
    ];
    panel.innerHTML = emojis
      .map(
        (e) =>
          `<button type="button" class="pd-emoji-item" data-emoji="${e}">${e}</button>`
      )
      .join("");
    composer.insertAdjacentElement("afterend", panel);

    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.style.display = panel.style.display === "none" ? "flex" : "none";
    });

    panel.addEventListener("click", (e) => {
      const btn = e.target.closest(".pd-emoji-item");
      if (!btn) return;
      insertAtCursor(textarea, btn.dataset.emoji);
      panel.style.display = "none";
    });

    sendBtn.addEventListener("click", () => (panel.style.display = "none"));
    document.addEventListener("click", (evt) => {
      if (!modalRootEl.contains(evt.target)) panel.style.display = "none";
    });
    textarea.addEventListener("keydown", (evt) => {
      if (evt.key === "Escape") panel.style.display = "none";
    });
  }

  //Quick query cache-buster for images.
  function cacheBust(url) {
    if (!url) return DEFAULT_AVATAR;
    return url.includes("?")
      ? `${url}&_v=${Date.now()}`
      : `${url}?_v=${Date.now()}`;
  }

  //Update all places the avatar is shown on this page.
  function updateMyAvatarEverywhere(newUrlRaw) {
    const newUrl = cacheBust((newUrlRaw || "").trim());
    const me = localStorage.getItem("name") || "User";

    [
      "#nav-profile-img",
      "#nav-menu-img",
      "#create-profile-img",
      "#edit-profile-img",
      ".log-user-image img",
    ].forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        el.src = newUrl;
        el.alt = `${me}'s avatar`;
        el.onerror = () => {
          el.onerror = null;
          el.src = DEFAULT_AVATAR;
        };
      }
    });

    document.querySelectorAll(".write-post-section img").forEach((img) => {
      img.src = newUrl;
      img.onerror = () => {
        img.onerror = null;
        img.src = DEFAULT_AVATAR;
      };
    });

    document
      .querySelectorAll(".profile-post-container .post .user-profile img")
      .forEach((img) => {
        img.src = newUrl;
        img.onerror = () => {
          img.onerror = null;
          img.src = DEFAULT_AVATAR;
        };
      });

    const pdImg = document.querySelector(
      ".post-detail-container.active .pd-user-profile img"
    );
    if (pdImg) {
      pdImg.src = newUrl;
      pdImg.onerror = () => {
        pdImg.onerror = null;
        pdImg.src = DEFAULT_AVATAR;
      };
    }

    const editImg = document.querySelector(
      ".edit-post-container #edit-profile-img"
    );
    if (editImg) {
      editImg.src = newUrl;
      editImg.onerror = () => {
        editImg.onerror = null;
        editImg.src = DEFAULT_AVATAR;
      };
    }
  }

  /* ========================= Counts (posts / following) ========================= */

  const POST_COUNT_SELECTOR = "#posts-count";
  const FOLLOWING_COUNT_SELECTOR = "#following-count";

  /**
   * Fetch the logged-in user’s post count.
   * @param {string} username
   * @returns {Promise<number>}
   */
  async function fetchUserPostCount(username) {
    const token = localStorage.getItem("accessToken");
    if (!token || !username) return 0;
    try {
      const res = await fetch(
        `${API_BASE}/social/profiles/${encodeURIComponent(
          username
        )}/posts?_author=false&_comments=false&_reactions=false`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Noroff-API-Key": Noroff_API_Key,
          },
        }
      );
      const { data = [] } = await res.json();
      return Array.isArray(data) ? data.length : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Update the “Posts” counter text.
   * @param {number} count
   */
  function setPostCountText(count) {
    const el = document.querySelector(POST_COUNT_SELECTOR);
    if (el) el.textContent = String(count);
  }

  /**
   * Refresh the “Posts” counter for the logged-in user.
   * @returns {Promise<void>}
   */
  async function updateMyPostCount() {
    const me = localStorage.getItem("name");
    if (!me) return;
    const count = await fetchUserPostCount(me);
    setPostCountText(count);
  }

  /**
   * Fetch the logged-in user’s following count.
   * @param {string} username
   * @returns {Promise<number>}
   */
  async function fetchFollowingCount(username) {
    const token = localStorage.getItem("accessToken");
    if (!token || !username) return 0;
    try {
      const res = await fetch(
        `${API_BASE}/social/profiles/${encodeURIComponent(
          username
        )}?_followers=true&_following=true`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Noroff-API-Key": Noroff_API_Key,
          },
        }
      );
      const { data } = await res.json();
      return Array.isArray(data?.following) ? data.following.length : 0;
    } catch {
      return 0;
    }
  }

  //Update the “Following” counter text.
  function setFollowingCountText(count) {
    const el = document.querySelector(FOLLOWING_COUNT_SELECTOR);
    if (el) el.textContent = String(count);
  }

  //Refresh the “Following” counter for the logged-in user.
  async function updateMyFollowingCount() {
    const me = localStorage.getItem("name");
    if (!me) return;
    const count = await fetchFollowingCount(me);
    setFollowingCountText(count);
  }

  // Bump post count instantly on create/delete.
  function bumpMyPostCount(delta) {
    const el = document.querySelector("#posts-count");
    if (!el) return;
    const current = parseInt(el.textContent, 10) || 0;
    const next = Math.max(0, current + (delta || 0));
    el.textContent = String(next);
  }

  /* ========================= Avatar (fetch + update) ========================= */

  /**
   * Fetch and set the logged-in user avatar everywhere on this page.
   * @returns {Promise<void>}
   */
  async function fetchAndSetAvatar() {
    const username = localStorage.getItem("name");
    const token = localStorage.getItem("accessToken");
    if (!username || !token) return;

    try {
      const res = await fetch(
        `${API_BASE}/social/profiles/${encodeURIComponent(username)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Noroff-API-Key": Noroff_API_Key,
          },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch user profile");
      const { data } = await res.json();
      const avatarUrl = data?.avatar?.url || DEFAULT_AVATAR;

      const avatarContainer = document.querySelector(".log-user-image img");
      const displayName = localStorage.getItem("name") || "User";
      [
        "#nav-profile-img",
        "#nav-menu-img",
        "#create-profile-img",
        "#edit-profile-img",
      ].forEach((sel) => {
        const el = document.querySelector(sel);
        if (el) {
          el.src = avatarUrl;
          el.alt = `${displayName}'s avatar`;
          el.onerror = () => {
            el.onerror = null;
            el.src = DEFAULT_AVATAR;
          };
        }
      });
      const navUsernameEl = document.getElementById("nav-username");
      if (navUsernameEl) navUsernameEl.textContent = displayName;

      if (avatarContainer) {
        avatarContainer.src = avatarUrl;
        avatarContainer.alt = `${username}'s avatar`;
        avatarContainer.onerror = () => {
          avatarContainer.onerror = null;
          avatarContainer.src = DEFAULT_AVATAR;
        };
      }

      window.currentAvatarUrl = (avatarUrl || "").trim();
      localStorage.setItem("avatarUrl", window.currentAvatarUrl);
      updateMyAvatarEverywhere(window.currentAvatarUrl);
    } catch (err) {
      console.error("Error fetching avatar:", err);
    }
  }
  //Persist avatar URL to the API.
  async function saveAvatarToApi(url) {
    const username = localStorage.getItem("name");
    const token = localStorage.getItem("accessToken");
    if (!username || !token) return false;
    const res = await fetch(
      `${API_BASE}/social/profiles/${encodeURIComponent(username)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Noroff-API-Key": Noroff_API_Key,
        },
        body: JSON.stringify({ avatar: { url } }),
      }
    );
    return res.ok;
  }
  //Apply avatar URL (preview, cache, persist, update DOM).
  async function applyAvatarUrl(raw) {
    const url = (raw || "").trim();
    if (!url) {
      avatarImg.src = DEFAULT_AVATAR;
      avatarUrlInput.style.display = "none";
      return;
    }

    avatarImg.src = url;
    avatarImg.onerror = () => {
      avatarImg.onerror = null;
      avatarImg.src = DEFAULT_AVATAR;
    };

    window.currentAvatarUrl = url;
    localStorage.setItem("avatarUrl", url);
    updateMyAvatarEverywhere(url);

    const ok = await saveAvatarToApi(url);
    if (!ok) console.warn("Avatar not saved to API.");

    const username = localStorage.getItem("name") || "User";
    [
      "#nav-profile-img",
      "#nav-menu-img",
      "#create-profile-img",
      "#edit-profile-img",
      ".log-user-image img",
    ].forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        el.src = window.currentAvatarUrl || DEFAULT_AVATAR;
        el.alt = `${username}'s avatar`;
        el.onerror = () => {
          el.onerror = null;
          el.src = DEFAULT_AVATAR;
        };
      }
    });

    avatarUrlInput.style.display = "none";
  }

  // Update avatar by URL UI
  const updateImageTrigger = document.querySelector(".update-login-user p");
  const avatarUrlInput = document.getElementById("update-user");
  const avatarImg = document.querySelector(".log-user-image img");
  if (updateImageTrigger && avatarUrlInput && avatarImg) {
    updateImageTrigger.style.cursor = "pointer";
    updateImageTrigger.addEventListener("click", () => {
      avatarUrlInput.style.display = "block";
      avatarUrlInput.focus();
    });
    avatarUrlInput.addEventListener("input", () => {
      const url = (avatarUrlInput.value || "").trim();
      avatarImg.src = url || DEFAULT_AVATAR;
    });
    avatarUrlInput.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        await applyAvatarUrl(avatarUrlInput.value);
      }
    });
    avatarUrlInput.addEventListener("blur", async () => {
      await applyAvatarUrl(avatarUrlInput.value);
    });
  }

  /* ========================= Banner + Bio ========================= */

  const DEFAULT_BANNER = "images/default-banner.jpg";
  const bannerImg = document.getElementById("profile-banner-img");
  const editBtn = document.getElementById("edit-cover-btn");
  const editContainer = document.getElementById("edit-cover-container");
  const bannerInput = document.getElementById("banner-Url-input");
  const saveBtn = document.getElementById("save-banner-btn");

  const bioForm = document.getElementById("bioForm");
  const bioTextarea = document.getElementById("bio");
  const statusText = document.getElementById("status");
  const bioFormContainer = document.getElementById("bioFormContainer");
  const bioDisplayContainer = document.getElementById("bioDisplayContainer");
  const bioText = document.getElementById("bioText");
  const editBioBtn = document.getElementById("editBioBtn");

  if (editContainer) editContainer.classList.add("hidden");

  /** @param {string} url */
  function setBanner(url) {
    if (bannerImg) bannerImg.src = url || DEFAULT_BANNER;
  }

  /** Load banner from API. */
  async function loadBanner() {
    const currentUser = localStorage.getItem("name");
    const token = localStorage.getItem("accessToken");
    if (!currentUser || !token) {
      setBanner("");
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/social/profiles/${encodeURIComponent(currentUser)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Noroff-API-Key": Noroff_API_Key,
          },
        }
      );
      if (!res.ok) throw new Error("Failed to load banner");
      const json = await res.json();
      setBanner(json.data?.banner?.url || "");
    } catch (e) {
      console.error("Banner fetch failed", e);
      setBanner("");
    }
  }

  //Update banner URL in API and on page.
  async function updateBanner(url) {
    const currentUser = localStorage.getItem("name");
    const token = localStorage.getItem("accessToken");
    if (!currentUser || !token) return;
    try {
      const res = await fetch(
        `${API_BASE}/social/profiles/${encodeURIComponent(currentUser)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Noroff-API-Key": Noroff_API_Key,
          },
          body: JSON.stringify({ banner: { url } }),
        }
      );
      if (!res.ok) throw new Error("Failed to update banner");
      setBanner(url);
    } catch (e) {
      console.error("Banner update failed", e);
    }
  }

  // Edit banner UI
  editBtn?.addEventListener("click", () => {
    editContainer.classList.remove("hidden");
    bannerInput.focus();
    editBtn.classList.add("hidden");
  });
  saveBtn?.addEventListener("click", () => {
    const url = bannerInput.value.trim();
    if (!url) return alert("Enter a valid URL");
    updateBanner(url);
    editContainer.classList.add("hidden");
    bannerInput.value = "";
    editBtn.classList.remove("hidden");
  });

  loadBanner();

  /* ========================= My posts list + search ========================= */

  /** @type {Array<any>} */
  let myPostsCache = [];

  //Show “No Post yet” empty state.
  function showNoPosts(container, text = "No Post yet") {
    if (!container) return;
    container.innerHTML = `
      <div class="empty-posts" style="display:grid;place-items:center;padding:2rem;color:#777;">
        <p>${text}</p>
      </div>`;
  }

  //Filter my posts by query (title/body/author).
  function filterMyPosts(queryString) {
    const q = (queryString || "").trim().toLowerCase();
    if (!q) return myPostsCache;
    return myPostsCache.filter((post) => {
      const t = (post.title || "").toLowerCase();
      const b = (post.body || "").toLowerCase();
      const a = (post.author?.name || "").toLowerCase();
      return t.includes(q) || b.includes(q) || a.includes(q);
    });
  }

  function setupProfileSearch(containerEl) {
    const inputEl =
      document.getElementById("nav-search") ||
      document.querySelector(".search-box input");
    if (!inputEl || !containerEl) return;

    const performSearch = debounce(() => {
      const filtered = filterMyPosts(
        (inputEl.value || "").toLowerCase().trim()
      );
      generatePosts(filtered, containerEl);
    }, 200);

    inputEl.addEventListener("input", performSearch);
    inputEl.addEventListener("keydown", (evt) => {
      if (evt.key === "Escape") {
        inputEl.value = "";
        performSearch();
      }
    });
  }

  //Fetch my profile and render my posts.
  async function fetchAndApplyProfile() {
    const currentUser = localStorage.getItem("name");
    const token = localStorage.getItem("accessToken");
    const profileFeed = document.querySelector(".profile-post-container");
    if (!currentUser || !token) {
      console.error("User not logged in");
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/social/profiles/${encodeURIComponent(
          currentUser
        )}?_followers=true&_following=true`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Noroff-API-Key": Noroff_API_Key,
          },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch profile data");
      const { data: profile } = await res.json();

      const usernameP = document.querySelector(".profile-username p");
      if (usernameP) usernameP.textContent = profile.name || "User";

      if (bannerImg) {
        bannerImg.src = profile.banner?.url || DEFAULT_BANNER;
        bannerImg.onerror = () => (bannerImg.src = DEFAULT_BANNER);
      }

      if (profileFeed) {
        profileFeed.innerHTML = "";
        const myPosts = await fetchPosts(false); // only my posts
        myPostsCache = myPosts.slice();
        if (myPosts.length === 0) {
          showNoPosts(profileFeed, "No Post yet");
        } else {
          generatePosts(myPosts, profileFeed);
        }
        setupProfileSearch(profileFeed);
        await updateMyPostCount();
        await updateMyFollowingCount();
      }
    } catch (err) {
      console.error("Error loading profile data:", err);
    }
  }

  fetchAndApplyProfile();

  /* ========================= Bio edit ========================= */

  const STATUS_DISPLAY_MS = 2500;
  let statusTimeoutId = null;

  /** Show the bio form. */
  function showForm() {
    if (!bioFormContainer || !bioDisplayContainer) return;
    bioFormContainer.style.display = "block";
    bioDisplayContainer.style.display = "none";
    if (statusText) statusText.textContent = "";
  }

  /** Show the non-edit bio view. */
  function showBioView() {
    if (!bioFormContainer || !bioDisplayContainer) return;
    bioFormContainer.style.display = "none";
    bioDisplayContainer.style.display = "block";
  }

  /** Load bio from API or local storage. */
  async function loadBio() {
    const currentUser = localStorage.getItem("name");
    const token = localStorage.getItem("accessToken");
    if (!currentUser || !token) {
      showForm();
      if (bioTextarea) bioTextarea.value = "";
      return;
    }

    const lsKey = `bio_${currentUser}`;
    const saved = localStorage.getItem(lsKey);
    if (saved) {
      if (bioText) bioText.textContent = saved;
      showBioView();
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/social/profiles/${encodeURIComponent(currentUser)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Noroff-API-Key": Noroff_API_Key,
          },
        }
      );
      const { data } = await res.json();
      if (bioText) bioText.textContent = data.bio || "";
      localStorage.setItem(lsKey, data.bio || "");
      showBioView();
    } catch (e) {
      console.error("Error loading bio:", e);
      showForm();
    }
  }

  async function saveBio(e) {
    e.preventDefault();
    const currentUser = localStorage.getItem("name");
    const token = localStorage.getItem("accessToken");
    if (!currentUser || !token) return;

    try {
      const newBio = (bioTextarea?.value || "").trim();
      const res = await fetch(
        `${API_BASE}/social/profiles/${encodeURIComponent(currentUser)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Noroff-API-Key": Noroff_API_Key,
          },
          body: JSON.stringify({ bio: newBio }),
        }
      );
      if (!res.ok) throw new Error("Failed to update bio");

      localStorage.setItem(`bio_${currentUser}`, newBio);
      if (bioText) bioText.textContent = newBio;
      showBioView();
      if (statusText) {
        statusText.textContent = "Bio updated!";
        clearTimeout(statusTimeoutId);
        statusTimeoutId = setTimeout(
          () => (statusText.textContent = ""),
          STATUS_DISPLAY_MS
        );
      }
    } catch (e) {
      console.error("Error updating bio:", e);
      if (statusText) statusText.textContent = "Error saving bio.";
    }
  }

  bioForm?.addEventListener("submit", saveBio);
  editBioBtn?.addEventListener("click", showForm);
  loadBio();

  /* ========================= Edit / Delete / Like / Comment ========================= */

  // Edit modal refs
  const editPostContainer = document.querySelector(".edit-post-container");
  const editCloseBtn = document.getElementById("close-edit");
  const editTitleInput = editPostContainer?.querySelector("#edit-post-title");
  const editTextarea = editPostContainer?.querySelector(".edit-txt textarea");
  const editImageInput = editPostContainer?.querySelector("#edit-image-url");
  const editPreviewImg = editPostContainer?.querySelector(
    ".edit-url-img-div img"
  );
  const editUrlImageDiv = editPostContainer?.querySelector(".edit-url-img-div");
  const saveEditBtn = editPostContainer?.querySelector(".edit-post-btn");
  const editFeelingsSection = document.querySelector(".edit-feelings-section");
  const editFeelingOptions = editFeelingsSection?.querySelectorAll(".feeling");
  const editCloseFeelingsBtn = document.getElementById("close-edit-feelings");
  const editFeelingsIcon = document.querySelector(
    ".edit-activity-icons .fa-face-smile"
  );

  // feelings in edit modal
  setupEmojiPicker(editFeelingOptions, editTextarea, editFeelingsSection);
  editFeelingsIcon?.addEventListener("click", () => {
    if (editFeelingsSection) editFeelingsSection.style.display = "flex";
  });
  editCloseFeelingsBtn?.addEventListener("click", () => {
    if (editFeelingsSection) editFeelingsSection.style.display = "none";
  });

  // edit image UI
  const editImageIcon = editPostContainer?.querySelector(
    ".edit-activity-icons .fa-image"
  );
  editImageIcon?.addEventListener("click", () => {
    if (!editImageInput) return;
    editImageInput.style.display = "block";
    editImageInput.focus();
  });
  editImageInput?.addEventListener("input", () => {
    const url = (editImageInput?.value || "").trim();
    if (!editPreviewImg || !editUrlImageDiv) return;
    if (url) {
      editPreviewImg.src = url;
      editUrlImageDiv.style.display = "block";
    } else {
      editPreviewImg.src = "";
      editUrlImageDiv.style.display = "none";
    }
  });
  editCloseBtn?.addEventListener("click", () => {
    if (!editPostContainer) return;
    editPostContainer.classList.remove("active");
    document.body.style.overflow = "";
  });
  const editRemoveImgBtn = editPostContainer?.querySelector("#edit-remove-img");
  editRemoveImgBtn?.addEventListener("click", () => {
    if (!editPreviewImg || !editImageInput || !editUrlImageDiv) return;
    editPreviewImg.src = "";
    editImageInput.value = "";
    editUrlImageDiv.style.display = "none";
    editImageInput.style.display = "none";
  });

  //Save edited post to API, close modal, refresh my feed.
  async function updatePost(postId, container) {
    const root = container || document.querySelector(".profile-post-container");
    if (!postId || !root) return;

    const token = localStorage.getItem("accessToken");
    if (!token) {
      alert("You must be logged in to edit posts.");
      return;
    }

    const payload = {
      title: (editTitleInput?.value || "").trim() || "Untitled Post",
      body: (editTextarea?.value || "").trim(),
    };
    const img = (editImageInput?.value || "").trim();
    if (img) payload.media = { url: img, alt: "post image" };

    try {
      await updatePostApi(postId, payload);
      editPostContainer?.classList.remove("active");
      document.body.style.overflow = "";

      const myPosts = await fetchPosts(false);
      generatePosts(myPosts, root);
    } catch (err) {
      console.error("Update failed:", err);
      alert("Failed to update post");
    }
  }

  // Save button in edit modal
  saveEditBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    const postId = editPostContainer?.dataset?.editingPostId;
    if (!postId) {
      console.warn("No post selected for editing.");
      return;
    }
    updatePost(postId, document.querySelector(".profile-post-container"));
  });

  // Delete a post and refresh my feed (and counts).
  async function deletePost(postId, container) {
    if (!postId) return;
    const root = container || document.querySelector(".profile-post-container");
    const token = localStorage.getItem("accessToken");
    if (!token) {
      alert("You must be logged in to delete posts.");
      return;
    }
    try {
      await deletePostApi(postId);
      bumpMyPostCount(-1);

      const detail = document.querySelector(".post-detail-container");
      if (detail?.classList.contains("active")) {
        detail.classList.remove("active");
        document.body.style.overflow = "";
        const content = detail.querySelector(".post-detail-content");
        if (content) content.innerHTML = "";
      }

      const myPosts = await fetchPosts(false);
      if (myPosts.length === 0) {
        showNoPosts(root, "No Post yet");
      } else {
        generatePosts(myPosts, root);
      }

      if (typeof updateMyPostCount === "function") await updateMyPostCount();
      console.log(`Post ${postId} deleted.`);
    } catch (err) {
      console.error("Failed to delete post:", err);
      alert("Failed to delete post");
    }
  }
  // expose if needed elsewhere
  window.deletePost = deletePost;

  //Toggle 👍 reaction and update the pressed button UI in place.
  async function toggleLike(postId, btnEl) {
    try {
      await reactThumbsUp(postId);

      const countEl =
        btnEl.querySelector(".activity-like-count") ||
        btnEl.querySelector(".pd-like-count");

      if (countEl) {
        const isActive = btnEl.classList.contains("active");
        btnEl.classList.toggle("active", !isActive);
        btnEl.setAttribute("aria-pressed", String(!isActive));
        let count = parseInt(countEl.textContent, 10) || 0;
        count = !isActive ? count + 1 : Math.max(0, count - 1);
        countEl.textContent = String(count);
      }
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  }
  window.toggleLike = toggleLike;

  async function toggleFollow(usernameToToggle, btnEl) {
    if (!usernameToToggle || !btnEl) return;
    const isFollowing = btnEl.classList.contains("following");
    try {
      const ok = isFollowing
        ? await unfollowUser(usernameToToggle)
        : await followUser(usernameToToggle);
      if (!ok) return;

      const newText = isFollowing ? "Follow" : "Following";
      document
        .querySelectorAll(
          `.follow-text[data-author="${usernameToToggle}"], .pd-follow-text[data-author="${usernameToToggle}"]`
        )
        .forEach((b) => {
          b.textContent = newText;
          b.classList.toggle("following", !isFollowing);
          b.setAttribute("aria-pressed", String(!isFollowing));
        });

      if (!isFollowing) {
        // followed
        if (typeof window.incrementFollowingCount === "function") {
          window.incrementFollowingCount();
        } else {
          await updateMyFollowingCount();
        }
      } else {
        // unfollowed
        if (typeof window.decrementFollowingCount === "function") {
          window.decrementFollowingCount();
        } else {
          await updateMyFollowingCount();
        }
      }
    } catch (e) {
      console.error("toggleFollow failed:", e);
    }
  }
  window.toggleFollow = toggleFollow;

  // Send a comment from the modal and refresh counts/UI.
  async function sendComment(postId, textareaEl) {
    const token = localStorage.getItem("accessToken");
    const text = (textareaEl?.value || "").trim();
    if (!token || !postId || !text) return;

    try {
      const res = await fetch(
        `${API_BASE}/social/posts/${encodeURIComponent(postId)}/comment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Noroff-API-Key": Noroff_API_Key,
          },
          body: JSON.stringify({ body: text }),
        }
      );
      if (!res.ok) throw new Error("Failed to send comment");

      textareaEl.value = "";
      const fresh = await getSinglePost(postId);
      renderPostDetail(fresh);
      syncCardCountsFromPost(fresh);
    } catch (e) {
      console.error("sendComment failed:", e);
    }
  }

  function syncCardCountsFromPost(post) {
    if (!post || !post.id) return;
    const card = document.querySelector(
      `.profile-post-container .post[data-post-id="${post.id}"]`
    );
    if (!card) return;

    const likeEl = card.querySelector(".activity-like-count");
    const comEl = card.querySelector(".activity-comment-num");

    if (likeEl) likeEl.textContent = String(post._count?.reactions ?? 0);
    if (comEl) comEl.textContent = String(post._count?.comments ?? 0);
  }

  /* ========================= Create Post (same UX as feed) ========================= */

  const writePostSection = document.querySelector(".write-post-section");
  const createPostContainer = document.querySelector(".create-post-container");
  const closeCreateBtn = document.getElementById("close-create");

  const imageIcon = document.querySelector(".create-activity-icons .fa-image");
  const imageUrlInput = document.getElementById("image-url");
  const urlImageDiv = document.querySelector(".url-img-div");
  const previewImg = urlImageDiv ? urlImageDiv.querySelector("img") : null;
  const removeImgBtn = document.getElementById("remove-img");

  const postBtn = document.querySelector(".create-post-btn");
  const textarea = document.querySelector(".create-txt textarea");
  const titleInput = document.getElementById("post-title");

  const feelingsSection = document.querySelector(".feelings-section");
  const feelingsIcon = document.querySelector(
    ".create-activity-icons .fa-face-smile"
  );
  const closeFeelingsBtn = document.getElementById("close-feelings");
  const feelingOptions = feelingsSection?.querySelectorAll(".feeling");

  setupEmojiPicker(feelingOptions, textarea, feelingsSection);

  // open modal and inject avatar/username
  writePostSection?.addEventListener("click", () => {
    createPostContainer?.classList.add("active");
    document.body.style.overflow = "hidden";

    // 👉 reset the CREATE composer to a clean state
    const t = document.getElementById("post-title");
    const ta = document.querySelector(".create-txt textarea");
    const img = document.getElementById("image-url");
    const urlDiv = document.querySelector(".url-img-div");
    const prev = urlDiv?.querySelector("img");
    const feelings = document.querySelector(".feelings-section");

    if (t) t.value = "";
    if (ta) ta.value = "";
    if (img) {
      img.value = "";
      img.style.display = "none";
    }
    if (prev) prev.src = "";
    if (urlDiv) urlDiv.style.display = "none";
    if (feelings) feelings.style.display = "none";

    // set avatar + username (keep your existing code)
    const createImg = document.getElementById("create-profile-img");
    if (createImg) {
      createImg.src = currentAvatarUrl || DEFAULT_AVATAR;
      createImg.onerror = () => {
        createImg.onerror = null;
        createImg.src = DEFAULT_AVATAR;
      };
    }
    const nameEl = document.getElementById("create-username");
    if (nameEl) nameEl.textContent = localStorage.getItem("name") || "User";
  });

  closeCreateBtn?.addEventListener("click", () => {
    createPostContainer?.classList.remove("active");
    document.body.style.overflow = "";
  });

  // image URL preview + remove
  if (imageIcon && imageUrlInput && urlImageDiv && previewImg && removeImgBtn) {
    imageIcon.addEventListener("click", () => {
      imageUrlInput.style.display = "block";
      imageUrlInput.focus();
    });
    imageUrlInput.addEventListener("input", () => {
      const url = imageUrlInput.value.trim();
      if (url) {
        previewImg.src = url;
        urlImageDiv.style.display = "block";
      } else {
        urlImageDiv.style.display = "none";
        previewImg.src = "";
      }
    });
    removeImgBtn.addEventListener("click", () => {
      previewImg.src = "";
      imageUrlInput.value = "";
      urlImageDiv.style.display = "none";
      imageUrlInput.style.display = "none";
    });
  }

  // feelings in create modal
  if (feelingsIcon && feelingsSection && closeFeelingsBtn) {
    feelingsIcon.addEventListener("click", () => {
      feelingsSection.style.display = "flex";
    });
    closeFeelingsBtn.addEventListener("click", () => {
      feelingsSection.style.display = "none";
    });
  }

  /**
   * Create a new post from this page and refresh my posts only.
   * @returns {Promise<void>}
   */
  async function createPostLoginUser() {
    const postText = (textarea?.value || "").trim();
    const rawImageUrl = (imageUrlInput?.value || "").trim();
    const hasImage = !!rawImageUrl;

    if (!postText && !hasImage) {
      console.warn("Cannot create an empty post.");
      return;
    }
    const token = localStorage.getItem("accessToken");
    if (!token) {
      console.error("No access token found. Please login first.");
      return;
    }

    const payload = {
      title: (titleInput?.value || "").trim() || "Untitled Post",
      body: postText,
      ...(hasImage ? { media: { url: rawImageUrl, alt: "post image" } } : {}),
    };

    try {
      const created = await createPostApi(payload);
      if (!created) return;

      bumpMyPostCount(+1);

      if (textarea) textarea.value = "";
      if (titleInput) titleInput.value = "";
      if (imageUrlInput) imageUrlInput.value = "";
      if (previewImg) previewImg.src = "";
      if (urlImageDiv) urlImageDiv.style.display = "none";
      if (imageUrlInput) imageUrlInput.style.display = "none";
      createPostContainer?.classList.remove("active");
      document.body.style.overflow = "";

      const profileFeed = document.querySelector(".profile-post-container");
      if (profileFeed) {
        const myPosts = await fetchPosts(false);
        generatePosts(myPosts, profileFeed);
      }
    } catch (err) {
      console.error("Error creating post:", err);
    }
  }
  postBtn?.addEventListener("click", createPostLoginUser);

  /* ========================= Detail modal (open/render) ========================= */

  const postDetailContainer = document.querySelector(".post-detail-container");
  const postDetailContent = postDetailContainer?.querySelector(
    ".post-detail-content"
  );
  const closePostDetailBtn = document.getElementById("close-post-detail");

  closePostDetailBtn?.addEventListener("click", () => {
    postDetailContainer?.classList.remove("active");
    if (postDetailContent) postDetailContent.innerHTML = "";
    document.body.style.overflow = "";
  });

  /**
   * Render a post in the detail modal.
   * @param {any} post
   */
  function renderPostDetail(post) {
    const currentUsername = localStorage.getItem("name") || "User";
    const feeling = post.feeling || "";
    const likeCount = post._count?.reactions ?? 0;
    const commentCount = post._count?.comments ?? 0;
    const postImg = post.media?.url || "";
    const isOwnPost = post.author?.name === currentUsername;

    const authorAvatar = isOwnPost
      ? window.currentAvatarUrl || DEFAULT_AVATAR
      : post.author?.avatar?.url || DEFAULT_AVATAR;

    postDetailContent.innerHTML = `
      <div class="pd-header">
        <div class="pd-user-profile">
          <img src="${authorAvatar}" alt="profile" />
          <div>
            <div class="author-row">
              <p class="pd-author-name">${post.author?.name || "unknown"}${
      feeling ? ` is ${feeling}` : ""
    }</p>
            </div>
            <span>${new Date(post.created).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <h2 class="pd-title">${post.title || "Untitled Post"}</h2>
      <p class="pd-text">${post.body || ""}</p>
      ${
        postImg
          ? `<img src="${postImg}" class="pd-img" alt="post image" />`
          : ""
      }

      <div class="pd-activity" data-post-id="${post.id}">
        <button class="pd-like-btn" type="button" aria-pressed="false">
          <i class="fa-solid fa-thumbs-up"></i>
          <span class="pd-like-count">${likeCount}</span>
        </button>
        <button class="pd-comment-count" type="button">
          <i class="fa-solid fa-comment"></i>
          <span class="pd-comment-num">${commentCount}</span>
        </button>
        <button class="pd-share-btn" type="button"><i class="fa-solid fa-share"></i></button>
      </div>

      <div class="pd-write-comment">
        <img src="${
          window.currentAvatarUrl || DEFAULT_AVATAR
        }" alt="${currentUsername}" />
        <textarea class="pd-comment-textarea" placeholder="write your comment"></textarea>
        <button class="pd-send-comment" type="button" title="Send">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </div>

      <div class="pd-comments">
        ${
          Array.isArray(post.comments) && post.comments.length
            ? post.comments
                .map(
                  (c) => `
            <div class="pd-comment" data-comment-id="${c.id}">
              <img src="${
                c.author?.name === currentUsername
                  ? window.currentAvatarUrl || DEFAULT_AVATAR
                  : c.author?.avatar?.url || DEFAULT_AVATAR
              }" alt="${c.author?.name || "unknown"}" />
              <div>
                <p class="pd-comment-author">${c.author?.name || "unknown"}</p>
                <p class="pd-comment-body">${c.body || ""}</p>
                <span class="pd-comment-time">${new Date(
                  c.created
                ).toLocaleString()}</span>
              </div>
            </div>`
                )
                .join("")
            : `<p class="pd-no-comments">No comments yet.</p>`
        }
      </div>
    `;

    setupCommentEmojiUI(postDetailContent);

    const pdUserProfile = postDetailContent.querySelector(".pd-user-profile");
    if (pdUserProfile && post.author?.name) {
      pdUserProfile.addEventListener("click", () => {
        const me = localStorage.getItem("name");
        if (post.author.name === me) {
          window.location.href = "login-user.html";
        } else {
          window.location.href = `user-profile.html?username=${encodeURIComponent(
            post.author.name
          )}`;
        }
      });
    }

    const likeBtn = postDetailContent.querySelector(".pd-like-btn");
    likeBtn?.addEventListener("click", async () => {
      await toggleLike(post.id, likeBtn);
      try {
        const fresh = await getSinglePost(post.id);
        syncCardCountsFromPost(fresh);
      } catch {}
    });

    const sendBtn = postDetailContent.querySelector(".pd-send-comment");
    const ta = postDetailContent.querySelector(".pd-comment-textarea");
    sendBtn?.addEventListener("click", () => sendComment(post.id, ta));
    ta?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendComment(post.id, ta);
      }
    });

    attachImgFallback(
      postDetailContent.querySelector(".pd-user-profile img"),
      DEFAULT_AVATAR
    );
    attachImgFallback(
      postDetailContent.querySelector(".pd-img"),
      DEFAULT_POST_IMAGE
    );
  }

  /**
   * Fetch + open a post in the detail modal.
   * @param {string|number} postId
   * @returns {Promise<void>}
   */
  async function openPostDetail(postId) {
    try {
      const post = await getSinglePost(postId);
      renderPostDetail(post);
      postDetailContainer?.classList.add("active");
      document.body.style.overflow = "hidden";
    } catch (err) {
      console.error("Failed to open post detail:", err);
    }
  }
  window.openPostDetail = openPostDetail;

  /* ========================= Boot ========================= */

  fetchAndSetAvatar();
  loadBio();
});

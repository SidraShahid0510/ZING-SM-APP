import {
  API_BASE,
  Noroff_API_Key,
  DEFAULT_AVATAR,
  DEFAULT_POST_IMAGE,
} from "../config.js";
import { attachImgFallback, debounce } from "../utils.js";
import { getSinglePost } from "../postsApi.js";
import { reactThumbsUp } from "../reactionsApi.js";

const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get("username");

// Auth + current user
const accessToken = localStorage.getItem("accessToken");
const loggedInUsername = localStorage.getItem("name") || "User";

/**
 * Build auth headers for Noroff API calls.
 * @param {Record<string,string>} [extra] Extra headers (merged in)
 * @returns {Record<string,string>}
 */
function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "X-Noroff-API-Key": Noroff_API_Key,
    ...extra,
  };
}

//Cached avatar for the logged-in user (used in nav + commenting).
let currentUserAvatarUrl = DEFAULT_AVATAR;

// ============================ Navbar (logged-in user) ============================

/**
 * Fetch the avatar URL for the *logged-in* user and cache it locally.
 * @returns {Promise<string>} Resolved avatar URL (or default)
 */
async function fetchLoggedInAvatar() {
  const me = localStorage.getItem("name");
  if (!me || !accessToken) {
    currentUserAvatarUrl = DEFAULT_AVATAR;
    return currentUserAvatarUrl;
  }
  try {
    const res = await fetch(
      `${API_BASE}/social/profiles/${encodeURIComponent(me)}`,
      { headers: authHeaders() },
    );
    if (!res.ok) throw new Error("avatar fetch failed");
    const { data } = await res.json();
    currentUserAvatarUrl =
      (data?.avatar?.url || DEFAULT_AVATAR).trim() || DEFAULT_AVATAR;
  } catch {
    currentUserAvatarUrl = DEFAULT_AVATAR;
  }
  return currentUserAvatarUrl;
}

/**
 * Populate the navbar with the logged-in user’s name + avatar.
 * @returns {Promise<void>}
 */
async function loadNavbarProfile() {
  const navProfileImg = document.getElementById("nav-profile-img");
  const navMenuImg = document.getElementById("nav-menu-img");
  const navUsernameEl = document.getElementById("nav-username");
  const seeProfileLink = document.querySelector(".nav-menu-info a");

  if (navUsernameEl) navUsernameEl.textContent = loggedInUsername;

  if (seeProfileLink && loggedInUsername && loggedInUsername !== "User") {
    seeProfileLink.href = `user-profile.html?username=${encodeURIComponent(
      loggedInUsername,
    )}`;
  }

  await fetchLoggedInAvatar();

  [navProfileImg, navMenuImg].forEach((img) => {
    if (!img) return;
    img.alt = `${loggedInUsername}'s avatar`;
    img.src = currentUserAvatarUrl || DEFAULT_AVATAR;
    attachImgFallback(img, DEFAULT_AVATAR);
  });
}

// ============================ Left column: profile header ============================

const avatarEl = document.querySelector(".log-user-image img");
const usernameEl = document.querySelector(".profile-username p");
const bioTextEl = document.getElementById("bioText");
const bannerImgEl =
  document.querySelector("#profile-banner-img") ||
  document.querySelector(".profile-banner img");

//Show the user’s bio text (or a default if empty).

function setBioText(bio) {
  const text = (bio ?? "").trim();
  if (bioTextEl)
    bioTextEl.textContent = text.length ? text : "no bio available";
}

// set the profile banner image.

function setBannerImage(bannerObj, displayName = "Profile Banner") {
  if (!bannerImgEl) return;
  const url = bannerObj?.url?.trim();
  bannerImgEl.src = url && url !== "" ? url : "images/default-banner.jpg";
  bannerImgEl.alt = `${displayName}'s banner`;
  bannerImgEl.onerror = () => {
    bannerImgEl.onerror = null;
    bannerImgEl.src = "images/default-banner.jpg";
  };
}

/**
 * Load the viewed user’s profile info (name, avatar, bio, banner).
 * @returns {Promise<void>}
 */
async function loadUserInfo() {
  if (!username) return;
  try {
    const res = await fetch(
      `${API_BASE}/social/profiles/${encodeURIComponent(username)}`,
      { headers: authHeaders() },
    );
    if (!res.ok) throw new Error("Failed to load profile");
    const { data } = await res.json();

    if (usernameEl) usernameEl.textContent = data.name;

    if (avatarEl) {
      const src =
        (data?.avatar?.url || DEFAULT_AVATAR).trim() || DEFAULT_AVATAR;
      avatarEl.src = src;
      avatarEl.alt = `${data?.name || "User"}'s avatar`;
      attachImgFallback(avatarEl, DEFAULT_AVATAR);
    }

    setBioText(data.bio);
    setBannerImage(data.banner, data.name);
  } catch (error) {
    console.error("Error fetching user info:", error);
    setBioText("");
  }
}

// ============================ Counts for viewed user ============================

// fetch the viewed user's post count
async function fetchOtherUserPostCount(name) {
  try {
    const res = await fetch(
      `${API_BASE}/social/profiles/${encodeURIComponent(
        name,
      )}/posts?_author=false&_comments=false&_reactions=false`,
      { headers: authHeaders() },
    );
    const { data = [] } = await res.json();
    return Array.isArray(data) ? data.length : 0;
  } catch (e) {
    console.error("fetchOtherUserPostCount error:", e);
    return 0;
  }
}

//Update the “Posts” counter for the viewed user.
async function updateOtherUserPostCount(name) {
  try {
    const count = await fetchOtherUserPostCount(name);
    const el = document.querySelector("#posts-count");
    if (el) el.textContent = String(count);
  } catch (e) {
    console.error("updateOtherUserPostCount error:", e);
  }
}

//Fetch the viewed user’s following count.
async function fetchOtherUserFollowingCount(name) {
  try {
    const res = await fetch(
      `${API_BASE}/social/profiles/${encodeURIComponent(
        name,
      )}?_followers=true&_following=true`,
      { headers: authHeaders() },
    );
    if (!res.ok) throw new Error("following fetch failed");
    const { data } = await res.json();
    return Array.isArray(data?.following) ? data.following.length : 0;
  } catch (e) {
    console.error("fetchOtherUserFollowingCount error:", e);
    return 0;
  }
}

//Update the “Following” counter for the viewed user.
async function updateOtherUserFollowingCount(name) {
  const el = document.querySelector("#following-count");
  if (!el) return;
  el.textContent = String(await fetchOtherUserFollowingCount(name));
}
// show no post function
function showNoPosts(container, text = "No Post yet") {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-posts" style="display:grid;place-items:center;padding:2rem;color:#777;">
      <p>${text}</p>
    </div>`;
}

/* ============================ Post list (right column) ============================ */

/**
 * Append a small 🙂 button that opens the detail modal for a post.
 * @param {HTMLElement|null} activityContainerEl
 * @param {string|number} postId
 */
function attachOpenDetailSmileyProfile(activityContainerEl, postId) {
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

/**
 * Render a list of posts for the viewed user.
 * @param {Array<Object>} posts
 * @param {HTMLElement} container
 */
function renderProfilePosts(posts, container) {
  if (!container) return;
  container.innerHTML = "";

  posts.forEach((post) => {
    const feeling = post.feeling || "";
    const commentCount = Array.isArray(post.comments)
      ? post.comments.length
      : (post._count?.comments ?? 0);
    const likeCount = post._count?.reactions ?? 0;

    const avatar = post.author?.avatar?.url || DEFAULT_AVATAR;
    const authorName = post.author?.name || "unknown";
    const created = new Date(post.created).toLocaleString();
    const hasImg = !!post.media?.url;

    const html = `
      <div class="post" data-post-id="${post.id}">
        <div class="post-header">
          <div class="user-profile">
            <img src="${avatar}" alt="profile"/>
            <div>
              <div class="author-row">
                <p class="post-author-name">${authorName}${
                  feeling ? ` is ${feeling}` : ""
                }</p>
              </div>
              <span>${created}</span>
            </div>
          </div>
        </div>

        <h2 class="post-title">${post.title || "Untitled Post"}</h2>
        <p class="post-text">${post.body || ""}</p>
        ${
          hasImg
            ? `<img src="${post.media.url}" alt="post image" class="post-img" />`
            : ""
        }

        <div class="activity-icons" data-post-id="${post.id}">
          <button class="activity-like-btn" type="button" aria-pressed="false">
            <i class="fa-solid fa-thumbs-up"></i>
            <span class="activity-like-count">${likeCount}</span>
          </button>
          <button class="activity-comment-count" type="button">
            <i class="fa-solid fa-comment"></i>
            <span class="activity-comment-num">${commentCount}</span>
          </button>
          <button class="activity-share-btn" type="button">
            <i class="fa-solid fa-share"></i>
          </button>
        </div>
      </div>
    `;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    const postEl = wrapper.firstElementChild;

    const activityBar = postEl.querySelector(".activity-icons");
    attachOpenDetailSmileyProfile(activityBar, post.id);

    container.appendChild(postEl);

    attachImgFallback(
      postEl.querySelector(".user-profile img"),
      DEFAULT_AVATAR,
    );
    attachImgFallback(postEl.querySelector(".post-img"), DEFAULT_POST_IMAGE);

    const likeBtn = postEl.querySelector(".activity-like-btn");
    likeBtn?.addEventListener("click", () => toggleLike(post.id, likeBtn));

    postEl
      .querySelector(".post-text")
      ?.addEventListener("click", () => openPostDetail(post.id));
    postEl
      .querySelector(".post-img")
      ?.addEventListener("click", () => openPostDetail(post.id));
    postEl
      .querySelector(".activity-comment-count")
      ?.addEventListener("click", () => openPostDetail(post.id));
  });
}

/* ============================ Search (navbar input filters this page) ============================ */

let profilePostsCache = [];

//Filter cached posts by title/body/author.
function filterProfilePosts(queryString) {
  const searchText = (queryString || "").trim().toLowerCase();
  if (!searchText) return profilePostsCache;

  return profilePostsCache.filter((post) => {
    const titleText = (post.title || "").toLowerCase();
    const bodyText = (post.body || "").toLowerCase();
    const authorText = (post.author?.name || "").toLowerCase();
    return (
      titleText.includes(searchText) ||
      bodyText.includes(searchText) ||
      authorText.includes(searchText)
    );
  });
}

function setupProfileSearch(containerEl) {
  const inputEl =
    document.getElementById("nav-search") ||
    document.querySelector(".search-box input");
  if (!inputEl || !containerEl) return;

  const runSearch = debounce(() => {
    const searchText = (inputEl.value || "").toLowerCase().trim();
    const filtered = filterProfilePosts(searchText);
    renderProfilePosts(filtered, containerEl);
  }, 200);

  inputEl.addEventListener("input", runSearch);
  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      inputEl.value = "";
      runSearch();
    }
  });
}

//Fetch and render posts for the viewed user.
async function loadUserPosts() {
  const containerEl =
    document.querySelector("#profile-post-container") ||
    document.querySelector(".profile-post-container");
  if (!containerEl || !username) return;

  try {
    const res = await fetch(
      `${API_BASE}/social/profiles/${encodeURIComponent(
        username,
      )}/posts?_author=true&_comments=true&_reactions=true`,
      { headers: authHeaders() },
    );
    const { data = [] } = await res.json();

    profilePostsCache = data;
    if (!profilePostsCache.length) {
      showNoPosts(containerEl, "No Post yet");
    } else {
      renderProfilePosts(profilePostsCache, containerEl);
    }
    setupProfileSearch(containerEl);
  } catch (err) {
    console.error("Error loading user posts:", err);
  }
}

/* ============================ Post detail modal ============================ */

const postDetailContainer = document.querySelector(".post-detail-container");
const postDetailContent = document.querySelector(".post-detail-content");
const closePostDetailBtn = document.getElementById("close-post-detail");

if (closePostDetailBtn) {
  closePostDetailBtn.addEventListener("click", () => {
    postDetailContainer?.classList.remove("active");
    if (postDetailContent) postDetailContent.innerHTML = "";
    document.body.style.overflow = "";
  });
}

/**
 * Open the detail modal for a given post.
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

/**
 * Render the detail modal for one post.
 * @param {Object} post
 */
function renderPostDetail(post) {
  const currentUsername = localStorage.getItem("name") || "User";
  const currentUserAvatar = currentUserAvatarUrl || DEFAULT_AVATAR;

  const feeling = post.feeling || "";
  const likeCount = post._count?.reactions ?? 0;
  const commentCount = post._count?.comments ?? 0;
  const postImg = post.media?.url;

  const authorName = post.author?.name || "unknown";
  const authorAvatar = post.author?.avatar?.url || DEFAULT_AVATAR;
  const createdAt = new Date(post.created).toLocaleString();

  postDetailContent.innerHTML = `
    <div class="pd-header">
      <div class="pd-user-profile">
        <img src="${authorAvatar}" alt="profile" />
        <div>
          <div class="author-row">
            <p class="pd-author-name">${authorName}${
              feeling ? ` is ${feeling}` : ""
            }</p>
          </div>
          <span>${createdAt}</span>
        </div>
      </div>
    </div>

    <h2 class="pd-title">${post.title || "Untitled Post"}</h2>
    <p class="pd-text">${post.body || ""}</p>
    ${postImg ? `<img src="${postImg}" class="pd-img" alt="post image" />` : ""}

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
      <img src="${currentUserAvatar}" alt="${currentUsername}" />
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
            <img src="${c.author?.avatar?.url || DEFAULT_AVATAR}" alt="${
              c.author?.name || "unknown"
            }" />
            <div>
              <p class="pd-comment-author">${c.author?.name || "unknown"}</p>
              <p class="pd-comment-body">${c.body || ""}</p>
              <span class="pd-comment-time">${new Date(
                c.created,
              ).toLocaleString()}</span>
            </div>
          </div>`,
              )
              .join("")
          : `<p class="pd-no-comments">No comments yet.</p>`
      }
    </div>
  `;

  attachImgFallback(
    postDetailContent.querySelector(".pd-user-profile img"),
    DEFAULT_AVATAR,
  );
  attachImgFallback(
    postDetailContent.querySelector(".pd-img"),
    DEFAULT_POST_IMAGE,
  );

  setupCommentEmojiUI(postDetailContent);

  const likeBtn = postDetailContent.querySelector(".pd-like-btn");
  likeBtn?.addEventListener("click", async () => {
    await toggleLike(post.id, likeBtn);

    // Fetch fresh counts & sync the list card.
    try {
      const fresh = await getSinglePost(post.id);
      syncCardLikesFromPost(fresh);

      // Keep search cache aligned.
      const idx = profilePostsCache.findIndex((p) => p.id === fresh.id);
      if (idx >= 0) {
        profilePostsCache[idx]._count = fresh._count;
        if (fresh.reactions) profilePostsCache[idx].reactions = fresh.reactions;
      }
    } catch {}
  });

  const ta = postDetailContent.querySelector(".pd-comment-textarea");
  const sendBtn = postDetailContent.querySelector(".pd-send-comment");
  sendBtn?.addEventListener("click", () => sendComment(post.id, ta));
  ta?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendComment(post.id, ta);
    }
  });
}

//Refresh the comment count (modal + list) for a post.
async function refreshCommentCount(postId) {
  try {
    const res = await fetch(
      `${API_BASE}/social/posts/${encodeURIComponent(
        postId,
      )}?_comments=true&_author=false&_reactions=false`,
      { headers: authHeaders() },
    );
    const { data } = await res.json();
    const newCount = Array.isArray(data?.comments)
      ? data.comments.length
      : (data?._count?.comments ?? 0);

    const modalNum = document.querySelector(
      ".post-detail-content .pd-comment-num",
    );
    if (modalNum) modalNum.textContent = newCount;

    const listNum = document.querySelector(
      `.profile-post-container .post[data-post-id="${postId}"] .activity-comment-num`,
    );
    if (listNum) listNum.textContent = newCount;
  } catch (err) {
    console.error("Failed to refresh comment count:", err);
  }
}

//Update the list card’s like count + active state from a fresh post.
function syncCardLikesFromPost(post) {
  if (!post || !post.id) return;

  const card = document.querySelector(
    `.profile-post-container .post[data-post-id="${post.id}"]`,
  );
  if (!card) return;

  const countEl = card.querySelector(".activity-like-count");
  if (countEl) countEl.textContent = String(post._count?.reactions ?? 0);

  const btn = card.querySelector(".activity-like-btn");
  if (btn) {
    const me = localStorage.getItem("name");
    const likedByMe =
      Array.isArray(post.reactions) &&
      post.reactions.some((r) => r.symbol === "👍" && r.profile?.name === me);
    btn.classList.toggle("active", !!likedByMe);
    btn.setAttribute("aria-pressed", String(!!likedByMe));
  }
}

/* ============================ Likes + Comments actions ============================ */

//Toggle 👍 reaction for a post and update the pressed button UI in place.
async function toggleLike(postId, btnEl) {
  if (!accessToken) return;
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

//Send a comment from the detail modal textarea and update counts/UI.
async function sendComment(postId, textareaEl) {
  const text = textareaEl?.value?.trim();
  if (!text || !accessToken) return;

  try {
    const res = await fetch(
      `${API_BASE}/social/posts/${encodeURIComponent(postId)}/comment`,
      {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ body: text }),
      },
    );

    if (!res.ok) throw new Error("Comment request failed");
    const json = await res.json();
    const newComment = json.data || {};

    if (!newComment.author) {
      newComment.author = {
        name: localStorage.getItem("name") || "User",
        avatar: { url: currentUserAvatarUrl || DEFAULT_AVATAR },
      };
      newComment.created = new Date().toISOString();
    }

    appendComment(newComment);
    textareaEl.value = "";
    await refreshCommentCount(postId);
  } catch (err) {
    console.error("Failed to add comment:", err);
  }
}

function appendComment(c) {
  const commentsEl = postDetailContent.querySelector(".pd-comments");
  if (!commentsEl) return;

  if (commentsEl.querySelector(".pd-no-comments")) commentsEl.innerHTML = "";

  const html = `
    <div class="pd-comment" data-comment-id="${c.id}">
      <img src="${c.author?.avatar?.url || DEFAULT_AVATAR}" alt="${
        c.author?.name || "User"
      }" />
      <div>
        <p class="pd-comment-author">${c.author?.name || "User"}</p>
        <p class="pd-comment-body">${c.body || ""}</p>
        <span class="pd-comment-time">${new Date(
          c.created || Date.now(),
        ).toLocaleString()}</span>
      </div>
    </div>
  `;
  commentsEl.insertAdjacentHTML("afterbegin", html);
}

/**
 * Attach a simple emoji palette to the detail modal’s comment composer.
 * (inserts emoji into text only; does NOT call reaction API)
 * @param {HTMLElement} modalRootEl
 * @param {string|number} postId
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
        `<button type="button" class="pd-emoji-item" data-emoji="${e}">${e}</button>`,
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
    const emoji = btn.dataset.emoji;
    insertAtCursor(textarea, emoji);
    panel.style.display = "none";
  });

  sendBtn.addEventListener("click", () => {
    panel.style.display = "none";
  });
  document.addEventListener("click", (evt) => {
    if (!modalRootEl.contains(evt.target)) panel.style.display = "none";
  });
  textarea.addEventListener("keydown", (evt) => {
    if (evt.key === "Escape") panel.style.display = "none";
  });
}

function insertAtCursor(textarea, text) {
  if (!textarea) return;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  textarea.value = before + text + after;
  const pos = start + text.length;
  textarea.selectionStart = textarea.selectionEnd = pos;
  textarea.focus();
}

if (!username) {
  console.error("No username found in URL");
}

fetchLoggedInAvatar();
loadUserInfo();
loadUserPosts();
loadNavbarProfile();
updateOtherUserPostCount(username);
updateOtherUserFollowingCount(username);

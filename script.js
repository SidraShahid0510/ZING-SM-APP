import {
  API_BASE,
  Noroff_API_Key,
  DEFAULT_AVATAR,
  DEFAULT_POST_IMAGE,
} from "./config.js";
import { debounce, attachImgFallback } from "./utils.js";
import {
  fetchPosts,
  getSinglePost,
  createPost as createPostApi,
  updatePost as updatePostApi,
  deletePost as deletePostApi,
} from "./postsApi.js";
import { reactThumbsUp } from "./reactionsApi.js";
import { followUser, unfollowUser } from "./followApi.js";
import { generatePosts } from "./render.js";

/** Build auth headers for Noroff API calls. */
function authHeaders(extra = {}) {
  const token = localStorage.getItem("accessToken") || "";
  return {
    Authorization: `Bearer ${token}`,
    "X-Noroff-API-Key": Noroff_API_Key,
    ...extra,
  };
}

/** Cached avatar for the logged-in user  */
let currentAvatarUrl = DEFAULT_AVATAR;
// Use any cached avatar immediately so first render uses it
{
  const cached = (localStorage.getItem("avatarUrl") || "").trim();
  if (cached) {
    currentAvatarUrl = cached;
    // render.js / other modules sometimes read this
    window.currentAvatarUrl = cached;
  }
}

/**
 * Fetch the current user's avatar from the API and update avatar elements.
 * If missing, revert to default.
 * @returns {Promise<void>}
 */
async function fetchAndSetAvatar() {
  const username = localStorage.getItem("name");
  if (!username) return;

  try {
    const res = await fetch(
      `${API_BASE}/social/profiles/${encodeURIComponent(username)}`,
      { headers: authHeaders() }
    );
    if (!res.ok) throw new Error("Failed to fetch user profile");
    const { data } = await res.json();

    currentAvatarUrl = data?.avatar?.url?.trim() || DEFAULT_AVATAR;
    window.currentAvatarUrl = currentAvatarUrl;
    localStorage.setItem("avatarUrl", currentAvatarUrl);
    updateMyAvatarEverywhere(currentAvatarUrl);

    // Update common avatar targets + username
    const avatarTargets = [
      "#nav-profile-img",
      "#nav-menu-img",
      "#post-profile-pic",
      "#comment-section-profile-image",
      "#create-profile-img",
      "#edit-profile-img",
    ];
    avatarTargets.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        el.src = currentAvatarUrl;
        el.alt = `${username}'s avatar`;
        el.onerror = () => {
          el.onerror = null;
          el.src = DEFAULT_AVATAR;
        };
      }
    });
    const navUsernameEl = document.getElementById("nav-username");
    if (navUsernameEl) navUsernameEl.textContent = username;
  } catch (err) {
    console.error("Error fetching avatar:", err);
  }
}

function cacheBust(url) {
  if (!url) return DEFAULT_AVATAR;
  return url.includes("?")
    ? `${url}&_v=${Date.now()}`
    : `${url}?&_v=${Date.now()}`;
}

/**
 * Update every place the logged-in user's avatar is shown.
 * @param {string} newUrlRaw
 */
function updateMyAvatarEverywhere(newUrlRaw) {
  const newUrl = cacheBust((newUrlRaw || "").trim());
  const me = localStorage.getItem("name") || "User";

  // nav + composer + edit
  [
    "#nav-profile-img",
    "#nav-menu-img",
    "#post-profile-pic",
    "#comment-section-profile-image",
    "#create-profile-img",
    "#edit-profile-img",
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

  // all my post cards on the feed
  document
    .querySelectorAll(".post-container .post .user-profile img")
    .forEach((img) => {
      img.src = newUrl;
      img.onerror = () => {
        img.onerror = null;
        img.src = DEFAULT_AVATAR;
      };
    });

  // detail modal if open
  const pd = document.querySelector(
    ".post-detail-container.active .pd-user-profile img"
  );
  if (pd) {
    pd.src = newUrl;
    pd.onerror = () => {
      pd.onerror = null;
      pd.src = DEFAULT_AVATAR;
    };
  }
}

/* ====================== Post Count (header counters) ====================== */

const POST_COUNT_SELECTOR = "#posts-count";

/**
 * Fetch the logged-in user’s post count.
 * @param {string} username
 * @returns {Promise<number>}
 */
async function fetchUserPostCount(username) {
  if (!username) return 0;
  try {
    const res = await fetch(
      `${API_BASE}/social/profiles/${encodeURIComponent(
        username
      )}/posts?_author=false&_comments=false&_reactions=false`,
      { headers: authHeaders() }
    );
    const { data = [] } = await res.json();
    return Array.isArray(data) ? data.length : 0;
  } catch (e) {
    console.error("fetchUserPostCount error:", e);
    return 0;
  }
}

/**
 * Set the post count text in the header.
 * @param {number} count
 */
function setPostCountText(count) {
  const el = document.querySelector(POST_COUNT_SELECTOR);
  if (el) el.textContent = String(count);
}

let currentPostCount = null;

/** Refresh the post count for the logged-in user. */
window.updateMyPostCount = async function updateMyPostCount() {
  const me = localStorage.getItem("name");
  if (!me) return;
  const count = await fetchUserPostCount(me);
  currentPostCount = count;
  setPostCountText(count);
};
/** Increment the post count by 1 (UI only). */
window.incrementPostCount = function incrementPostCount() {
  if (currentPostCount === null) return;
  currentPostCount += 1;
  setPostCountText(currentPostCount);
};
/** Decrement the post count by 1 (UI only). */
window.decrementPostCount = function decrementPostCount() {
  if (currentPostCount === null) return;
  currentPostCount = Math.max(0, currentPostCount - 1);
  setPostCountText(currentPostCount);
};

/* ====================== Following Count (header counters) ====================== */

const FOLLOWING_COUNT_SELECTOR = "#following-count";

/**
 * Fetch the logged-in user’s following count.
 * @param {string} username
 * @returns {Promise<number>}
 */
async function fetchFollowingCount(username) {
  if (!username) return 0;
  try {
    const res = await fetch(
      `${API_BASE}/social/profiles/${encodeURIComponent(
        username
      )}?_followers=true&_following=true`,
      { headers: authHeaders() }
    );
    const { data } = await res.json();
    return Array.isArray(data?.following) ? data.following.length : 0;
  } catch (e) {
    console.error("fetchFollowingCount error:", e);
    return 0;
  }
}

/** Set the following count text in the header. */
function setFollowingCountText(count) {
  const el = document.querySelector(FOLLOWING_COUNT_SELECTOR);
  if (el) el.textContent = String(count);
}

let currentFollowingCount = null;

/** Refresh the following count for the logged-in user. */
window.updateMyFollowingCount = async function updateMyFollowingCount() {
  const me = localStorage.getItem("name");
  if (!me) return;
  const count = await fetchFollowingCount(me);
  currentFollowingCount = count;
  setFollowingCountText(count);
};
/** Increment following count (UI only). */
window.incrementFollowingCount = function incrementFollowingCount() {
  if (currentFollowingCount === null) return;
  currentFollowingCount += 1;
  setFollowingCountText(currentFollowingCount);
};
/** Decrement following count (UI only). */
window.decrementFollowingCount = function decrementFollowingCount() {
  if (currentFollowingCount === null) return;
  currentFollowingCount = Math.max(0, currentFollowingCount - 1);
  setFollowingCountText(currentFollowingCount);
};

/* ====================== Follow / Unfollow (button wrapper) ====================== */

/**
 * Toggle follow for a username and update UI + counters.
 * @param {string} username
 * @param {HTMLElement} btnEl
 * @returns {Promise<void>}
 */
async function toggleFollow(username, btnEl) {
  if (!username || !btnEl) return;
  const isFollowing = btnEl.classList.contains("following");
  try {
    const ok = isFollowing
      ? await unfollowUser(username)
      : await followUser(username);
    if (!ok) return;

    const newText = isFollowing ? "Follow" : "Following";
    document
      .querySelectorAll(
        `.follow-text[data-author="${username}"], .pd-follow-text[data-author="${username}"]`
      )
      .forEach((b) => {
        b.textContent = newText;
        b.classList.toggle("following", !isFollowing);
        b.setAttribute("aria-pressed", String(!isFollowing));
      });

    if (!isFollowing) {
      window.incrementFollowingCount?.();
    } else {
      window.decrementFollowingCount?.();
    }

    if (typeof updateOtherUserFollowingCount === "function") {
      updateOtherUserFollowingCount(username);
    }
  } catch (err) {
    console.error("Follow/unfollow failed:", err);
  }
}

/* ====================== Create Post (modal) ====================== */

const writePostSection = document.querySelector(".write-post-section");
const createPostContainer = document.querySelector(".create-post-container");
const closeCreateBtn = document.getElementById("close-create");

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
const imageIcon = document.querySelector(".create-activity-icons .fa-image");
const imageUrlInput = document.getElementById("image-url");
const urlImageDiv = document.querySelector(".url-img-div");
const previewImg = urlImageDiv?.querySelector("img");
const removeImgBtn = document.getElementById("remove-img");

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

const postBtn = document.querySelector(".create-post-btn");
const textarea = document.querySelector(".create-txt textarea");
const titleInput = document.getElementById("post-title");

const feelingsSection = document.querySelector(".feelings-section");
const feelingsIcon = document.querySelector(
  ".create-activity-icons .fa-face-smile"
);
const closeFeelingsBtn = document.getElementById("close-feelings");
const feelingOptions = feelingsSection?.querySelectorAll(".feeling");

/**
 * Add small preset “feeling” emojis to a textarea from buttons.
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
setupEmojiPicker(feelingOptions, textarea, feelingsSection);

feelingsIcon?.addEventListener("click", () => {
  feelingsSection && (feelingsSection.style.display = "flex");
});
closeFeelingsBtn?.addEventListener("click", () => {
  feelingsSection && (feelingsSection.style.display = "none");
});

/**
 * Create a new post and refresh both feeds.
 * @returns {Promise<void>}
 */
async function createPost() {
  const postText = (textarea?.value || "").trim();
  const rawImageUrl = (imageUrlInput?.value || "").trim();
  const hasImage = !!rawImageUrl;

  if (!postText && !hasImage) {
    console.warn("Cannot create an empty post.");
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

    // counters & UI resets
    window.incrementPostCount?.();
    if (typeof updateOtherUserPostCount === "function") {
      updateOtherUserPostCount(localStorage.getItem("name"));
    }
    if (textarea) textarea.value = "";
    if (titleInput) titleInput.value = "";
    if (imageUrlInput) imageUrlInput.value = "";
    if (previewImg) previewImg.src = "";
    if (urlImageDiv) urlImageDiv.style.display = "none";
    if (imageUrlInput) imageUrlInput.style.display = "none";
    createPostContainer?.classList.remove("active");
    document.body.style.overflow = "";

    // refresh feeds
    const mainFeed = document.querySelector(".post-container");
    if (mainFeed) {
      const allPosts = await fetchPosts(true);
      generatePosts(allPosts, mainFeed);
    }
    const profileFeed = document.querySelector(".profile-post-container");
    if (profileFeed) {
      const myPosts = await fetchPosts(false);
      generatePosts(myPosts, profileFeed);
    }
  } catch (error) {
    console.error("Error creating post:", error);
  }
}
postBtn?.addEventListener("click", createPost);
// --- EDIT MODAL: image picker, remove image, feelings (emoji) ---
(function wireEditModalUI() {
  const editPostContainer = document.querySelector(".edit-post-container");
  if (!editPostContainer) return;

  // Elements inside the edit modal
  const editImageInput = editPostContainer.querySelector("#edit-image-url");
  const editUrlImageDiv = editPostContainer.querySelector(".edit-url-img-div");
  const editPreviewImg = editUrlImageDiv?.querySelector("img");

  const editImageIcon = document.querySelector(
    ".edit-activity-icons .fa-image"
  );
  if (editImageIcon && editImageInput) {
    editImageIcon.addEventListener("click", () => {
      editImageInput.style.display = "block";
      editImageInput.focus();
    });
  }

  // Live preview while typing a URL
  if (editImageInput && editUrlImageDiv && editPreviewImg) {
    editImageInput.addEventListener("input", () => {
      const url = (editImageInput.value || "").trim();
      if (url) {
        editPreviewImg.src = url;
        editUrlImageDiv.style.display = "block";
      } else {
        editPreviewImg.src = "";
        editUrlImageDiv.style.display = "none";
      }
    });
  }

  const editRemoveBtn =
    editPostContainer.querySelector("#edit-remove-img") ||
    editPostContainer.querySelector(".edit-remove-img") ||
    editUrlImageDiv?.querySelector(".fa-xmark") ||
    null;

  if (editRemoveBtn && editImageInput && editUrlImageDiv && editPreviewImg) {
    editRemoveBtn.addEventListener("click", (e) => {
      e.preventDefault();
      editPreviewImg.src = "";
      editImageInput.value = "";
      editUrlImageDiv.style.display = "none";
      editImageInput.style.display = "none";
    });
  }

  const editFeelingsSection = document.querySelector(".edit-feelings-section");
  const editFeelingOptions = editFeelingsSection?.querySelectorAll(".feeling");
  const editTextarea = editPostContainer.querySelector(".edit-txt textarea");
  const editFeelingsIcon = document.querySelector(
    ".edit-activity-icons .fa-face-smile"
  );
  const editCloseFeelingsBtn = document.getElementById("close-edit-feelings");

  // Reuse your existing helper to insert emoji into the textarea
  if (
    editFeelingOptions &&
    editTextarea &&
    editFeelingsSection &&
    typeof setupEmojiPicker === "function"
  ) {
    setupEmojiPicker(editFeelingOptions, editTextarea, editFeelingsSection);
  }

  if (editFeelingsIcon && editFeelingsSection) {
    editFeelingsIcon.addEventListener("click", () => {
      editFeelingsSection.style.display = "flex";
    });
  }
  if (editCloseFeelingsBtn && editFeelingsSection) {
    editCloseFeelingsBtn.addEventListener("click", () => {
      editFeelingsSection.style.display = "none";
    });
  }
})();
// --- EDIT MODAL: close button (feed page) ---
document.addEventListener("click", (e) => {
  const closeBtn = e.target.closest("#close-edit");
  if (!closeBtn) return;

  const editPostContainer = document.querySelector(".edit-post-container");
  if (!editPostContainer) return;

  e.preventDefault();
  // hide modal
  editPostContainer.classList.remove("active");
  editPostContainer.removeAttribute("data-editing-post-id");
  document.body.style.overflow = "";

  // optional: clear fields so reopening starts clean
  const t = editPostContainer.querySelector("#edit-post-title");
  const ta = editPostContainer.querySelector(".edit-txt textarea");
  const url = editPostContainer.querySelector("#edit-image-url");
  const imgWrap = editPostContainer.querySelector(".edit-url-img-div");
  const img = imgWrap?.querySelector("img");
  if (t) t.value = "";
  if (ta) ta.value = "";
  if (url) {
    url.value = "";
    url.style.display = "none";
  }
  if (img) img.src = "";
  if (imgWrap) imgWrap.style.display = "none";

  const feelings = document.querySelector(".edit-feelings-section");
  if (feelings) feelings.style.display = "none";
});

/* ====================== Reactions / counts refresh ====================== */

/**
 * Refresh likes/comments for a post from the server and sync both modal + list.
 * @param {string|number} postId
 * @returns {Promise<void>}
 */
async function refreshCountsFromServer(postId) {
  try {
    const res = await fetch(
      `${API_BASE}/social/posts/${encodeURIComponent(
        postId
      )}?_comments=true&_reactions=true`,
      { headers: authHeaders() }
    );
    const { data } = await res.json();
    const likes = data?._count?.reactions ?? 0;
    const comments = Array.isArray(data?.comments)
      ? data.comments.length
      : data?._count?.comments ?? 0;

    // sync modal
    const modalLike = document.querySelector(
      ".post-detail-content .pd-like-count"
    );
    if (modalLike) modalLike.textContent = String(likes);
    const modalComments = document.querySelector(
      ".post-detail-content .pd-comment-num"
    );
    if (modalComments) modalComments.textContent = String(comments);

    // sync list card
    updateListLikeCount(postId, likes);
    updateListCommentCount(postId, comments);
  } catch (e) {
    console.error("refreshCountsFromServer error:", e);
  }
}

/** In-memory cache of the full feed (for search). */
let allPostsCache = [];

/**
 * Filter posts by query (title/body/author, case-insensitive).
 * @param {string} queryString
 * @returns {Array<any>}
 */
function filterPosts(queryString) {
  const searchText = (queryString || "").trim().toLowerCase();
  if (!searchText) return allPostsCache;
  return allPostsCache.filter((post) => {
    const title = (post.title || "").toLowerCase();
    const body = (post.body || "").toLowerCase();
    const author = (post.author?.name || "").toLowerCase();
    return (
      title.includes(searchText) ||
      body.includes(searchText) ||
      author.includes(searchText)
    );
  });
}

/**
 * Wire the navbar search input to filter the main feed.
 * @param {HTMLElement} containerEl
 */
function setupFeedSearch(containerEl) {
  const inputEl =
    document.getElementById("nav-search") ||
    document.querySelector(".search-box input");
  if (!inputEl || !containerEl) return;

  const performSearch = debounce(() => {
    const searchText = (inputEl.value || "").toLowerCase().trim();
    const filtered = filterPosts(searchText);
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

/** Update a post card's like count in the list. */
function updateListLikeCount(postId, newCount) {
  const el = document.querySelector(
    `.post[data-post-id="${postId}"] .activity-like-count`
  );
  if (el) el.textContent = String(newCount);
}
/** Update a post card's comment count in the list. */
function updateListCommentCount(postId, newCount) {
  const el = document.querySelector(
    `.post[data-post-id="${postId}"] .activity-comment-num`
  );
  if (el) el.textContent = String(newCount);
}

/**
 * Toggle 👍 reaction for a post and update the pressed button UI in place.
 * @param {string|number} postId
 * @param {HTMLElement} btnEl
 * @returns {Promise<void>}
 */
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

      updateListLikeCount(postId, count);
    }
  } catch (err) {
    console.error("Failed to toggle like:", err);
  }
}

/* ====================== Post Detail (modal) ====================== */

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

//Open the post detail modal for a given postId.
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

function insertAtCursor(textareaEl, textToInsert) {
  if (!textareaEl) return;
  const start = textareaEl.selectionStart ?? textareaEl.value.length;
  const end = textareaEl.selectionEnd ?? textareaEl.value.length;
  const before = textareaEl.value.slice(0, start);
  textareaEl.value = before + textToInsert + textareaEl.value.slice(end);
  const newPos = start + textToInsert.length;
  textareaEl.setSelectionRange(newPos, newPos);
  textareaEl.focus();
}

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

//Render a post into the detail modal
function renderPostDetail(post) {
  const currentUsername = localStorage.getItem("name") || "User";
  const feeling = post.feeling || "";
  const likeCount = post._count?.reactions ?? 0;
  const commentCount = post._count?.comments ?? 0;
  const postImg = post.media?.url;

  const authorAvatar =
    post.author?.name === currentUsername
      ? currentAvatarUrl || DEFAULT_AVATAR
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
      <img src="${
        currentAvatarUrl || DEFAULT_AVATAR
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
                ? currentAvatarUrl || DEFAULT_AVATAR
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
      window.location.href = `user-profile.html?username=${encodeURIComponent(
        post.author.name
      )}`;
    });
  }

  const likeBtn = postDetailContent.querySelector(".pd-like-btn");
  likeBtn?.addEventListener("click", () => toggleLike(post.id, likeBtn));

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

//Add a small 🙂 button that opens detail modal for a post.
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

// Delete a post and refresh the correct feed + counters.
async function deletePost(postId, container) {
  if (!postId) return;

  // choose a refresh target if none given
  const root =
    container ||
    document.querySelector(".post-container") ||
    document.querySelector(".profile-post-container");

  try {
    await deletePostApi(postId);

    // close detail modal if open
    const detail = document.querySelector(".post-detail-container");
    if (detail?.classList.contains("active")) {
      detail.classList.remove("active");
      document.body.style.overflow = "";
    }

    // refresh whichever feed is visible
    if (root?.classList.contains("post-container")) {
      const allPosts = await fetchPosts(true);
      generatePosts(allPosts, root);
    } else if (root?.classList.contains("profile-post-container")) {
      const myPosts = await fetchPosts(false);
      generatePosts(myPosts, root);
    }

    // counters
    window.decrementPostCount?.();
    if (typeof updateOtherUserPostCount === "function") {
      updateOtherUserPostCount(localStorage.getItem("name"));
    }

    console.log(`Post ${postId} deleted successfully.`);
  } catch (err) {
    console.error("Failed to delete post:", err);
  }
}

/**
 * Save an edited post and refresh the correct feed.
 * @param {string|number} postId
 * @param {HTMLElement} [container]
 * @returns {Promise<void>}
 */
async function updatePost(postId, container) {
  const root =
    container ||
    document.querySelector(".post-container") ||
    document.querySelector(".profile-post-container");
  if (!root) return;

  const title =
    (document.querySelector("#edit-post-title")?.value || "").trim() ||
    "Untitled Post";
  const body = (
    document.querySelector(".edit-txt textarea")?.value || ""
  ).trim();
  const img = (document.querySelector("#edit-image-url")?.value || "").trim();

  const payload = {
    title,
    body,
    media: img ? { url: img, alt: "User post image" } : null,
  };

  try {
    await updatePostApi(postId, payload);

    const editPostContainer = document.querySelector(".edit-post-container");
    if (editPostContainer) editPostContainer.classList.remove("active");
    document.body.style.overflow = "";

    if (root.classList.contains("post-container")) {
      const allPosts = await fetchPosts(true);
      generatePosts(allPosts, root);
    } else if (root.classList.contains("profile-post-container")) {
      const myPosts = await fetchPosts(false);
      generatePosts(myPosts, root);
    }
  } catch (err) {
    console.error("Update failed:", err);
    alert("Failed to update post");
  }
}
// --- wire the Edit modal Save button (feed page) ---
/* const editPostContainer = document.querySelector(".edit-post-container");
const saveEditBtn = editPostContainer?.querySelector(".edit-post-btn");

saveEditBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  const postId = editPostContainer?.dataset?.editingPostId;
  if (!postId) {
    console.warn("No post selected for editing.");
    return;
  }
  // On the feed page, refresh the main list after saving
  const container =
    document.querySelector(".post-container") ||
    document.querySelector(".profile-post-container");

  updatePost(postId, container);
}); */

// Delegated handler so it works even if the button wasn't in the DOM at load
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".edit-post-btn");
  if (!btn) return;

  const editPostContainer = document.querySelector(".edit-post-container");
  if (!editPostContainer) return;

  e.preventDefault();
  const postId = editPostContainer.dataset?.editingPostId;
  if (!postId) {
    console.warn("No post selected for editing.");
    return;
  }

  const container =
    document.querySelector(".post-container") ||
    document.querySelector(".profile-post-container");

  updatePost(postId, container);
});

async function sendComment(postId, textareaEl) {
  const text = textareaEl?.value.trim();
  if (!text) return;

  try {
    const res = await fetch(
      `${API_BASE}/social/posts/${encodeURIComponent(postId)}/comment`,
      {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ body: text }),
      }
    );
    if (!res.ok) throw new Error("Comment request failed");

    const json = await res.json();
    const newComment = json.data || {};

    if (!newComment.author) {
      newComment.author = {
        name: localStorage.getItem("name") || "User",
        avatar: { url: currentAvatarUrl || DEFAULT_AVATAR },
      };
      newComment.created = new Date().toISOString();
    }
    appendComment(newComment);

    textareaEl.value = "";
    await refreshCountsFromServer(postId);
  } catch (err) {
    console.error("Failed to add comment:", err);
  }
}

function appendComment(c) {
  const commentsEl = postDetailContent?.querySelector(".pd-comments");
  if (!commentsEl) return;

  if (commentsEl.querySelector(".pd-no-comments")) commentsEl.innerHTML = "";

  const avatarUrl =
    c.author?.name === localStorage.getItem("name")
      ? currentAvatarUrl || DEFAULT_AVATAR
      : c.author?.avatar?.url || DEFAULT_AVATAR;

  const html = `
    <div class="pd-comment" data-comment-id="${c.id}">
      <img src="${avatarUrl}" alt="${c.author?.name || "User"}" />
      <div>
        <p class="pd-comment-author">${c.author?.name || "User"}</p>
        <p class="pd-comment-body">${c.body || ""}</p>
        <span class="pd-comment-time">${new Date(
          c.created
        ).toLocaleString()}</span>
      </div>
    </div>
  `;
  commentsEl.insertAdjacentHTML("afterbegin", html);
}

/**
 * Page bootstrap: load avatar, fetch and render the feed, wire search.
 * @returns {Promise<void>}
 */
async function main() {
  await fetchAndSetAvatar();

  const mainFeedContainer = document.querySelector(".post-container");
  /*   const profileFeedContainer = document.querySelector(
    ".profile-post-container"
  ); */
  const isLoginUserPage = window.location.pathname.includes("login-user.html");

  // Feed page only
  if (!isLoginUserPage && mainFeedContainer) {
    const allPosts = await fetchPosts(true);
    allPostsCache = allPosts.slice();
    generatePosts(allPosts, mainFeedContainer);
    setupFeedSearch(mainFeedContainer);
  }
}
main();

/* ====================== Expose hooks for render.js ====================== */
Object.assign(window, {
  toggleLike,
  toggleFollow,
  openPostDetail,
  deletePost,
  updatePost,
  attachOpenDetailSmiley,
});

/* ====================== Stories re-locator (responsive) ====================== */
/**
 * Moves the "stories" block between right sidebar and main content .
 * Runs on load, MQ changes, and debounced resize.
 */
(function relocateStories() {
  const storiesWrapper = document.querySelector(".stories-wrapper");
  const rightSidebar = document.querySelector(".right-sidebar");
  const mainContent = document.querySelector(".main-content");
  const writePostSection = document.querySelector(".write-post-section");
  if (!storiesWrapper || !rightSidebar || !mainContent) return;

  const originalParent = storiesWrapper.parentNode;
  const originalNext = storiesWrapper.nextSibling;
  const storiesHeading = storiesWrapper.querySelector("h1");

  function moveToMain() {
    if (storiesHeading) storiesHeading.style.display = "none";
    const ref =
      writePostSection && mainContent.contains(writePostSection)
        ? writePostSection
        : mainContent.firstChild;
    mainContent.insertBefore(storiesWrapper, ref || null);
  }
  function moveBackToRight() {
    if (storiesHeading) storiesHeading.style.display = "block";
    if (originalNext && originalNext.parentNode === originalParent) {
      originalParent.insertBefore(storiesWrapper, originalNext);
    } else {
      originalParent.insertBefore(storiesWrapper, originalParent.firstChild);
    }
  }

  const mq = window.matchMedia("(max-width: 1200px)");
  const apply = () => (mq.matches ? moveToMain() : moveBackToRight());

  apply();
  if (document.readyState === "complete") {
    setTimeout(apply, 0);
  } else {
    window.addEventListener("load", () => setTimeout(apply, 0));
  }
  mq.addEventListener("change", apply);

  let rT;
  window.addEventListener("resize", () => {
    clearTimeout(rT);
    rT = setTimeout(apply, 150);
  });
})();

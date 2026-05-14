// render.js

import {
  API_BASE,
  Noroff_API_Key,
  DEFAULT_AVATAR,
  DEFAULT_POST_IMAGE,
} from "./config.js";
import { attachImgFallback } from "./utils.js";

/**
 * Get the current user's avatar, preferring the live value set on window,
 * then what's cached in localStorage, then DEFAULT_AVATAR.
 * @returns {string}
 */
function getCurrentAvatar() {
  const win = typeof window !== "undefined" ? window : {};
  const fromWin = (win.currentAvatarUrl || "").trim();
  const fromLS = (localStorage.getItem("avatarUrl") || "").trim();
  return fromWin || fromLS || DEFAULT_AVATAR;
}

/**
 * Fetch the list of names the logged-in user is following (for initial button state).
 * @param {string} me - logged-in username
 * @param {string} token - bearer token
 * @returns {Promise<string[]>}
 */
async function getFollowingNames(me, token) {
  if (!me || !token) return [];
  try {
    const res = await fetch(
      `${API_BASE}/social/profiles/${encodeURIComponent(
        me,
      )}?_followers=true&_following=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Noroff-API-Key": Noroff_API_Key,
        },
      },
    );
    if (!res.ok) return [];
    const { data } = await res.json();
    return data?.following?.map((f) => f.name) || [];
  } catch (e) {
    console.error("Error fetching following list:", e);
    return [];
  }
}

/**
 * Open + populate the edit modal for a given post.
 * Re-queries all modal elements, so this works on any page.
 * @param {Object} post
 * @param {string|number} post.id
 * @param {string} [post.title]
 * @param {string} [post.body]
 * @param {{url?: string}} [post.media]
 */
function openEditModalForPost(post) {
  const editPostContainer = document.querySelector(".edit-post-container");
  if (!editPostContainer) return;

  // stash id so Save can read it
  editPostContainer.dataset.editingPostId = String(post.id);

  // fields
  const editTitleInput = editPostContainer.querySelector("#edit-post-title");
  const editTextarea = editPostContainer.querySelector(".edit-txt textarea");
  const editImageInput = editPostContainer.querySelector("#edit-image-url");
  const editPreviewImg = editPostContainer.querySelector(
    ".edit-url-img-div img",
  );
  const editUrlImageDiv = editPostContainer.querySelector(".edit-url-img-div");

  if (editTitleInput) editTitleInput.value = post.title || "";
  if (editTextarea) editTextarea.value = post.body || "";

  const url = (post.media && post.media.url) || "";
  if (editPreviewImg && editUrlImageDiv && editImageInput) {
    if (url) {
      editPreviewImg.src = url;
      editUrlImageDiv.style.display = "block";
      editImageInput.value = url;
    } else {
      editPreviewImg.src = "";
      editUrlImageDiv.style.display = "none";
      editImageInput.value = "";
    }
  }

  // modal avatar + username
  const editUserProfileImg =
    editPostContainer.querySelector("#edit-profile-img") ||
    editPostContainer.querySelector(".edit-content img");
  const editUsernameEl = editPostContainer.querySelector("#edit-username");
  const meName = localStorage.getItem("name") || "User";
  const meAvatar = getCurrentAvatar();

  if (editUserProfileImg) {
    editUserProfileImg.src = meAvatar;
    editUserProfileImg.alt = `${meName}'s avatar`;
    editUserProfileImg.onerror = () => {
      editUserProfileImg.onerror = null;
      editUserProfileImg.src = DEFAULT_AVATAR;
    };
  }
  if (editUsernameEl) editUsernameEl.textContent = meName;

  // show modal
  editPostContainer.classList.add("active");
  document.body.style.overflow = "hidden";
}

/**
 * Render post cards into a container and attach all per-card interactions.
 * - Follow button is shown for others' posts.
 * - Edit/Delete shown only for own posts.
 * - Like/Comment openers defer to window.toggleLike / window.openPostDetail.
 * @param {Array<Object>} posts
 * @param {HTMLElement} container
 */
export async function generatePosts(posts, container) {
  if (!container || !posts) return;
  container.innerHTML = "";

  const loggedInUser = localStorage.getItem("name") || "";
  const token = localStorage.getItem("accessToken") || "";

  // Get initial Follow/Following state
  const followingList = await getFollowingNames(loggedInUser, token);

  posts.forEach((post) => {
    const feeling = post.feeling || "";
    const isOwnPost = post.author?.name === loggedInUser;
    const likeCount = post._count?.reactions ?? 0;
    const commentCount = post._count?.comments ?? 0;

    const authorAvatar = isOwnPost
      ? getCurrentAvatar()
      : post.author?.avatar?.url || DEFAULT_AVATAR;

    const postHTML = `
      <div class="post-header">
        <div class="user-profile">
          <img src="${authorAvatar}" alt="profile"/>
          <div>
            <div class="author-row">
              <p class="post-author-name">${post.author?.name || "unknown"}${
                feeling ? ` is ${feeling}` : ""
              }</p>
            </div>
            <span>${new Date(post.created).toLocaleString()}</span>
          </div>
        </div>
        ${
          isOwnPost
            ? `
          <i class="fa-solid fa-ellipsis-vertical"></i>
          <div class="edit-del-btns">
            <a href="#" class="edit-btn"><i class="fa-solid fa-pen"></i>Edit Post</a>
            <a href="#" class="delete-btn" data-id="${post.id}"><i class="fa-solid fa-trash-can"></i>Delete Post</a>
          </div>
        `
            : ""
        }
      </div>

      <h2 class="post-title">${post.title || "Untitled Post"}</h2>
      <p class="post-text">${post.body || ""}</p>
      ${
        post.media?.url
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
        <button class="activity-share-btn" type="button"><i class="fa-solid fa-share"></i></button>
      </div>
    `;

    // Build node
    const postElement = document.createElement("div");
    postElement.classList.add("post");
    postElement.dataset.postId = post.id;
    postElement.innerHTML = postHTML;
    container.appendChild(postElement);

    // Fallbacks
    attachImgFallback(
      postElement.querySelector(".user-profile img"),
      DEFAULT_AVATAR,
    );
    attachImgFallback(
      postElement.querySelector(".post-img"),
      DEFAULT_POST_IMAGE,
    );

    // 😀 button to open detail (provided by page script via window)
    const activityBar = postElement.querySelector(".activity-icons");
    if (
      typeof window !== "undefined" &&
      typeof window.attachOpenDetailSmiley === "function"
    ) {
      window.attachOpenDetailSmiley(activityBar, post.id);
    }

    // Follow button (not my post)
    if (!isOwnPost && post.author?.name) {
      const authorRow = postElement.querySelector(".author-row");
      if (authorRow) {
        const followBtn = document.createElement("button");
        followBtn.className = "follow-text";
        followBtn.type = "button";
        followBtn.dataset.author = post.author.name;

        const isAlreadyFollowing = followingList.includes(post.author.name);
        followBtn.textContent = isAlreadyFollowing ? "Following" : "Follow";
        followBtn.setAttribute("aria-pressed", String(isAlreadyFollowing));
        if (isAlreadyFollowing) followBtn.classList.add("following");

        followBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (
            typeof window !== "undefined" &&
            typeof window.toggleFollow === "function"
          ) {
            await window.toggleFollow(post.author.name, followBtn);
          }
        });

        authorRow.appendChild(followBtn);
      }
    }

    // Click anywhere on the card (except UI elements) opens detail
    postElement.addEventListener("click", (e) => {
      if (e.target.closest("button, a, .edit-del-btns, .activity-icons"))
        return;
      if (
        typeof window !== "undefined" &&
        typeof window.openPostDetail === "function"
      ) {
        window.openPostDetail(post.id);
      }
    });

    // Click header open my page or user profile
    const headerEl = postElement.querySelector(".user-profile");
    if (headerEl && post.author?.name) {
      headerEl.addEventListener("click", (e) => {
        e.stopPropagation();
        const me = localStorage.getItem("name");
        if (post.author.name === me) {
          window.location.href = "login-user.html";
        } else {
          window.location.href = `user-profile.html?username=${encodeURIComponent(
            post.author.name,
          )}`;
        }
      });
    }

    // Like button toggle via window.toggleLike
    const likeBtn = postElement.querySelector(".activity-like-btn");
    likeBtn?.addEventListener("click", async () => {
      if (
        typeof window !== "undefined" &&
        typeof window.toggleLike === "function"
      ) {
        await window.toggleLike(post.id, likeBtn);
      }
    });

    // Comment button open detail
    const commentBtn = postElement.querySelector(".activity-comment-count");
    commentBtn?.addEventListener("click", () => {
      if (
        typeof window !== "undefined" &&
        typeof window.openPostDetail === "function"
      ) {
        window.openPostDetail(post.id);
      }
    });

    // Own post: Edit/Delete
    if (isOwnPost) {
      const ellipsis = postElement.querySelector(".fa-ellipsis-vertical");
      const editDelBtns = postElement.querySelector(".edit-del-btns");
      const deleteBtn = postElement.querySelector(".delete-btn");
      const editBtn = postElement.querySelector(".edit-btn");

      // show/hide menu
      if (ellipsis && editDelBtns) {
        ellipsis.addEventListener("click", (e) => {
          e.stopPropagation();
          editDelBtns.classList.toggle("active");
        });
        document.addEventListener("click", () => {
          editDelBtns.classList.remove("active");
        });
      }

      // Delete via page handler
      deleteBtn?.addEventListener("click", async (e) => {
        e.preventDefault();
        if (!confirm("Are you sure you want to delete this post?")) return;
        if (
          typeof window !== "undefined" &&
          typeof window.deletePost === "function"
        ) {
          await window.deletePost(post.id);
        }
      });

      // open modal with this post’s data
      editBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openEditModalForPost(post);
      });
    }
  });
}

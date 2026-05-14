import { API_BASE, Noroff_API_Key } from "./config.js";

/**
 * Creates authorization headers for Noroff API requests.
 *
 * @returns {Object} Headers containing authorization, content type, and API key.
 */
function authHeaders() {
  const token = localStorage.getItem("accessToken");

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Noroff-API-Key": Noroff_API_Key,
  };
}

/**
 * Fetches social posts from the Noroff API.
 *
 * @param {boolean} [includeAuthor=false] - If true, fetches all posts. If false, fetches posts for the logged-in user.
 * @returns {Promise<Array>} A list of posts, or an empty array if unavailable.
 */
export async function fetchPosts(includeAuthor = false) {
  const token = localStorage.getItem("accessToken");
  const username = localStorage.getItem("name");

  if (!token) return [];

  let url;

  if (includeAuthor) {
    url = `${API_BASE}/social/posts?_author=true&_comments=true&_reactions=true`;
  } else {
    if (!username) return [];

    url = `${API_BASE}/social/profiles/${encodeURIComponent(
      username,
    )}/posts?_author=true&_comments=true&_reactions=true`;
  }

  const res = await fetch(url, { headers: authHeaders() });

  if (!res.ok) return [];

  const { data } = await res.json();

  return Array.isArray(data) ? data : [];
}

/**
 * Fetches a single post by ID.
 *
 * @param {string} id - The ID of the post to fetch.
 * @returns {Promise<Object>} The post data.
 * @throws {Error} If the post cannot be loaded.
 */
export async function getSinglePost(id) {
  const res = await fetch(
    `${API_BASE}/social/posts/${encodeURIComponent(
      id,
    )}?_author=true&_comments=true&_reactions=true`,
    { headers: authHeaders() },
  );

  if (!res.ok) throw new Error("Failed to load post");

  const { data } = await res.json();

  return data;
}

/**
 * Creates a new post.
 *
 * @param {Object} payload - The post data to create.
 * @returns {Promise<Object>} The created post data.
 * @throws {Error} If the post cannot be created.
 */
export async function createPost(payload) {
  const res = await fetch(`${API_BASE}/social/posts`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Create failed");

  const { data } = await res.json();

  return data;
}

/**
 * Updates an existing post by ID.
 *
 * @param {string} id - The ID of the post to update.
 * @param {Object} payload - The updated post data.
 * @returns {Promise<Object>} The updated post data.
 * @throws {Error} If the post cannot be updated.
 */
export async function updatePost(id, payload) {
  const res = await fetch(
    `${API_BASE}/social/posts/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) throw new Error("Update failed");

  const { data } = await res.json();

  return data;
}

/**
 * Deletes a post by ID.
 *
 * @param {string} id - The ID of the post to delete.
 * @returns {Promise<boolean>} Returns true when the post is deleted successfully.
 * @throws {Error} If the post cannot be deleted.
 */
export async function deletePost(id) {
  const res = await fetch(
    `${API_BASE}/social/posts/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );

  if (!res.ok) throw new Error("Delete failed");

  return true;
}

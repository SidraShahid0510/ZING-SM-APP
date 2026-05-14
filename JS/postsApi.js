import { API_BASE, Noroff_API_Key } from "./config.js";

function authHeaders() {
  const token = localStorage.getItem("accessToken");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Noroff-API-Key": Noroff_API_Key,
  };
}

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

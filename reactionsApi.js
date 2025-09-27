import { API_BASE, Noroff_API_Key } from "./config.js";

export async function reactThumbsUp(postId) {
  const token = localStorage.getItem("accessToken");
  const symbol = encodeURIComponent("👍");
  const res = await fetch(
    `${API_BASE}/social/posts/${encodeURIComponent(postId)}/react/${symbol}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Noroff-API-Key": Noroff_API_Key,
      },
    }
  );
  if (!res.ok) throw new Error("Reaction failed");
  return true;
}

export async function reactWithEmoji(postId, emoji) {
  const token = localStorage.getItem("accessToken");
  const res = await fetch(
    `${API_BASE}/social/posts/${encodeURIComponent(
      postId
    )}/react/${encodeURIComponent(emoji)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Noroff-API-Key": Noroff_API_Key,
      },
    }
  );
  if (!res.ok) throw new Error("Reaction failed");
  return true;
}

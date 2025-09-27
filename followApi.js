import { API_BASE, Noroff_API_Key } from "./config.js";

export async function followUser(username) {
  const token = localStorage.getItem("accessToken");
  const res = await fetch(
    `${API_BASE}/social/profiles/${encodeURIComponent(username)}/follow`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Noroff-API-Key": Noroff_API_Key,
      },
    }
  );
  if (!res.ok) throw new Error("Follow failed");
  return true;
}

export async function unfollowUser(username) {
  const token = localStorage.getItem("accessToken");
  const res = await fetch(
    `${API_BASE}/social/profiles/${encodeURIComponent(username)}/unfollow`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Noroff-API-Key": Noroff_API_Key,
      },
    }
  );
  if (!res.ok) throw new Error("Unfollow failed");
  return true;
}

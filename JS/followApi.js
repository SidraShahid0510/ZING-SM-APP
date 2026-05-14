import { API_BASE, Noroff_API_Key } from "./config.js";
/**
 * Follow a user profile by username.
 *
 * Issues a `PUT` request to `${API_BASE}/social/profiles/{username}/follow`.
 * The `username` is safely URL-encoded. Requires a valid Bearer token.
 *
 * @async
 * @param {string} username - The target profile's username.
 * @returns {Promise<true>} Resolves to `true` when the follow succeeds.
 * @throws {Error} Throws `Error("Follow failed")` if the network request returns a non-2xx response.
 * @example
 * // Follow the user "alice"
 * await followUser("alice");
 */
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
    },
  );
  if (!res.ok) throw new Error("Follow failed");
  return true;
}
/**
 * Unfollow a user profile by username.
 *
 * Issues a `PUT` request to `${API_BASE}/social/profiles/{username}/unfollow`.
 * The `username` is safely URL-encoded. Requires a valid Bearer token.
 *
 * @async
 * @param {string} username - The target profile's username.
 * @returns {Promise<true>} Resolves to `true` when the unfollow succeeds.
 * @throws {Error} Throws `Error("Unfollow failed")` if the network request returns a non-2xx response.
 * @example
 * // Unfollow the user "alice"
 * await unfollowUser("alice");
 */
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
    },
  );
  if (!res.ok) throw new Error("Unfollow failed");
  return true;
}

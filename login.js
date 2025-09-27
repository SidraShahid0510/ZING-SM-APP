const Noroff_API_Key = "384ffc1f-5fb6-497c-b8ef-68eb6ba14e6f";

const loginForm = document.querySelector("#form");
const message = document.querySelector(".message");
const loader = document.getElementById("loader");
hideLoader();
function showLoader() {
  document.getElementById("loader").style.display = "flex";
}

function hideLoader() {
  document.getElementById("loader").style.display = "none";
}

async function hydrateAvatarCache() {
  const accessToken = localStorage.getItem("accessToken");
  const username = localStorage.getItem("name");
  if (!accessToken || !username) return;

  try {
    const res = await fetch(
      `https://v2.api.noroff.dev/social/profiles/${encodeURIComponent(
        username
      )}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Noroff-API-Key": Noroff_API_Key,
        },
      }
    );
    const { data } = await res.json();
    const url = (data?.avatar?.url || "").trim();
    if (url) {
      localStorage.setItem("avatarUrl", url);
      localStorage.setItem("avatarVer", String(Date.now()));
    } else {
      localStorage.removeItem("avatarUrl");
      localStorage.removeItem("avatarVer");
    }
  } catch (e) {
    console.warn("Could not hydrate avatar cache:", e);
  }
}
/**
 * Logs in the user by sending credentials to the Noroff API.
 * @param {Object} userdetails - The login details.
 * @param {string} userdetails.email - The user's email address.
 * @param {string} userdetails.password - The user's password.
 * @returns {Promise<void>} A promise that resolves when login is complete.
 */
async function loginUser(userdetails) {
  showLoader(); // Show loader when login starts
  message.textContent = "";

  try {
    const response = await fetch("https://v2.api.noroff.dev/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userdetails),
    });
    const result = await response.json();

    if (!response.ok) {
      hideLoader(); // Stop loader on login error
      message.textContent =
        result?.errors?.map((err) => err.message).join(", ") || "Login failed.";
      return;
    }

    localStorage.setItem("accessToken", result.data.accessToken);
    localStorage.setItem("name", result.data.name);

    hideLoader(); // Stop loader before leaving
    window.location.href = "feed.html"; // Go to main page
  } catch (err) {
    hideLoader(); // Stop loader on network error
    message.textContent = "Network error. Please try again.";
  }
}
/**
 * Handles form submission, validates email, and calls the login function.
 * @param {Event} e - The form submit event.
 * @returns {void}
 */
function formSubmit(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const formFields = Object.fromEntries(formData);
  const email = formFields.email || "";

  // basic email check
  if (!email.endsWith("@stud.noroff.no")) {
    message.textContent = "Email must end with @stud.noroff.no";
    return;
  }

  loginUser(formFields);
}

loginForm.addEventListener("submit", formSubmit);

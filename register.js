const registrationForm = document.querySelector("#form");
const message = document.querySelector(".message");
const loader = document.getElementById("loader");
hideLoader();
function showLoader() {
  document.getElementById("loader").style.display = "flex";
}

function hideLoader() {
  document.getElementById("loader").style.display = "none";
}

async function registerUser(userdetails) {
  try {
    showLoader(); // Show loader when user clicks register
    message.textContent = "";

    const fetchOptions = {
      method: "POST",
      body: JSON.stringify(userdetails),
      headers: {
        "Content-Type": "application/json",
      },
    };

    const response = await fetch(
      "https://v2.api.noroff.dev/auth/register",
      fetchOptions
    );
    const result = await response.json();

    if (response.ok) {
      message.textContent = "Registration successful!";
      console.log("User registered:", result);

      // Short delay to show success message, then redirect
      setTimeout(() => {
        hideLoader();
        window.location.href = "index.html"; // Login page
      }, 800); // 0.8s delay for smooth transition
    } else {
      hideLoader();
      message.textContent =
        result.errors?.map((err) => err.message).join(", ") ||
        "Something went wrong.";
      console.error("API error:", result);
    }
  } catch (error) {
    hideLoader();
    message.textContent = "Network error. Please try again later.";
    console.error("Fetch error:", error);
  }
}

function formSubmit(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const formFields = Object.fromEntries(formData);

  // Basic email check
  if (!formFields.email.endsWith("@stud.noroff.no")) {
    message.textContent = "Email must end with @stud.noroff.no";
    return;
  }

  registerUser(formFields);
}

registrationForm.addEventListener("submit", formSubmit);

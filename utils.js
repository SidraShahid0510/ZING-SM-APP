/**
 * Delays a function until the user stops triggering it for a short time.
 * Useful for search inputs, resize events, and typing actions.
 */
export function debounce(fn, delay = 200) {
  let id;

  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Adds a fallback image if the original image fails to load.
 */
export function attachImgFallback(img, fallbackUrl) {
  if (!img) return;

  const onErr = () => {
    img.removeEventListener("error", onErr);
    img.src = fallbackUrl;
  };

  img.addEventListener("error", onErr, { once: true });

  const s = (img.getAttribute("src") || "").trim();

  if (!s) {
    img.src = fallbackUrl;
  }
}

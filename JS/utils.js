export function debounce(fn, delay = 200) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), delay);
  };
}

export function attachImgFallback(img, fallbackUrl) {
  if (!img) return;
  const onErr = () => {
    img.removeEventListener("error", onErr);
    img.src = fallbackUrl;
  };
  img.addEventListener("error", onErr, { once: true });
  const s = (img.getAttribute("src") || "").trim();
  if (!s) img.src = fallbackUrl;
}

/**
 * Loader Module
 * Shows and hides the loading spinner
 */

const loader = document.getElementById("page-loader");

function showLoader() {
  if (loader) {
    loader.classList.remove("loader-hidden");
    loader.classList.add("loader-visible");
  }
}

function hideLoader() {
  if (loader) {
    loader.classList.remove("loader-visible");
    loader.classList.add("loader-hidden");
  }
}

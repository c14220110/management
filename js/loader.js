/**
 * Loader Module
 * Shows and hides the loading spinner
 */

const loader = document.getElementById("page-loader");

const loaderFiles = [
  "js/pages/dashboard.js",
  "js/pages/barang.js",
  "js/pages/transportasi.js",
  "js/pages/ruangan.js",
  "js/pages/user-management.js",
  "js/pages/website-gki.js",
  "js/pages/stok-opname.js"
];

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

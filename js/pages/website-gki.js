/**
 * Website GKI Page Module
 * Handles website content management for public-facing website
 */

let websiteContentData = {
  hero: {
    title: "",
    subtitle: "",
    videoUrl: "",
  },
  schedules: {
    title: "",
    subtitle: "",
    items: [],
  },
  about: {
    badge: "",
    heading: "",
    paragraph1: "",
    paragraph2: "",
    ctaText: "",
    ctaUrl: "",
    imageUrl: "",
  },
  pastor: {
    badge: "",
    name: "",
    phone: "",
    description: "",
    whatsappUrl: "",
    buttonText: "",
    imageUrl: "",
  },
};

// File video baru yang dipilih tapi belum di-upload
let pendingHeroVideoFile = null;

async function loadWebsiteGkiPage() {
  const contentArea = document.getElementById("content-area");
  showLoader();
  try {
    contentArea.innerHTML = "";
    const template = document
      .getElementById("website-gki-template")
      .content.cloneNode(true);
    contentArea.appendChild(template);

    await loadWebsiteContent();
  } catch (error) {
    contentArea.innerHTML = `<p class="text-red-500">Terjadi error saat memuat halaman website: ${error.message}</p>`;
  } finally {
    hideLoader();
  }
}

// Helper: upload gambar ke /api/website-image-upload
async function uploadWebsiteImage(target, file) {
  const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
  if (!file) {
    throw new Error("File gambar tidak ditemukan.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Ukuran gambar melebihi 2 MB.");
  }

  const token = localStorage.getItem("authToken");
  if (!token) {
    throw new Error(
      "Token login tidak ditemukan. Silakan login ulang kemudian coba lagi."
    );
  }

  // File -> Base64
  const base64Data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(new Error("Gagal membaca file gambar (FileReader error)."));
    reader.readAsDataURL(file);
  });

  const resp = await fetch("/api/website?action=upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || "image/jpeg",
      base64Data,
      target, // "about" atau "pastor"
    }),
  });

  const result = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(result.error || "Gagal mengunggah gambar.");
  }

  if (!result.url) {
    throw new Error("Server tidak mengembalikan URL gambar.");
  }

  return result.url;
}

// Helper: pasang event change ke input file + update hidden + preview
function setupImageUploader(
  sectionKey,
  fileInputId,
  urlInputId,
  previewId
) {
  const fileInput = document.getElementById(fileInputId);
  const urlInput = document.getElementById(urlInputId);
  const preview = document.getElementById(previewId);

  if (!fileInput) return;

  fileInput.value = "";

  fileInput.onchange = async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    try {
      const url = await uploadWebsiteImage(sectionKey, file);

      if (urlInput) {
        urlInput.value = url;
      }
      if (preview) {
        preview.src = url;
        preview.classList.remove("hidden");
      }

      // sinkronkan dengan objek websiteContentData kalau ada
      if (
        typeof websiteContentData === "object" &&
        websiteContentData[sectionKey]
      ) {
        websiteContentData[sectionKey].imageUrl = url;
      }

      alert("✅ Gambar berhasil diunggah.");
    } catch (err) {
      console.error(err);
      alert("❌ " + (err.message || "Gagal mengunggah gambar."));
      fileInput.value = "";
    }
  };
}

async function loadWebsiteContent() {
  try {
    const response = await fetch("/api/website");
    if (!response.ok) throw new Error("Gagal memuat konten website");

    const data = await response.json();

    // === Normalisasi HERO, SCHEDULES, ABOUT, PASTOR ===
    websiteContentData.hero = {
      title: data.hero?.title ?? "Selamat Datang di GKI Kutisari Indah",
      subtitle:
        data.hero?.subtitle ??
        "Gereja yang bertumbuh dalam Iman, Kasih, dan Pelayanan bagi sesama.",
      videoUrl: data.hero?.videoUrl ?? "assets/bg_gki.mp4",
    };

    websiteContentData.schedules = {
      title: data.schedules?.title ?? "Jadwal Ibadah & Kegiatan",
      subtitle:
        data.schedules?.subtitle ??
        "Kami mengundang Anda untuk bersekutu bersama kami. Berikut adalah jadwal kegiatan rutin kami.",
      items: data.schedules?.items ?? [],
    };

    websiteContentData.about = {
      badge: data.about?.badge ?? "TENTANG KAMI",
      heading: data.about?.heading ?? "Mengenal GKI Kutisari Indah",
      paragraph1:
        data.about?.paragraph1 ??
        "Komunitas yang bertumbuh dalam pengenalan akan Kristus, saling mengasihi, dan melayani.",
      paragraph2:
        data.about?.paragraph2 ??
        "Visi kami: gereja yang relevan, berdampak, dan menjadi berkat.",
      ctaText: data.about?.ctaText ?? "Visi, Misi & Sejarah",
      ctaUrl: data.about?.ctaUrl ?? "#",
      imageUrl: data.about?.imageUrl ?? "assets/gedung_gereja.jpg",
    };

    websiteContentData.pastor = {
      badge: data.pastor?.badge ?? "PROFIL GEMBALA SIDANG",
      name: data.pastor?.name ?? "Pdt. William Suryajaya",
      phone: data.pastor?.phone ?? "087808786969",
      description:
        data.pastor?.description ??
        "Gembala sidang yang memimpin dengan dedikasi dan kasih, membimbing jemaat dalam pertumbuhan rohani.",
      whatsappUrl:
        data.pastor?.whatsappUrl ?? "https://wa.me/6287808786969",
      buttonText: data.pastor?.buttonText ?? "Hubungi Pendeta",
      imageUrl: data.pastor?.imageUrl ?? "assets/pastor.jpg",
    };

    // === Populate HERO ===
    const heroTitleInput = document.getElementById("heroTitle");
    const heroSubtitleInput = document.getElementById("heroSubtitle");
    if (heroTitleInput)
      heroTitleInput.value = websiteContentData.hero.title || "";
    if (heroSubtitleInput)
      heroSubtitleInput.value = websiteContentData.hero.subtitle || "";

    // Hero video: preview & input file
    const heroVideoPreview = document.getElementById("heroVideoPreview");
    const heroVideoFileInput = document.getElementById("heroVideoFile");

    const currentVideoUrl =
      websiteContentData.hero.videoUrl || "assets/bg_gki.mp4";
    websiteContentData.hero.videoUrl = currentVideoUrl;

    if (heroVideoPreview && currentVideoUrl) {
      heroVideoPreview.src = currentVideoUrl;
      heroVideoPreview.classList.remove("hidden");
    }

    if (heroVideoFileInput) {
      heroVideoFileInput.value = "";
      heroVideoFileInput.onchange = () => {
        const file = heroVideoFileInput.files[0];
        if (!file) {
          pendingHeroVideoFile = null;
          return;
        }

        const maxBytes = 4 * 1024 * 1024; // ~4 MB
        if (file.size > maxBytes) {
          const mb = (file.size / (1024 * 1024)).toFixed(2);
          alert(
            `Untuk saat ini ukuran video maksimal sekitar 4 MB.\nFile yang dipilih: ${mb} MB.\nSilakan kompres / pilih video yang lebih kecil.`
          );
          heroVideoFileInput.value = "";
          pendingHeroVideoFile = null;
          return;
        }

        pendingHeroVideoFile = file;

        if (heroVideoPreview) {
          const blobUrl = URL.createObjectURL(file);
          heroVideoPreview.src = blobUrl;
          heroVideoPreview.classList.remove("hidden");
        }
      };
    }

    // === Populate SCHEDULES ===
    const schedulesTitleInput = document.getElementById("schedulesTitle");
    const schedulesSubtitleInput =
      document.getElementById("schedulesSubtitle");
    if (schedulesTitleInput)
      schedulesTitleInput.value =
        websiteContentData.schedules.title || "";
    if (schedulesSubtitleInput)
      schedulesSubtitleInput.value =
        websiteContentData.schedules.subtitle || "";

    // === Populate ABOUT ===
    const aboutBadgeInput = document.getElementById("aboutBadge");
    const aboutHeadingInput = document.getElementById("aboutHeading");
    const aboutParagraph1Input =
      document.getElementById("aboutParagraph1");
    const aboutParagraph2Input =
      document.getElementById("aboutParagraph2");
    const aboutCtaTextInput = document.getElementById("aboutCtaText");
    const aboutCtaUrlInput = document.getElementById("aboutCtaUrl");
    const aboutImageUrlInput = document.getElementById("aboutImageUrl");
    const aboutImagePreview =
      document.getElementById("aboutImagePreview");

    if (aboutBadgeInput)
      aboutBadgeInput.value = websiteContentData.about.badge || "";
    if (aboutHeadingInput)
      aboutHeadingInput.value = websiteContentData.about.heading || "";
    if (aboutParagraph1Input)
      aboutParagraph1Input.value =
        websiteContentData.about.paragraph1 || "";
    if (aboutParagraph2Input)
      aboutParagraph2Input.value =
        websiteContentData.about.paragraph2 || "";
    if (aboutCtaTextInput)
      aboutCtaTextInput.value = websiteContentData.about.ctaText || "";
    if (aboutCtaUrlInput)
      aboutCtaUrlInput.value = websiteContentData.about.ctaUrl || "";
    if (aboutImageUrlInput) {
      aboutImageUrlInput.value = websiteContentData.about.imageUrl || "";
      aboutImageUrlInput.oninput = () => {
        const url = aboutImageUrlInput.value.trim();
        if (aboutImagePreview) {
          if (url) {
            aboutImagePreview.src = url;
            aboutImagePreview.classList.remove("hidden");
          } else {
            aboutImagePreview.classList.add("hidden");
          }
        }
      };
    }
    if (aboutImagePreview && websiteContentData.about.imageUrl) {
      aboutImagePreview.src = websiteContentData.about.imageUrl;
      aboutImagePreview.classList.remove("hidden");
    }

    // === Populate PASTOR ===
    const pastorBadgeInput = document.getElementById("pastorBadge");
    const pastorNameInput = document.getElementById("pastorName");
    const pastorPhoneInput = document.getElementById("pastorPhone");
    const pastorDescriptionInput =
      document.getElementById("pastorDescription");
    const pastorWhatsappUrlInput =
      document.getElementById("pastorWhatsappUrl");
    const pastorButtonTextInput =
      document.getElementById("pastorButtonText");
    const pastorImageUrlInput = document.getElementById("pastorImageUrl");
    const pastorImagePreview =
      document.getElementById("pastorImagePreview");

    if (pastorBadgeInput)
      pastorBadgeInput.value = websiteContentData.pastor.badge || "";
    if (pastorNameInput)
      pastorNameInput.value = websiteContentData.pastor.name || "";
    if (pastorPhoneInput)
      pastorPhoneInput.value = websiteContentData.pastor.phone || "";
    if (pastorDescriptionInput)
      pastorDescriptionInput.value =
        websiteContentData.pastor.description || "";
    if (pastorWhatsappUrlInput)
      pastorWhatsappUrlInput.value =
        websiteContentData.pastor.whatsappUrl || "";
    if (pastorButtonTextInput)
      pastorButtonTextInput.value =
        websiteContentData.pastor.buttonText || "";
    if (pastorImageUrlInput) {
      pastorImageUrlInput.value =
        websiteContentData.pastor.imageUrl || "";
      pastorImageUrlInput.oninput = () => {
        const url = pastorImageUrlInput.value.trim();
        if (pastorImagePreview) {
          if (url) {
            pastorImagePreview.src = url;
            pastorImagePreview.classList.remove("hidden");
          } else {
            pastorImagePreview.classList.add("hidden");
          }
        }
      };
    }
    if (pastorImagePreview && websiteContentData.pastor.imageUrl) {
      pastorImagePreview.src = websiteContentData.pastor.imageUrl;
      pastorImagePreview.classList.remove("hidden");
    }

    setupImageUploader(
      "about",
      "aboutImageFile",
      "aboutImageUrl",
      "aboutImagePreview"
    );

    setupImageUploader(
      "pastor",
      "pastorImageFile",
      "pastorImageUrl",
      "pastorImagePreview"
    );

    // === Render cards jadwal ===
    renderScheduleCards();

    // === Tombol Tambah Jadwal ===
    const addBtn = document.getElementById("addScheduleBtn");
    if (addBtn) {
      addBtn.onclick = () => {
        const items = websiteContentData.schedules.items;
        if (items.length >= 5) {
          alert("Maksimal 5 jadwal!");
          return;
        }

        items.push({
          id: Date.now().toString(),
          name: "",
          time: "",
          description: "",
        });
        renderScheduleCards();
        alert("Jadwal baru ditambahkan. Isi semua field lalu simpan.");
      };
    }

    // === Tombol Simpan ===
    const saveBtn = document.getElementById("saveWebsiteBtn");
    if (saveBtn) {
      async function uploadHeroVideoIfNeeded() {
        if (!pendingHeroVideoFile) {
          return websiteContentData.hero.videoUrl || "assets/bg_gki.mp4";
        }

        const file = pendingHeroVideoFile;
        const maxBytes = 4 * 1024 * 1024;

        if (file.size > maxBytes) {
          throw new Error(
            "Ukuran video terlalu besar untuk server saat ini (maks ±4 MB)."
          );
        }

        const token = localStorage.getItem("authToken");
        if (!token) {
          throw new Error(
            "Token login tidak ditemukan. Silakan login ulang."
          );
        }

        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result || "";
            const base64 = result.toString().split(",")[1] || "";
            resolve(base64);
          };
          reader.onerror = () =>
            reject(new Error("Gagal membaca file video."));
          reader.readAsDataURL(file);
        });

        const resp = await fetch("/api/website?action=upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || "video/mp4",
            base64Data,
          }),
        });

        const uploadResult = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(
            uploadResult.error || "Gagal mengunggah video hero ke server."
          );
        }

        const url = uploadResult.url;
        pendingHeroVideoFile = null;
        websiteContentData.hero.videoUrl = url;
        return url;
      }

      saveBtn.onclick = async () => {
        const originalHTML = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = `
    <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Menyimpan...
  `;

        try {
          // Ambil nilai terbaru dari form
          const heroTitle = document.getElementById("heroTitle");
          const heroSubtitle = document.getElementById("heroSubtitle");
          const schedulesTitle =
            document.getElementById("schedulesTitle");
          const schedulesSubtitle =
            document.getElementById("schedulesSubtitle");

          if (heroTitle) websiteContentData.hero.title = heroTitle.value;
          if (heroSubtitle)
            websiteContentData.hero.subtitle = heroSubtitle.value;
          if (schedulesTitle)
            websiteContentData.schedules.title = schedulesTitle.value;
          if (schedulesSubtitle)
            websiteContentData.schedules.subtitle =
              schedulesSubtitle.value;

          // ABOUT
          const aboutBadgeInput2 = document.getElementById("aboutBadge");
          const aboutHeadingInput2 =
            document.getElementById("aboutHeading");
          const aboutParagraph1Input2 =
            document.getElementById("aboutParagraph1");
          const aboutParagraph2Input2 =
            document.getElementById("aboutParagraph2");
          const aboutCtaTextInput2 =
            document.getElementById("aboutCtaText");
          const aboutCtaUrlInput2 =
            document.getElementById("aboutCtaUrl");
          const aboutImageUrlInput2 =
            document.getElementById("aboutImageUrl");

          if (aboutBadgeInput2)
            websiteContentData.about.badge = aboutBadgeInput2.value;
          if (aboutHeadingInput2)
            websiteContentData.about.heading = aboutHeadingInput2.value;
          if (aboutParagraph1Input2)
            websiteContentData.about.paragraph1 =
              aboutParagraph1Input2.value;
          if (aboutParagraph2Input2)
            websiteContentData.about.paragraph2 =
              aboutParagraph2Input2.value;
          if (aboutCtaTextInput2)
            websiteContentData.about.ctaText = aboutCtaTextInput2.value;
          if (aboutCtaUrlInput2)
            websiteContentData.about.ctaUrl = aboutCtaUrlInput2.value;
          if (aboutImageUrlInput2)
            websiteContentData.about.imageUrl = aboutImageUrlInput2.value;

          // PASTOR
          const pastorBadgeInput2 =
            document.getElementById("pastorBadge");
          const pastorNameInput2 = document.getElementById("pastorName");
          const pastorPhoneInput2 =
            document.getElementById("pastorPhone");
          const pastorDescriptionInput2 =
            document.getElementById("pastorDescription");
          const pastorWhatsappUrlInput2 =
            document.getElementById("pastorWhatsappUrl");
          const pastorButtonTextInput2 =
            document.getElementById("pastorButtonText");
          const pastorImageUrlInput2 =
            document.getElementById("pastorImageUrl");

          if (pastorBadgeInput2)
            websiteContentData.pastor.badge = pastorBadgeInput2.value;
          if (pastorNameInput2)
            websiteContentData.pastor.name = pastorNameInput2.value;
          if (pastorPhoneInput2)
            websiteContentData.pastor.phone = pastorPhoneInput2.value;
          if (pastorDescriptionInput2)
            websiteContentData.pastor.description =
              pastorDescriptionInput2.value;
          if (pastorWhatsappUrlInput2)
            websiteContentData.pastor.whatsappUrl =
              pastorWhatsappUrlInput2.value;
          if (pastorButtonTextInput2)
            websiteContentData.pastor.buttonText =
              pastorButtonTextInput2.value;
          if (pastorImageUrlInput2)
            websiteContentData.pastor.imageUrl =
              pastorImageUrlInput2.value;

          // Validasi minimal (tetap sama untuk hero & jadwal)
          if (
            !websiteContentData.hero.title ||
            !websiteContentData.hero.subtitle
          ) {
            throw new Error("Judul dan sub judul hero harus diisi!");
          }
          if (websiteContentData.schedules.items.length === 0) {
            throw new Error("Minimal harus ada 1 jadwal!");
          }

          for (
            let i = 0;
            i < websiteContentData.schedules.items.length;
            i++
          ) {
            const item = websiteContentData.schedules.items[i];
            if (!item.name || !item.time || !item.description) {
              throw new Error(
                `Jadwal #${i + 1}: Semua field harus diisi!`
              );
            }
          }

          // Upload video kalau ada file baru
          const newVideoUrl = await uploadHeroVideoIfNeeded();
          websiteContentData.hero.videoUrl = newVideoUrl;

          // === Simpan ke /api/website-content ===
          const authHeader = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          };

          // Hero
          const heroResponse = await fetch("/api/website", {
            method: "POST",
            headers: authHeader,
            body: JSON.stringify({
              contentKey: "hero",
              contentData: websiteContentData.hero,
            }),
          });
          if (!heroResponse.ok) {
            const err = await heroResponse.json().catch(() => ({}));
            throw new Error(err.error || "Gagal menyimpan hero section");
          }

          // Schedules
          const schedulesResponse = await fetch("/api/website", {
            method: "POST",
            headers: authHeader,
            body: JSON.stringify({
              contentKey: "schedules",
              contentData: websiteContentData.schedules,
            }),
          });
          if (!schedulesResponse.ok) {
            const err = await schedulesResponse.json().catch(() => ({}));
            throw new Error(err.error || "Gagal menyimpan jadwal");
          }

          // About
          const aboutResponse = await fetch("/api/website", {
            method: "POST",
            headers: authHeader,
            body: JSON.stringify({
              contentKey: "about",
              contentData: websiteContentData.about,
            }),
          });
          if (!aboutResponse.ok) {
            const err = await aboutResponse.json().catch(() => ({}));
            throw new Error(
              err.error || "Gagal menyimpan section Tentang Kami"
            );
          }

          // Pastor
          const pastorResponse = await fetch("/api/website", {
            method: "POST",
            headers: authHeader,
            body: JSON.stringify({
              contentKey: "pastor",
              contentData: websiteContentData.pastor,
            }),
          });
          if (!pastorResponse.ok) {
            const err = await pastorResponse.json().catch(() => ({}));
            throw new Error(
              err.error || "Gagal menyimpan Profil Gembala Sidang"
            );
          }

          alert("✅ Konten website berhasil disimpan!");
        } catch (error) {
          alert("❌ " + error.message);
          console.error("❌ Error saving:", error);
        } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalHTML;
        }
      };
    }
  } catch (error) {
    alert("Gagal memuat konten website: " + error.message);
  }
}

function renderScheduleCards() {
  const container = document.getElementById("scheduleCardsContainer");
  if (!container) return;

  container.innerHTML = "";

  const items = websiteContentData.schedules?.items || [];

  if (items.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-gray-500">
        <i class="fas fa-calendar-times text-4xl mb-3"></i>
        <p>Belum ada jadwal. Klik "Tambah Jadwal" untuk mulai.</p>
      </div>
    `;
    return;
  }

  items.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "bg-gray-50 border border-gray-200 rounded-lg p-4";
    card.innerHTML = `
      <div class="flex items-start gap-4">
        <div class="flex flex-col gap-1">
          <button onclick="moveSchedule(${index}, 'up')" class="p-2 hover:bg-gray-200 rounded transition text-gray-600 ${
      index === 0 ? "opacity-30 cursor-not-allowed" : ""
    }" ${index === 0 ? "disabled" : ""} title="Pindah ke atas">
            <i class="fas fa-chevron-up"></i>
          </button>
          <button onclick="moveSchedule(${index}, 'down')" class="p-2 hover:bg-gray-200 rounded transition text-gray-600 ${
      index === items.length - 1 ? "opacity-30 cursor-not-allowed" : ""
    }" ${
      index === items.length - 1 ? "disabled" : ""
    } title="Pindah ke bawah">
            <i class="fas fa-chevron-down"></i>
          </button>
        </div>
        <div class="flex-1 space-y-3">
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">Nama Ibadah/Kegiatan</label>
            <input type="text" value="${
              item.name || ""
            }" onchange="updateScheduleItem(${index}, 'name', this.value)" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" placeholder="Ibadah Umum I" maxlength="50" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">Waktu</label>
            <input type="text" value="${
              item.time || ""
            }" onchange="updateScheduleItem(${index}, 'time', this.value)" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" placeholder="Setiap Minggu, 07:00 WIB" maxlength="100" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">Deskripsi</label>
            <textarea onchange="updateScheduleItem(${index}, 'description', this.value)" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" rows="2" placeholder="Deskripsi singkat..." maxlength="150">${
      item.description || ""
    }</textarea>
          </div>
        </div>
        <button onclick="deleteSchedule(${index})" class="p-2 hover:bg-red-100 text-red-600 rounded transition ${
      items.length === 1 ? "opacity-30 cursor-not-allowed" : ""
    }" title="Hapus jadwal" ${items.length === 1 ? "disabled" : ""}>
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    `;
    container.appendChild(card);
  });

  updateAddButtonState();
}

function updateScheduleItem(index, field, value) {
  if (!websiteContentData.schedules.items[index]) return;
  websiteContentData.schedules.items[index][field] = value;
}

function moveSchedule(index, direction) {
  const items = websiteContentData.schedules.items;
  if (direction === "up" && index > 0) {
    [items[index], items[index - 1]] = [items[index - 1], items[index]];
    renderScheduleCards();
  } else if (direction === "down" && index < items.length - 1) {
    [items[index], items[index + 1]] = [items[index + 1], items[index]];
    renderScheduleCards();
  }
}

function deleteSchedule(index) {
  const items = websiteContentData.schedules.items;
  if (items.length <= 1) {
    alert("Minimal harus ada 1 jadwal!");
    return;
  }

  if (confirm("Yakin ingin menghapus jadwal ini?")) {
    items.splice(index, 1);
    renderScheduleCards();
    alert("Jadwal berhasil dihapus");
  }
}

function updateAddButtonState() {
  const addBtn = document.getElementById("addScheduleBtn");
  if (!addBtn) return;

  const items = websiteContentData.schedules.items;
  if (items.length >= 5) {
    addBtn.disabled = true;
    addBtn.classList.add("opacity-50", "cursor-not-allowed");
  } else {
    addBtn.disabled = false;
    addBtn.classList.remove("opacity-50", "cursor-not-allowed");
  }
}

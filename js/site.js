(() => {
  const storageKey = "tanimtech-demo-inputs";
  const toastRegion = document.createElement("div");
  toastRegion.className = "toast-region";
  toastRegion.setAttribute("aria-live", "polite");
  toastRegion.setAttribute("aria-atomic", "true");
  document.body.append(toastRegion);

  let toastTimer;
  const showToast = (message) => {
    window.clearTimeout(toastTimer);
    toastRegion.replaceChildren();
    const toast = document.createElement("div");
    toast.className = "toast-message";
    toast.setAttribute("role", "status");
    toast.textContent = message;
    toastRegion.append(toast);
    toastTimer = window.setTimeout(() => toastRegion.replaceChildren(), 3600);
  };

  const readState = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      showToast("Saved inputs could not be loaded. Your current entries are still available on this page.");
      return {};
    }
  };

  let state = readState();
  const saveState = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      return true;
    } catch (error) {
      showToast("Your browser blocked local saving. Keep this page open to retain your entries.");
      return false;
    }
  };

  document.querySelectorAll("[data-dev-feature]").forEach((feature) => {
    feature.addEventListener("click", (event) => {
      event.preventDefault();
      showToast(`${feature.dataset.devFeature} is under development.`);
    });
  });

  document.querySelectorAll("[data-dev-preview]").forEach((feature) => {
    feature.addEventListener("click", (event) => {
      event.preventDefault();
      showToast(`${feature.dataset.devPreview} is under development. Opening the static preview.`);
      window.setTimeout(() => {
        window.location.href = feature.href;
      }, 1200);
    });
  });

  const photoFileInput = document.querySelector("[data-photo-file]");
  const photoPreview = document.querySelector("[data-photo-preview]");
  const reviewPhoto = document.querySelector("[data-photo-review-image]");
  const photoImage = photoPreview || reviewPhoto;
  const photoPlaceholder = document.querySelector(
    photoPreview ? "[data-photo-placeholder]" : "[data-photo-review-placeholder]"
  );
  const photoName = document.querySelector(
    photoPreview ? "[data-photo-name]" : "[data-photo-review-name]"
  );
  const photoDetails = document.querySelector(
    photoPreview ? "[data-photo-details]" : "[data-photo-review-details]"
  );
  const photoStatus = document.querySelector("[data-photo-status]");
  const cameraPanel = document.querySelector("[data-camera-panel]");
  const cameraVideo = document.querySelector("[data-camera-video]");
  const cameraMessage = document.querySelector("[data-camera-message]");
  const consentCheckbox = document.querySelector("[data-photo-consent]");
  let cameraStream = null;
  let photoObjectUrl = null;
  let currentPhoto = null;
  let photoStored = false;

  const openPhotoDatabase = () => new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("This browser does not support local photo storage."));
      return;
    }
    const request = indexedDB.open("tanimtech-local-photos", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("photos")) {
        request.result.createObjectStore("photos");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("The photo database could not be opened."));
    request.onblocked = () => reject(new Error("The photo database is blocked by another open tab."));
  });

  const savePhotoToDevice = async (photo) => {
    const database = await openPhotoDatabase();
    try {
      await new Promise((resolve, reject) => {
        const transaction = database.transaction("photos", "readwrite");
        transaction.objectStore("photos").put(photo, "soil-photo");
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error("The photo could not be saved."));
        transaction.onabort = () => reject(transaction.error || new Error("Saving the photo was cancelled."));
      });
    } finally {
      database.close();
    }
  };

  const loadPhotoFromDevice = async () => {
    const database = await openPhotoDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const request = database.transaction("photos", "readonly").objectStore("photos").get("soil-photo");
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error("The saved photo could not be read."));
      });
    } finally {
      database.close();
    }
  };

  const deletePhotoFromDevice = async () => {
    const database = await openPhotoDatabase();
    try {
      await new Promise((resolve, reject) => {
        const transaction = database.transaction("photos", "readwrite");
        transaction.objectStore("photos").delete("soil-photo");
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error("The saved photo could not be removed."));
        transaction.onabort = () => reject(transaction.error || new Error("Removing the photo was cancelled."));
      });
    } finally {
      database.close();
    }
  };

  const stopCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    if (cameraVideo) cameraVideo.srcObject = null;
    cameraPanel?.classList.add("hidden");
  };

  const displayPhoto = async (photo, saveToDevice = true) => {
    if (!photoImage || !photoPlaceholder) return;
    const blob = photo.blob || photo;
    const name = photo.name || "camera-capture.jpg";
    if (!(blob instanceof Blob) || !blob.size) {
      showToast("This photo could not be opened. Please choose another JPG or PNG.");
      return;
    }

    const nextUrl = URL.createObjectURL(blob);
    try {
      await new Promise((resolve, reject) => {
        photoImage.onload = resolve;
        photoImage.onerror = () => reject(new Error("The selected file is not a readable image."));
        photoImage.src = nextUrl;
      });
    } catch (error) {
      URL.revokeObjectURL(nextUrl);
      showToast(error.message);
      return;
    }

    if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
    photoObjectUrl = nextUrl;
    currentPhoto = { blob, name, type: blob.type, size: blob.size, updatedAt: Date.now() };
    photoStored = !saveToDevice;
    photoImage.classList.remove("hidden");
    photoPlaceholder.classList.add("hidden");
    if (photoName) photoName.textContent = name;
    if (photoDetails) {
      const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);
      photoDetails.textContent = `${blob.type || "Image"} · ${sizeMb} MB · stored only on this device`;
    }
    if (photoStatus) photoStatus.textContent = "PHOTO READY";

    if (saveToDevice) {
      try {
        await savePhotoToDevice(currentPhoto);
        photoStored = true;
        showToast("Photo ready. It is saved only in this browser on this device.");
      } catch (error) {
        photoStored = false;
        showToast(`${error.message} You can still preview it on this page.`);
      }
    }
  };

  if (photoFileInput) {
    document.querySelectorAll("[data-open-file]").forEach((button) => {
      button.addEventListener("click", () => photoFileInput.click());
    });
    photoFileInput.addEventListener("change", async () => {
      const file = photoFileInput.files?.[0];
      if (!file) return;
      const acceptedType = ["image/jpeg", "image/png"].includes(file.type);
      const acceptedExtension = /\.(jpe?g|png)$/i.test(file.name);
      if (!(acceptedType || (!file.type && acceptedExtension))) {
        photoFileInput.value = "";
        showToast("Choose a JPG or PNG image.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        photoFileInput.value = "";
        showToast("This photo is larger than 10 MB. Choose a smaller image.");
        return;
      }
      await displayPhoto(file);
      photoFileInput.value = "";
    });

    document.querySelector("[data-open-camera]")?.addEventListener("click", async () => {
      cameraPanel.classList.remove("hidden");
      cameraVideo.classList.remove("hidden");
      document.querySelector("[data-capture-photo]")?.classList.remove("hidden");
      if (!navigator.mediaDevices?.getUserMedia) {
        const message = "Camera access requires browser permission on HTTPS or localhost. You can upload a photo instead.";
        if (cameraMessage) cameraMessage.textContent = message;
        showToast(message);
        return;
      }
      cameraMessage.textContent = "Waiting for camera permission…";
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
        cameraVideo.srcObject = cameraStream;
        cameraPanel.classList.remove("hidden");
        cameraMessage.textContent = "Camera is on. Keep the soil in focus and tap Take photo.";
        await cameraVideo.play();
      } catch (error) {
        cameraStream?.getTracks().forEach((track) => track.stop());
        cameraStream = null;
        cameraVideo.srcObject = null;
        const message = error.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser settings, or upload a photo."
          : error.name === "NotFoundError"
            ? "No camera was found on this device. Upload a photo instead."
            : error.name === "NotReadableError"
              ? "The camera is busy in another app. Close it or upload a photo instead."
              : "The camera could not be opened. Check browser permission or upload a photo.";
        if (cameraMessage) cameraMessage.textContent = message;
        document.querySelector("[data-capture-photo]")?.classList.add("hidden");
        showToast(message);
      }
    });

    document.querySelector("[data-close-camera]")?.addEventListener("click", stopCamera);
    document.querySelector("[data-capture-photo]")?.addEventListener("click", async () => {
      if (!cameraStream || !cameraVideo.videoWidth) {
        showToast("Wait for the camera preview before taking a photo.");
        return;
      }
      const scale = Math.min(1, 1920 / cameraVideo.videoWidth, 1920 / cameraVideo.videoHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(cameraVideo.videoWidth * scale);
      canvas.height = Math.round(cameraVideo.videoHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) {
        showToast("Your browser could not prepare the camera image. Please upload a photo instead.");
        return;
      }
      context.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
      if (!blob) {
        showToast("The camera photo could not be created. Please try again or upload an image.");
        return;
      }
      stopCamera();
      await displayPhoto(new File([blob], `soil-photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
    });
    window.addEventListener("pagehide", stopCamera, { once: true });

    document.querySelector("[data-review-photo]")?.addEventListener("click", (event) => {
      event.preventDefault();
      if (!currentPhoto || !photoStored) {
        showToast("Choose a photo and allow this browser to save it on this device first.");
        return;
      }
      if (!consentCheckbox?.checked) {
        showToast("Please confirm local photo use before continuing. Nothing is uploaded.");
        consentCheckbox?.focus();
        return;
      }
      window.location.href = event.currentTarget.href;
    });
  }

  const removePhotoButtons = document.querySelectorAll("[data-remove-photo]");
  removePhotoButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await deletePhotoFromDevice();
        if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
        stopCamera();
        if (photoImage) {
          photoImage.removeAttribute("src");
          photoImage.classList.add("hidden");
        }
        photoPlaceholder?.classList.remove("hidden");
        if (photoName) photoName.textContent = "No photo selected";
        if (photoDetails) photoDetails.textContent = "JPG or PNG · Maximum 10 MB · stays on this device";
        if (photoStatus) photoStatus.textContent = "NO PHOTO SELECTED";
        if (consentCheckbox) consentCheckbox.checked = false;
        currentPhoto = null;
        photoStored = false;
        if (reviewPhoto) {
          showToast("Photo removed from this device.");
          window.setTimeout(() => { window.location.href = "soil-photo.html"; }, 900);
        } else {
          showToast("Photo removed from this device.");
        }
      } catch (error) {
        showToast(error.message);
      }
    });
  });

  if (photoImage) {
    loadPhotoFromDevice()
      .then((photo) => {
        if (photo) return displayPhoto(photo, false);
        if (reviewPhoto && photoName) {
          photoName.textContent = "No photo selected";
          photoDetails.textContent = "No saved image was found. Return to capture or upload.";
        }
      })
      .catch((error) => {
        showToast(`${error.message} Photo preview may not be available in this browser.`);
      });
  }

  const coreInputs = [...document.querySelectorAll("[data-core-input]")];
  const contextInputs = [...document.querySelectorAll("[data-context-input]")];
  const allInputs = [...coreInputs, ...contextInputs];
  const defaultValues = {};

  allInputs.forEach((input) => {
    const key = input.dataset.inputKey;
    const initialValue = input instanceof HTMLSelectElement
      ? [...input.options].find((option) => option.defaultSelected)?.value ?? ""
      : input.defaultValue;
    defaultValues[key] = initialValue;
    if (state.cleared) input.value = "";
    else if (Object.hasOwn(state, key)) input.value = state[key];
    else input.value = initialValue;
    if (!Object.hasOwn(state, key) && key === "soilType") state.soilType = input.value;
    input.addEventListener("input", () => {
      state[key] = input.value;
      saveState();
      updateSnapshot();
    });
    input.addEventListener("change", () => {
      state[key] = input.value;
      saveState();
      updateSnapshot();
    });
  });

  const updateSnapshot = () => {
    let completed = 0;
    let entered = 0;
    coreInputs.forEach((input) => {
      const valid = input.value !== "" && input.validity.valid;
      if (valid) completed += 1;
      if (input.value !== "") entered += 1;
      input.setAttribute("aria-invalid", String(!valid));
    });
    document.querySelectorAll("[data-core-count]").forEach((element) => {
      element.textContent = `${completed} / ${coreInputs.length} CORE VALUES ENTERED`;
    });
    document.querySelectorAll("[data-source-status]").forEach((element) => {
      element.textContent = entered === 0
        ? "Not entered"
        : completed < coreInputs.length
          ? "Incomplete / not verified"
          : coreInputs.every((input) => input.value === defaultValues[input.dataset.inputKey])
            ? "Demo / not verified"
            : "Your entries / not verified";
    });
    document.querySelectorAll("[data-input-source]").forEach((element) => {
      element.textContent = entered === 0
        ? "No values entered"
        : coreInputs.every((input) => input.value === defaultValues[input.dataset.inputKey])
          ? "prefilled demonstration dataset"
          : "your values · saved on this device";
    });
    document.querySelectorAll("[data-context-value]").forEach((element) => {
      const input = document.querySelector(`[data-input-key="${element.dataset.contextValue}"]`);
      if (input) element.textContent = input.selectedOptions?.[0]?.textContent || input.value || "Not entered";
    });
  };

  document.querySelectorAll("[data-soil-choice]").forEach((choice) => {
    choice.checked = state.soilType ? choice.value === state.soilType : choice.value === (state.cleared ? "Unknown" : "Loam");
    choice.closest(".choice")?.classList.toggle("selected", choice.checked);
    choice.addEventListener("change", () => {
      if (!choice.checked) return;
      state.soilType = choice.value;
      saveState();
      document.querySelectorAll("[data-soil-choice]").forEach((item) => {
        item.closest(".choice")?.classList.toggle("selected", item.checked);
      });
      showToast(`Soil type saved as ${choice.value}.`);
    });
  });

  const clearButton = document.querySelector("[data-clear-demo]");
  if (clearButton) {
    clearButton.addEventListener("click", () => {
      state = { cleared: true };
      allInputs.forEach((input) => {
        input.value = "";
      });
      document.querySelectorAll("[data-soil-choice]").forEach((choice) => {
        choice.checked = choice.value === "Unknown";
        choice.closest(".choice")?.classList.toggle("selected", choice.checked);
      });
      saveState();
      updateSnapshot();
      showToast("Demo values cleared. Enter your field measurements to continue.");
    });
  }

  document.querySelectorAll("[data-review-inputs]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const firstInvalid = coreInputs.find((input) => !input.value || !input.validity.valid);
      if (firstInvalid) {
        event.preventDefault();
        firstInvalid.focus();
        firstInvalid.reportValidity();
        showToast("Enter all four valid core values before reviewing the demo shortlist.");
        return;
      }
      event.preventDefault();
      window.location.href = `${link.href}?demo-results=1`;
    });
  });

  const recommendationPage = document.querySelector("[data-recommendations-page]");
  if (recommendationPage) {
    const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[character]));
    const inputValue = (key, fallback) => {
      const value = Number(state[key]);
      return Number.isFinite(value) ? value : fallback;
    };
    const conditions = {
      soilPh: inputValue("soilPh", 6.4), temperature: inputValue("temperature", 27),
      humidity: inputValue("humidity", 78), rainfall: inputValue("rainfall", 101),
      soilType: state.soilType || "Loam", season: state.season || "Wet season",
      region: state.region || "Bay, Laguna", planningMonth: state.planningMonth || "November 2026",
      plantCategory: state.plantCategory || "All categories", lifeForm: state.lifeForm || "No preference",
    };
    const cropImage = { pechay: "pechay.jpg", kangkong: "kangkong.jpg", mongo: "mongo.jpg", sitaw: "hero-farm.jpg", talong: "hero-farm.jpg", kamote: "hero-farm.jpg", mais: "hero-farm.jpg" };
    const cropGuides = {
      pechay: { title: "Pechay field guide", body: "A short-cycle leafy option. Check drainage carefully during wet months, and confirm pest pressure before scaling beyond a trial bed." },
      kangkong: { title: "Kangkong field guide", body: "Warm conditions and humidity can suit kangkong, but water quality and the growing system are important checks before planting." },
      mongo: { title: "Mongo field guide", body: "Mongo offers a legume alternative with a medium cycle. Avoid waterlogging near maturity and confirm the planting window locally." },
      sitaw: { title: "Sitaw field guide", body: "A climbing legume that needs a trellis. Confirm support, drainage, and the preferred wet-season planting window." },
      talong: { title: "Talong field guide", body: "A longer-cycle fruiting vegetable. Plan for pest monitoring and reliable drainage before committing a larger area." },
      kamote: { title: "Kamote field guide", body: "A hardy root crop with a longer cycle. Check soil structure and harvest timing with a local agriculture adviser." },
      mais: { title: "Mais field guide", body: "A staple grain planned around the rains. The cleaned Kaggle evidence is useful context, not a Philippine field guarantee." },
    };
    const cropDefinitions = [
      { slug: "pechay", name: "Pechay", category: "Leafy and fruit vegetables", lifeForm: "Herb", days: [30, 45], bands: [[6, 7], [18, 30], [60, 150], [65, 85]], summary: "A short-cycle leafy option for a closer look." },
      { slug: "kangkong", name: "Kangkong", category: "Leafy and fruit vegetables", lifeForm: "Vine", days: [25, 35], bands: [[5.5, 7], [25, 35], [100, 250], [70, 90]], summary: "Familiar greens, with water conditions to check." },
      { slug: "mongo", name: "Mongo", category: "Legumes", lifeForm: "Herb", days: [60, 90], bands: [[6, 7.5], [24, 32], [50, 100], [60, 80]], summary: "A different growing rhythm for your shortlist." },
      { slug: "sitaw", name: "Sitaw", category: "Legumes", lifeForm: "Vine", days: [50, 70], bands: [[5.5, 7], [20, 32], [80, 200], [65, 85]], summary: "A climbing legume that needs a trellis." },
      { slug: "talong", name: "Talong", category: "Leafy and fruit vegetables", lifeForm: "Herb", days: [70, 100], bands: [[5.5, 6.8], [22, 32], [80, 200], [60, 85]], summary: "A fruiting vegetable with a longer cycle." },
      { slug: "kamote", name: "Kamote", category: "Root crops", lifeForm: "Vine", days: [90, 120], bands: [[5.5, 6.5], [21, 30], [80, 200], [60, 80]], summary: "A hardy root crop with a long cycle." },
      { slug: "mais", name: "Mais", category: "Grains", lifeForm: "Herb", days: [80, 110], bands: [[5.8, 7], [21, 30], [80, 200], [55, 80]], summary: "A staple grain planned around the rains." },
    ];
    const evidenceByCrop = {
      mongo: { available: true, source: "Cleaned Kaggle crop-soil and yield-condition profiles", soilProfile: "Moong (Green Gram) · 740 soil observations", yieldProfile: "Moong (Green Gram) · 740 yield observations across 26 states" },
      mais: { available: true, source: "Cleaned Kaggle crop-soil and yield-condition profiles", soilProfile: "Maize · 753 soil observations", yieldProfile: "Maize · 975 yield observations across 28 states" },
    };
    const scoreFactor = (value, band, weight) => {
      const [lo, hi] = band; const width = hi - lo;
      if (lo <= value && value <= hi) {
        const midpoint = (lo + hi) / 2;
        return Math.round(weight * (0.5 + 0.5 * (1 - Math.abs(value - midpoint) / (width / 2))));
      }
      const distance = value < lo ? lo - value : value - hi;
      return Math.max(0, Math.round(weight * 0.5 * (1 - distance / width)));
    };
    const localRecommend = () => {
      const factors = [["soilPh", "Soil pH", 30], ["temperature", "Temperature", 30], ["rainfall", "Rainfall", 25], ["humidity", "Humidity", 15]];
      let pool = cropDefinitions.filter((crop) => (!conditions.plantCategory || conditions.plantCategory === "All categories" || crop.category === conditions.plantCategory) && (!conditions.lifeForm || conditions.lifeForm === "No preference" || crop.lifeForm === conditions.lifeForm));
      return pool.map((crop) => {
        const breakdown = factors.map(([key, label, weight], index) => { const value = conditions[key]; const band = crop.bands[index]; return { factor: key, label, value, band, points: scoreFactor(value, band, weight), maxPoints: weight, status: value < band[0] ? "below" : value > band[1] ? "above" : "within" }; });
        const within = breakdown.filter((item) => item.status === "within").map((item) => item.label.toLowerCase());
        const off = breakdown.filter((item) => item.status !== "within");
        return { ...crop, fit: breakdown.reduce((sum, item) => sum + item.points, 0), breakdown, whyItAppears: within.length ? `${within[0][0].toUpperCase() + within[0].slice(1)} and other core values sit within the example reference bands.` : "The current core values sit outside the strongest example bands.", whatToCheck: off.length ? off.map((item) => `${item.label} (${item.value}) is ${item.status} the ${item.band[0]}–${item.band[1]} reference band.`).join(" ") : "All four core values are within band; drainage, pests, and seed quality are still unassessed.", dataEvidence: evidenceByCrop[crop.slug] || { available: false, source: "No cleaned Kaggle profile found; curated reference bands used." } };
      }).sort((a, b) => b.fit - a.fit).map((result, index) => ({ ...result, label: index === 0 ? "CLOSEST FIT" : "ALTERNATIVE" }));
    };
    let sortMode = "fit";
    let currentResults = [];
    const formatBand = (band) => Array.isArray(band) ? `${band[0]}–${band[1]}` : "not available";
    const evidenceMarkup = (result) => result.dataEvidence?.available ? `<details class="mt-4"><summary class="text-xs font-bold" style="cursor:pointer">View cleaned profile evidence ↗</summary><div class="notice mt-3 text-xs"><p><b>Source</b><br>${escapeHtml(result.dataEvidence.source)}</p><p class="mt-2"><b>Soil profile</b><br>${escapeHtml(result.dataEvidence.soilProfile || "Available")}</p><p class="mt-2"><b>Yield profile</b><br>${escapeHtml(result.dataEvidence.yieldProfile || "Available")}</p></div></details>` : `<details class="mt-4"><summary class="text-xs font-bold" style="cursor:pointer">View fallback explanation ↗</summary><div class="warning mt-3 text-xs">${escapeHtml(result.dataEvidence?.source || "No profile matched this crop.")} The fit remains based on the curated reference bands.</div></details>`;
    const guideMarkup = (result) => `<button class="button mt-4" type="button" data-crop-guide="${escapeHtml(result.slug)}">Open crop guide ↗</button>`;
    const renderGuideDialog = (slug) => { const guide = cropGuides[slug] || cropGuides.pechay; const existing = document.querySelector("[data-guide-dialog]"); existing?.remove(); const dialog = document.createElement("div"); dialog.setAttribute("data-guide-dialog", "true"); dialog.innerHTML = `<div style="position:fixed;inset:0;background:rgb(23 75 58 / 30%);z-index:100;display:grid;place-items:center;padding:20px"><section class="card" style="max-width:520px;padding:28px;box-shadow:0 18px 50px rgb(23 75 58 / 20%)" role="dialog" aria-modal="true"><p class="eyebrow">FIELD GUIDE / ${escapeHtml(slug)}</p><h2 class="serif mt-3 text-3xl">${escapeHtml(guide.title)}</h2><p class="muted mt-4 text-sm">${escapeHtml(guide.body)}</p><div class="notice mt-5 text-xs">Use the guide to frame the next field check. It does not replace local advice, soil testing, or a validated yield forecast.</div><button class="button button-primary mt-6" type="button" data-close-guide>Close guide</button></section></div>`; document.body.append(dialog); dialog.querySelector("[data-close-guide]").addEventListener("click", () => dialog.remove()); dialog.firstElementChild.addEventListener("click", (event) => { if (event.target === dialog.firstElementChild) dialog.remove(); }); };
    const renderRecommendations = (payload, mode = "API CONNECTED") => {
      currentResults = Array.isArray(payload.results) ? [...payload.results] : [];
      if (sortMode === "name") currentResults.sort((a, b) => a.name.localeCompare(b.name)); else currentResults.sort((a, b) => b.fit - a.fit);
      if (!currentResults.length) { recommendationPage.innerHTML = '<section class="warning mt-8"><strong>No crops matched the selected filters.</strong><p class="muted mt-2 text-xs">Return to your conditions and broaden the category or life-form filters.</p></section>'; return; }
      const first = currentResults[0];
      const evidenceCount = currentResults.filter((result) => result.dataEvidence?.available).length;
      const cards = currentResults.slice(0, 3).map((result, index) => `<article class="card overflow-hidden"><img class="h-52 w-full object-cover" src="images/${escapeHtml(cropImage[result.slug] || "hero-farm.jpg")}" alt="${escapeHtml(result.name)}"><div class="p-6"><div class="flex items-center justify-between"><span class="badge" ${index ? 'style="background:#edf0e9"' : ""}>${index ? "ALTERNATIVE" : "CLOSEST FIT"}</span><small class="muted">${result.growingDays ? result.growingDays[0] : result.days[0]}–${result.growingDays ? result.growingDays[1] : result.days[1]} days</small></div><div class="mt-3 flex items-center justify-between"><h2 class="serif text-3xl">${escapeHtml(result.name)}</h2><span class="serif text-3xl">${result.fit}</span></div><p class="muted text-xs">Fit / 100 · not a probability of success</p><div class="score-line my-4"><span style="width:${result.fit}%"></span></div><p class="eyebrow">WHY IT APPEARS</p><p class="mt-2 text-xs">${escapeHtml(result.whyItAppears)}</p><p class="eyebrow mt-4">WHAT TO CHECK</p><p class="mt-2 text-xs">${escapeHtml(result.whatToCheck)}</p><span class="badge mt-4">${result.dataEvidence?.available ? "CLEANED KAGGLE PROFILE" : "CURATED REFERENCE FALLBACK"}</span>${evidenceMarkup(result)}${guideMarkup(result)}</div></article>`).join("");
      const breakdown = (first.breakdown || []).map((item) => `<div class="mini-row"><b>${escapeHtml(item.label)}<br><small class="muted font-normal">${item.value}</small></b><span>${formatBand(item.band)}<br><small class="muted">Reference band</small></span><span class="badge">${item.points} / ${item.maxPoints}</span></div>`).join("");
      const saved = localStorage.getItem("tanimtech-saved-shortlist") === "true";
      recommendationPage.innerHTML = `<p class="eyebrow">CROP PLANNING / ${mode === "API CONNECTED" ? "API SHORTLIST" : "BROWSER DEMO ENGINE"}</p><div class="flex flex-wrap items-end justify-between gap-5"><div><h1 class="section-heading mt-3">Crops worth a closer look.</h1><p class="muted mt-3">${mode === "API CONNECTED" ? "Live fit scores from the recommendation API." : "Interactive fit scores calculated in your browser while the API is unavailable."}</p></div><a class="button button-primary" href="conditions.html">Edit conditions ↗</a></div><div class="notice mt-6 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5"><span>pH ${conditions.soilPh}</span><span>${conditions.temperature} °C mean</span><span>${conditions.humidity}% RH</span><span>${conditions.rainfall} mm / month</span><span>${escapeHtml(conditions.planningMonth)} <span class="badge ml-2">${mode === "API CONNECTED" ? "API RESULTS" : "LOCAL RESULTS"}</span></span></div><div class="mt-6 flex flex-wrap items-center justify-between gap-4"><p class="muted text-xs">${currentResults.length} matches · ${evidenceCount} backed by cleaned Kaggle profiles · ${escapeHtml(conditions.region)}</p><div class="flex flex-wrap gap-3"><button class="field-control min-h-10 text-xs" type="button" data-sort-results>Sort: ${sortMode === "fit" ? "highest fit" : "crop name"} ↕</button><button class="button button-primary" type="button" data-scroll-compare>Compare top 3 ↗</button></div></div><div class="mt-6 grid gap-5 lg:grid-cols-3">${cards}</div><p class="muted mt-4 text-xs">${escapeHtml(payload.note || "Illustrative scoring only.")} Cleaned Kaggle profiles are evidence context; they do not turn fit into a forecast.</p><div id="compare" class="mt-10 grid items-start gap-6 lg:grid-cols-[2fr_1fr]"><section class="card p-7"><p class="eyebrow">EXPLAIN THE FIT / ${first.fit} OF 100</p><h2 class="serif mt-3">Why ${escapeHtml(first.name)} ranks first</h2><p class="muted mt-3">The recommendation engine keeps the four weighted core factors visible. Add-on context provides guidance and never adds score points.</p><div class="mt-5">${breakdown}</div><p class="muted mt-4 text-xs">${escapeHtml(first.dataEvidence?.source || "Curated reference bands")}</p></section><aside class="card p-7"><p class="eyebrow">FIT ≠ CERTAINTY</p><h2 class="serif mt-3 text-3xl">What the score can’t tell you</h2><div class="mt-4"><div class="mini-row"><span class="muted">Input completeness</span><b>4 / 4 core values<br><small class="muted font-normal">Entered, not independently verified</small></b></div><div class="mini-row"><span class="muted">Field blind spots</span><b>Drainage · pests · seed quality<br><small class="muted font-normal">Not included in the score</small></b></div></div><div class="warning mt-5"><strong class="text-xs">⚠ Seasonal risk stays visible</strong><p class="muted mt-2 text-xs">A high fit score must not override current local advisories.</p></div></aside></div><section class="mt-8 flex flex-wrap items-center justify-between gap-6 rounded bg-forest px-8 py-7 text-white"><div><h2 class="serif text-2xl">Take the shortlist back to the field.</h2><p class="mt-2 text-sm text-white/75">Save this shortlist on your device, then verify drainage and local conditions before planting at scale.</p></div><button class="button" type="button" data-save-shortlist>${saved ? "Saved on this device ✓" : "Save this shortlist ↗"}</button></section>`;
      recommendationPage.querySelector("[data-sort-results]").addEventListener("click", () => { sortMode = sortMode === "fit" ? "name" : "fit"; renderRecommendations(payload, mode); });
      recommendationPage.querySelector("[data-scroll-compare]").addEventListener("click", () => document.querySelector("#compare")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      recommendationPage.querySelector("[data-save-shortlist]").addEventListener("click", (event) => { localStorage.setItem("tanimtech-saved-shortlist", "true"); event.currentTarget.textContent = "Saved on this device ✓"; showToast("Shortlist saved in this browser."); });
      recommendationPage.querySelectorAll("[data-crop-guide]").forEach((button) => button.addEventListener("click", () => renderGuideDialog(button.dataset.cropGuide)));
    };
    fetch("/api/recommendations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(conditions) })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Recommendation API unavailable")))
      .then((payload) => renderRecommendations(payload, "API CONNECTED"))
      .catch(() => { renderRecommendations({ results: localRecommend(), note: "The Flask API is not available on this static deployment, so the same transparent four-factor engine is running locally." }, "BROWSER DEMO"); });
  }
  if (new URLSearchParams(window.location.search).has("demo-results")) {
    showToast("Recommendations loaded from your saved field values.");
  }

  updateSnapshot();
})();

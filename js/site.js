(() => {
  const languageKey = "tanimtech-language";
  const translations = {
    "Overview": "Pangkalahatang-ideya",
    "Explore": "Tuklasin",
    "Plan": "Magplano",
    "More": "Higit pa",
    "Crop guide": "Gabay sa pananim",
    "Featured crops": "Mga tampok na pananim",
    "Get recommendations": "Kumuha ng rekomendasyon",
    "Compare crops": "Ihambing ang mga pananim",
    "Climate inputs": "Datos ng klima",
    "My profile": "Aking profile",
    "Account details": "Mga detalye ng account",
    "Saved profiles & recommendations": "Mga naka-save na profile at rekomendasyon",
    "Sign out": "Mag-sign out",
    "Check your email to verify your account.": "Tingnan ang iyong email upang beripikahin ang account.",
    "Your signup request was received. If a new account was created, Supabase sent a verification email. Check your inbox and spam folder before trying to sign up again.": "Natanggap ang iyong kahilingan sa pagpaparehistro. Kung may bagong account na ginawa, nagpadala ang Supabase ng email ng beripikasyon. Tingnan ang inbox at spam bago muling magparehistro.",
    "If no email arrives, use Resend confirmation email from the sign-in page instead of submitting this form again.": "Kung walang dumating na email, gamitin ang Resend confirmation email sa pahina ng pag-sign in sa halip na isumite muli ang form na ito.",
    "Go to sign in": "Pumunta sa pag-sign in",
    "Use another email address": "Gumamit ng ibang email address",
    "How it works": "Paano ito gumagana",
    "Methodology": "Pamamaraan",
    "Soil photo": "Larawan ng lupa",
    "Photo review": "Pagsusuri ng larawan",
    "Soil context": "Konteksto ng lupa",
    "Choose analysis": "Pumili ng pagsusuri",
    "Choose an analysis method": "Pumili ng paraan ng pagsusuri",
    "Browse crop profiles": "Tingnan ang mga profile ng pananim",
    "Start with your field. Find possible crops.": "Magsimula sa iyong bukid. Humanap ng posibleng pananim.",
    "Choose your analysis method.": "Pumili ng paraan ng pagsusuri.",
    "Use a soil photo": "Gumamit ng larawan ng lupa",
    "Enter field measurements": "Ilagay ang sukat ng bukid",
    "Open camera option": "Buksan ang camera",
    "Enter field conditions": "Ilagay ang kondisyon ng bukid",
    "Explore the available crop guides.": "Tingnan ang mga gabay sa pananim.",
    "View crop guides": "Tingnan ang mga gabay",
    "Choose a method": "Pumili ng paraan",
    "Review possible matches": "Suriin ang mga posibleng tugma",
    "Check locally": "Suriin sa iyong lugar",
    "Possible fit is not a promise.": "Ang posibleng tugma ay hindi garantiya.",
    "Use measurements from your field.": "Gamitin ang mga sukat mula sa iyong bukid.",
    "Required inputs": "Mga kailangang ilagay",
    "Soil pH": "pH ng lupa",
    "Mean temperature": "Karaniwang temperatura",
    "Relative humidity": "Relatibong halumigmig",
    "Annual rainfall": "Taunang ulan",
    "Clear entries": "Burahin ang mga inilagay",
    "Load real climate normals": "I-load ang tunay na datos ng klima",
    "Add what you know": "Idagdag ang iyong nalalaman",
    "Soil type": "Uri ng lupa",
    "Season": "Panahon ng pagtatanim",
    "Planning month": "Buwan ng pagpaplano",
    "Soil texture": "Tekstura ng lupa",
    "Drainage": "Daloy ng tubig",
    "Moisture at sampling": "Halumigmig sa pagkuha ng sample",
    "Organic matter": "Organikong materyal",
    "Soil notes": "Mga tala tungkol sa lupa",
    "Save field profile": "I-save ang profile ng bukid",
    "Review crop recommendations": "Suriin ang rekomendasyon sa pananim",
    "A closer look at your soil.": "Masusing tingnan ang iyong lupa.",
    "Start with one clear soil close-up": "Magsimula sa malinaw na malapitan na larawan ng lupa",
    "Take a photo": "Kumuha ng larawan",
    "Upload a photo": "Mag-upload ng larawan",
    "Open camera": "Buksan ang camera",
    "Choose file": "Pumili ng file",
    "Remove": "Alisin",
    "Analyze soil with model": "Suriin ang lupa gamit ang modelo",
    "Know your soil? Choose it manually.": "Alam mo ang uri ng lupa? Piliin ito nang mano-mano.",
    "Unknown": "Hindi alam",
    "Clay": "Luwad",
    "Loam": "Loam",
    "Sandy": "Mabuhangin",
    "Silty": "Maalikabok",
    "Peaty": "Mala-peat / organiko",
    "Enter your field conditions first.": "Ilagay muna ang kondisyon ng iyong bukid.",
    "Language": "Wika",
    "English": "English",
    "Tagalog": "Tagalog",
  };
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  const translatePage = (language) => {
    const useTagalog = language === "tl";
    document.documentElement.lang = useTagalog ? "tl" : "en";
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest("script,style,select")) continue;
      if (!originalText.has(node)) originalText.set(node, node.nodeValue);
      const source = originalText.get(node);
      const key = source.trim();
      if (!key) continue;
      const value = useTagalog ? translations[key] : key;
      if (value && value !== key) node.nodeValue = source.replace(key, value);
      else if (!useTagalog) node.nodeValue = source;
    }
    document.querySelectorAll("[placeholder],[aria-label],[title]").forEach((element) => {
      if (!originalAttributes.has(element)) originalAttributes.set(element, {
        placeholder: element.getAttribute("placeholder"),
        "aria-label": element.getAttribute("aria-label"),
        title: element.getAttribute("title"),
      });
      const source = originalAttributes.get(element);
      ["placeholder", "aria-label", "title"].forEach((attribute) => {
        const text = source[attribute];
        if (!text) return;
        element.setAttribute(attribute, useTagalog ? (translations[text] || text) : text);
      });
    });
  };
  const addLanguageSelector = () => {
    const actions = document.querySelector(".header-actions") || document.querySelector(".login-page section") || document.querySelector("[data-signup-page] section");
    if (!actions || actions.querySelector("[data-language-select]")) return;
    const label = document.createElement("label");
    label.className = "language-switcher";
    label.innerHTML = `<span class="sr-only">Language</span><select data-language-select aria-label="Language"><option value="en">English</option><option value="tl">Tagalog</option></select>`;
    actions.prepend(label);
    if (!actions.classList.contains("header-actions")) label.classList.add("login-language-switcher");
    const select = label.querySelector("select");
    const saved = localStorage.getItem(languageKey) || "en";
    select.value = saved;
    select.addEventListener("change", () => {
      localStorage.setItem(languageKey, select.value);
      translatePage(select.value);
    });
    translatePage(saved);
  };
  addLanguageSelector();
  document.querySelectorAll("a[data-user-avatar]").forEach((avatar, index) => {
    const menu = document.createElement("div");
    menu.className = "profile-actions-menu";
    menu.dataset.profileActions = "";

    const trigger = document.createElement("button");
    trigger.className = `${avatar.className} profile-menu-trigger`;
    trigger.type = "button";
    trigger.dataset.userAvatar = "";
    trigger.dataset.profileMenuTrigger = "";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-controls", `profile-actions-panel-${index + 1}`);
    trigger.setAttribute("aria-label", "Open profile actions");
    const initials = document.createElement("span");
    initials.dataset.avatarInitials = "";
    initials.textContent = avatar.textContent.trim();
    trigger.append(initials);

    const panel = document.createElement("nav");
    panel.className = "profile-actions-panel";
    panel.id = `profile-actions-panel-${index + 1}`;
    panel.setAttribute("aria-label", "Profile actions");
    panel.hidden = true;
    [
      ["My profile", "profile.html"],
      ["Account details", "profile.html#account-details"],
      ["Saved profiles & recommendations", "profile.html#profile-state"],
    ].forEach(([label, href]) => {
      const link = document.createElement("a");
      link.href = href;
      link.dataset.profileMenuClose = "";
      link.textContent = label;
      panel.append(link);
    });
    const signOutButton = document.createElement("button");
    signOutButton.type = "button";
    signOutButton.dataset.profileMenuSignout = "";
    signOutButton.textContent = "Sign out";
    panel.append(signOutButton);

    menu.append(trigger, panel);
    avatar.replaceWith(menu);
  });
  translatePage(localStorage.getItem(languageKey) || "en");
  const passwordEyeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  const passwordEyeOffIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path><path d="M9.9 5.2A11 11 0 0 1 12 5c6.4 0 10 7 10 7a15 15 0 0 1-3.1 3.8M6.2 6.2C3.6 8 2 12 2 12s3.6 7 10 7a10 10 0 0 0 4-.8"></path></svg>';
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    const input = button.closest(".field-control")?.querySelector("input");
    if (!input) return;
    button.innerHTML = passwordEyeIcon;
    button.addEventListener("click", () => {
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      const label = visible ? "Hide password" : "Show password";
      button.setAttribute("aria-label", label);
      button.title = label;
      button.setAttribute("aria-pressed", String(visible));
      button.innerHTML = visible ? passwordEyeOffIcon : passwordEyeIcon;
    });
  });
  const configuredApiBase = document.querySelector('meta[name="tanimtech-api-base"]')?.content || window.TANIMTECH_API_BASE || "";
  const apiUrl = (path) => `${String(configuredApiBase).replace(/\/$/, "")}${path}`;
  const storageKey = "tanimtech-field-inputs";
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

  const currentUserKey = "tanimtech-current-user";
  const readCurrentUser = () => {
    const stored = localStorage.getItem(currentUserKey);
    if (!stored) return {};
    try {
      const user = JSON.parse(stored);
      if (!user || typeof user !== "object" || Array.isArray(user)) return {};
      return {
        email: typeof user.email === "string" ? user.email : "",
        username: typeof user.username === "string" ? user.username : "",
      };
    } catch (error) {
      showToast("Saved account details could not be loaded.");
      return {};
    }
  };
  const updateUserAvatars = (identity = readCurrentUser()) => {
    const display = identity.username || (identity.email || "").split("@")[0] || "";
    const initials = display.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || display.slice(0, 2).toUpperCase();
    document.querySelectorAll("[data-user-avatar]").forEach((avatar) => {
      if (initials) {
        const initialsNode = avatar.querySelector("[data-avatar-initials]");
        if (initialsNode) initialsNode.textContent = initials;
        else if (!avatar.matches("[data-profile-menu-trigger]")) avatar.textContent = initials;
        avatar.title = display;
        avatar.setAttribute("aria-label", avatar.matches("[data-profile-menu-trigger]") ? `Open profile actions for ${display}` : `Open profile for ${display}`);
      }
    });
  };
  const saveCurrentUser = (user) => {
    const identity = {
      email: typeof user.email === "string" ? user.email : "",
      username: typeof user.username === "string"
        ? user.username
        : typeof user.user_metadata?.username === "string" ? user.user_metadata.username : "",
    };
    localStorage.setItem(currentUserKey, JSON.stringify(identity));
    updateUserAvatars(identity);
    return identity;
  };
  updateUserAvatars();
  const passwordChecks = {
    length: (password) => password.length >= 8,
    uppercase: (password) => /[A-Z]/.test(password),
    lowercase: (password) => /[a-z]/.test(password),
    number: (password) => /\d/.test(password),
    symbol: (password) => /[^A-Za-z0-9\s]/.test(password),
  };

  const readJsonResponse = async (response, fallback = "This page is running without the TanimTech API. Your local profile is still available.") => {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error(fallback);
    }
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
  const analyzeSoilButton = document.querySelector("[data-analyze-soil]");
  const soilAnalysisResult = document.querySelector("[data-soil-analysis-result]");
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
    if (analyzeSoilButton) analyzeSoilButton.disabled = !photoStored || !consentCheckbox?.checked;
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
        if (analyzeSoilButton) analyzeSoilButton.disabled = !consentCheckbox?.checked;
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

  consentCheckbox?.addEventListener("change", () => {
    if (analyzeSoilButton) analyzeSoilButton.disabled = !currentPhoto || !photoStored || !consentCheckbox.checked;
  });

  const renderPhotoCropCards = async (recommendations, runId = null) => {
    if (!Array.isArray(recommendations) || !recommendations.length) {
      return '<div class="notice mt-4 text-xs">No crop matches are available for this soil reference.</div>';
    }
    const [catalogResponse, creditsResponse] = await Promise.all([
      fetch("js/philippine-edible-catalog.json"),
      fetch("js/crop-image-credits.json?v=4"),
    ]);
    if (!catalogResponse.ok) throw new Error(`Crop details returned HTTP ${catalogResponse.status}.`);
    if (!creditsResponse.ok) throw new Error(`Crop image credits returned HTTP ${creditsResponse.status}.`);
    const [catalog, imageCredits] = await Promise.all([catalogResponse.json(), creditsResponse.json()]);
    if (!Array.isArray(catalog.crops)) throw new Error("Crop details are unavailable.");
    const cropsBySlug = new Map(catalog.crops.map((crop) => [crop.slug, crop]));
    const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[character]));
    const cards = recommendations.map((recommendation) => {
      const crop = cropsBySlug.get(recommendation.slug);
      const image = imageCredits[recommendation.slug];
      if (!crop || !image?.src) throw new Error(`Details or image for ${recommendation.name || recommendation.slug} are unavailable.`);
      const status = recommendation.status === "good" ? "Good soil fit"
        : recommendation.status === "caution" ? "Use caution"
          : "Possible soil fit";
      const days = Array.isArray(crop.growingDays) ? `${crop.growingDays[0]}–${crop.growingDays[1]} days` : "Growing period varies";
      return `<article class="card overflow-hidden"><img class="h-44 w-full bg-paper object-contain" src="${escape(image.src)}" alt="${escape(crop.name)}"><div class="p-5"><div class="flex items-center justify-between gap-3"><span class="badge">${escape(status)}</span><small class="muted">${escape(days)}</small></div><h3 class="serif mt-3 text-2xl">${escape(crop.name)}</h3><p class="muted mt-1 text-xs"><i>${escape(crop.scientific)}</i> · ${escape(crop.category)} · ${escape(crop.lifeForm)}</p><p class="mt-3 text-xs leading-5">${escape(crop.summary)}</p><a class="button mt-4" href="crop-guide.html?crop=${encodeURIComponent(crop.slug)}">Open crop guide ↗</a><button class="button mt-3 w-full" type="button" data-track-crop="${escape(crop.slug)}" data-crop-name="${escape(crop.name)}" data-crop-source="image" data-run-id="${escape(runId || "")}">Track as in progress</button></div></article>`;
    }).join("");
    return `<div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">${cards}</div>`;
  };

  const localSoilReview = async (blob) => {
    const image = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, 64, 64);
    image.close();
    const pixels = context.getImageData(0, 0, 64, 64).data;
    let red = 0, green = 0, blue = 0, brightness = 0, earthTonePixels = 0, textureEdges = 0, comparableEdges = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const pixelRed = pixels[i], pixelGreen = pixels[i + 1], pixelBlue = pixels[i + 2];
      const luminance = (pixelRed + pixelGreen + pixelBlue) / 3;
      red += pixelRed; green += pixelGreen; blue += pixelBlue; brightness += luminance;
      if (pixelRed > pixelGreen * 1.04 && pixelGreen > pixelBlue * 1.04 && pixelRed > 20 && pixelRed < 230) earthTonePixels += 1;
      const x = (i / 4) % 64, y = Math.floor(i / 4 / 64);
      if (x > 0) {
        const left = i - 4;
        comparableEdges += 1;
        if (Math.abs(luminance - (pixels[left] + pixels[left + 1] + pixels[left + 2]) / 3) > 18) textureEdges += 1;
      }
      if (y > 0) {
        const above = i - 256;
        comparableEdges += 1;
        if (Math.abs(luminance - (pixels[above] + pixels[above + 1] + pixels[above + 2]) / 3) > 18) textureEdges += 1;
      }
    }
    const count = pixels.length / 4;
    red /= count; green /= count; blue /= count; brightness /= count;
    const earthToneRatio = earthTonePixels / count;
    const textureRatio = textureEdges / Math.max(comparableEdges, 1);
    const looksLikeSoil = earthToneRatio >= 0.16 && textureRatio >= 0.14;
    if (!looksLikeSoil) {
      return {
        suggestedSoilType: "Unknown", confidence: "insufficient", inconclusive: true, observations: [
          "The image does not show enough textured, earth-toned surface to verify a soil close-up.",
          "No soil type is assigned from an unverified image, so this photo is not used to suggest crops.",
        ],
        recommendedCrops: [],
        recommendedChecks: ["Retake the photo with soil filling most of the frame.", "Confirm texture by hand or with a soil test.", "Use measured soil and climate inputs for crop recommendations."],
        localFallback: true,
      };
    }
    const suggestedSoilType = brightness < 75 && red > blue * 1.18 ? "Loam" : red > blue * 1.25 && brightness > 105 ? "Sandy" : blue > red * 1.08 ? "Silty" : "Clay";
    const cropGroups = {
      Sandy: ["kamote", "mani", "pinya", "papaya", "sitaw"],
      Clay: ["palay", "gabi", "kangkong", "kalabasa", "mais"],
      Silty: ["pechay", "repolyo", "sibuyas", "labanos", "kamatis"],
      Loam: ["pechay", "talong", "kamatis", "okra", "mongo"],
    };
    const dataset = await fetch("js/philippine-edible-catalog.json").then((response) => response.json());
    const bySlug = new Map((dataset.crops || []).map((crop) => [crop.slug, crop]));
    return {
      suggestedSoilType, confidence: "low", observations: [
        `The photo has a ${suggestedSoilType.toLowerCase()}-leaning color and texture profile.`,
        "Image-only review cannot confirm texture, pH, nutrients, drainage, or organic matter.",
      ],
      recommendedCrops: (cropGroups[suggestedSoilType] || []).map((slug) => bySlug.get(slug)).filter(Boolean).map((crop) => ({ slug: crop.slug, name: crop.name, category: crop.category, status: "possible" })),
      recommendedChecks: ["Confirm texture by hand or with a soil test.", "Check drainage and organic matter before planting.", "Treat this as a screening suggestion, not a laboratory result."],
      localFallback: true,
    };
  };

  analyzeSoilButton?.addEventListener("click", async () => {
    if (!consentCheckbox?.checked || !currentPhoto?.blob) {
      showToast("Choose a photo and confirm model review first.");
      return;
    }
    analyzeSoilButton.disabled = true;
    analyzeSoilButton.textContent = "Analyzing…";
    if (soilAnalysisResult) {
      soilAnalysisResult.classList.remove("hidden");
      soilAnalysisResult.textContent = "Reviewing visible traits. This may take a moment…";
    }
    const htmlEscape = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
    try {
      const form = new FormData();
      form.append("image", currentPhoto.blob, currentPhoto.name || "soil-photo.jpg");
      form.append("consent", consentCheckbox.checked ? "true" : "false");
      const soilDetails = Object.fromEntries(["soilTexture", "drainage", "moisture", "salinity", "organicMatter", "soilNotes"].map((key) => [key, state[key] || ""]));
      form.append("details", JSON.stringify(soilDetails));
      const response = await fetch(apiUrl("/api/soil/analyze"), { method: "POST", body: form });
      const payload = await readJsonResponse(response, "Soil model review is unavailable because this deployment is not connected to the TanimTech backend. Continue with the manual soil fields or configure TANIMTECH_API_BASE.");
      if (!response.ok) throw new Error(payload.error || "Soil analysis is unavailable.");
      const analysis = payload.analysis;
      state.soilAnalysis = analysis;
      if (analysis.suggestedSoilType && analysis.suggestedSoilType !== "Unknown") {
        state.soilType = analysis.suggestedSoilType;
        state.soilTexture = analysis.suggestedSoilType;
        state.soilTypeSource = "model-suggested";
      }
      saveState();
      const soilDetailsForResult = Object.fromEntries(["soilTexture", "drainage", "moisture", "salinity", "organicMatter", "soilNotes"].map((key) => [key, state[key] || ""]));
      const runId = await persistRecommendationRun({
        inputMode: "image",
        inputData: {
          suggestedSoilType: analysis.suggestedSoilType || null,
          confidence: analysis.confidence || null,
          observations: analysis.observations || [],
          limitations: analysis.limitations || [],
          recommendedChecks: analysis.recommendedChecks || [],
          soilDetails: soilDetailsForResult,
        },
        results: analysis.recommendedCrops || [],
        modelName: "soil-photo-review",
        modelVersion: analysis.modelVersion || null,
      });
      if (soilAnalysisResult) {
        const observations = (analysis.observations || []).map((item) => `<li>${htmlEscape(item)}</li>`).join("");
        const limitations = (analysis.limitations || []).map((item) => `<li>${htmlEscape(item)}</li>`).join("");
        const checks = (analysis.recommendedChecks || []).map((item) => `<li>${htmlEscape(item)}</li>`).join("");
        const cropCards = await renderPhotoCropCards(analysis.recommendedCrops, runId);
        soilAnalysisResult.innerHTML = `<section class="card p-6"><div class="flex flex-wrap items-start justify-between gap-4"><div><p class="eyebrow">PHOTO-BASED SOIL SCREENING</p><h2 class="serif mt-2 text-2xl">Possible crops to explore</h2><p class="muted mt-2 text-xs">Suggested soil type: ${htmlEscape(analysis.suggestedSoilType)} · ${htmlEscape(analysis.confidence)} confidence</p></div><span class="badge">ADVISORY MATCHES</span></div><p class="muted mt-4 text-xs">Crop cards show qualitative soil-reference fit, not probability of success. A photo cannot assess climate or confirm soil pH.</p>${observations ? `<p class="eyebrow mt-5">VISIBLE OBSERVATIONS</p><ul class="mt-2 list-disc pl-5 text-xs">${observations}</ul>` : ""}${cropCards}<p class="eyebrow mt-5">LIMITATIONS</p><ul class="mt-2 list-disc pl-5 text-xs">${limitations || "<li>Photo review is not a soil test.</li>"}</ul><p class="eyebrow mt-5">RECOMMENDED CHECKS</p><ul class="mt-2 list-disc pl-5 text-xs">${checks || "<li>Confirm soil and climate conditions before planting.</li>"}</ul><p class="muted mt-4 text-xs">Confirm or override the soil suggestion in field conditions. Crop suitability depends on measured pH, climate, drainage, and local guidance.</p>${renderFeedbackForm("soil_image", runId)}</section>`;
        soilAnalysisResult.querySelector("[data-result-feedback]")?.addEventListener("submit", submitFeedbackForm);
      }
      showToast("Soil review complete. Confirm the suggestion before using it.");
    } catch (error) {
      try {
        const fallback = await localSoilReview(currentPhoto.blob);
        state.soilAnalysis = fallback;
        state.soilType = fallback.suggestedSoilType;
        state.soilTexture = fallback.suggestedSoilType;
        state.soilTypeSource = "local-photo-screening";
        saveState();
        const soilDetailsForResult = Object.fromEntries(["soilTexture", "drainage", "moisture", "salinity", "organicMatter", "soilNotes"].map((key) => [key, state[key] || ""]));
        const runId = await persistRecommendationRun({
          inputMode: "image",
          inputData: {
            suggestedSoilType: fallback.suggestedSoilType,
            confidence: fallback.confidence,
            observations: fallback.observations,
            recommendedChecks: fallback.recommendedChecks,
            soilDetails: soilDetailsForResult,
          },
          results: fallback.recommendedCrops || [],
          modelName: "local-photo-screening",
          modelVersion: null,
        });
        const observations = fallback.observations.map((item) => `<li>${htmlEscape(item)}</li>`).join("");
        const cropCards = fallback.inconclusive
          ? '<div class="warning mt-5 text-xs"><strong>No crop recommendations were generated.</strong><p class="muted mt-2">Use a clear soil close-up or continue with manual soil and climate inputs.</p></div>'
          : await renderPhotoCropCards(fallback.recommendedCrops, runId);
        const checks = fallback.recommendedChecks.map((item) => `<li>${htmlEscape(item)}</li>`).join("");
        if (soilAnalysisResult) soilAnalysisResult.innerHTML = `<section class="card p-6"><div class="flex flex-wrap items-start justify-between gap-4"><div><p class="eyebrow">LOCAL PHOTO SCREENING</p><h2 class="serif mt-2 text-2xl">${fallback.inconclusive ? "Unable to determine from this photo" : "Possible crops to explore"}</h2><p class="muted mt-2 text-xs">${fallback.inconclusive ? "No soil type assigned · insufficient evidence" : `Tentative soil type: ${htmlEscape(fallback.suggestedSoilType)} · low confidence`}</p></div><span class="badge">${fallback.inconclusive ? "INCONCLUSIVE PHOTO" : "ADVISORY MATCHES"}</span></div><p class="muted mt-4 text-xs">${fallback.inconclusive ? "The browser-only fallback will not guess from image color or treat an unverified object as soil." : "These cards show qualitative soil-reference fit, not probability of success. This browser-only color screen cannot assess climate or soil pH."}</p><p class="eyebrow mt-5">VISIBLE IMAGE SCREENING</p><ul class="mt-2 list-disc pl-5 text-xs">${observations}</ul>${cropCards}<p class="eyebrow mt-5">RECOMMENDED CHECKS</p><ul class="mt-2 list-disc pl-5 text-xs">${checks}</ul><p class="muted mt-4 text-xs">Confirm soil and climate conditions before planting.</p>${renderFeedbackForm("soil_image", runId)}</section>`;
        soilAnalysisResult?.querySelector("[data-result-feedback]")?.addEventListener("submit", submitFeedbackForm);
        showToast("Tentative local photo screening complete. Confirm the soil before planting.");
      } catch (fallbackError) {
        if (soilAnalysisResult) soilAnalysisResult.textContent = `Photo screening could not run: ${fallbackError.message}`;
        showToast("Photo screening could not run. Continue with the manual soil fields.");
      }
    } finally {
      analyzeSoilButton.disabled = !currentPhoto || !photoStored || !consentCheckbox.checked;
      analyzeSoilButton.textContent = "Analyze soil with model";
    }
  });

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
      if (["temperature", "humidity", "rainfall"].includes(key)) state.climateSource = "";
      saveState();
      updateSnapshot();
    });
    input.addEventListener("change", () => {
      state[key] = input.value;
      if (["temperature", "humidity", "rainfall"].includes(key)) state.climateSource = "";
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
        ? "Waiting for measurements"
        : completed < coreInputs.length
          ? "Incomplete"
          : state.climateSource || "User-entered · verify source";
    });
    document.querySelectorAll("[data-input-source]").forEach((element) => {
      element.textContent = entered === 0
        ? "Waiting for measurements"
        : state.climateSource || "User-entered values · verify source";
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

  const clearButton = document.querySelector("[data-clear-inputs]");
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
      showToast("Entries cleared. Add measured field values to continue.");
    });
  }

  const climateButton = document.querySelector("[data-load-climate]");
  if (climateButton) {
    const climateStatus = document.querySelector("[data-climate-status]");
    const monthInput = document.querySelector('[data-input-key="planningMonth"]');
    const latitudeInput = document.querySelector('[data-input-key="latitude"]');
    const longitudeInput = document.querySelector('[data-input-key="longitude"]');
    const setCoreValue = (key, value) => {
      const input = document.querySelector(`[data-input-key="${key}"]`);
      if (!input) return;
      input.value = String(value);
      state[key] = String(value);
    };
    climateButton.addEventListener("click", async () => {
      const latitude = Number(latitudeInput?.value);
      const longitude = Number(longitudeInput?.value);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        showToast("Enter a valid latitude and longitude first.");
        latitudeInput?.focus();
        return;
      }
      climateButton.disabled = true;
      climateStatus.textContent = "Loading NASA POWER climatology…";
      try {
        const url = new URL("https://power.larc.nasa.gov/api/temporal/climatology/point");
        url.search = new URLSearchParams({ parameters: "T2M,RH2M,PRECTOTCORR", community: "AG", latitude, longitude, format: "JSON" });
        const response = await fetch(url);
        if (!response.ok) throw new Error("NASA POWER did not return climate data.");
        const payload = await response.json();
        const parameters = payload.properties?.parameter || {};
        const month = (monthInput?.value || "ANN").slice(0, 3).toUpperCase();
        const days = { JAN:31, FEB:28.25, MAR:31, APR:30, MAY:31, JUN:30, JUL:31, AUG:31, SEP:30, OCT:31, NOV:30, DEC:31 }[month] || 365;
        const temperature = Number(parameters.T2M?.[month] ?? parameters.T2M?.ANN);
        const humidity = Number(parameters.RH2M?.[month] ?? parameters.RH2M?.ANN);
        const precipitationDaily = Number(parameters.PRECTOTCORR?.[month] ?? parameters.PRECTOTCORR?.ANN);
        const annualRainfall = Number(parameters.PRECTOTCORR?.ANN) * 365;
        const rainfall = annualRainfall;
        if (![temperature, humidity, rainfall].every(Number.isFinite)) throw new Error("The climate response did not include usable values.");
        setCoreValue("temperature", temperature.toFixed(1));
        setCoreValue("humidity", humidity.toFixed(1));
        setCoreValue("rainfall", rainfall.toFixed(0));
        state.climateSource = "NASA POWER climatology · Jan 2001–Dec 2025";
        state.climateCoordinates = { latitude, longitude };
        saveState();
        updateSnapshot();
        climateStatus.textContent = `Loaded ${monthInput?.value || "annual"} values from NASA POWER at ${latitude.toFixed(4)}, ${longitude.toFixed(4)}. Annual rainfall is converted from NASA POWER mm/day to mm/year; temperature and humidity use the selected month.`;
        showToast("NASA POWER climate values loaded.");
      } catch (error) {
        climateStatus.textContent = error.message;
        showToast(error.message);
      } finally {
        climateButton.disabled = false;
      }
    });
  }

  const soilButton = document.querySelector("[data-load-soil]");
  if (soilButton) {
    const soilStatus = document.querySelector("[data-soil-status]");
    const soilResult = document.querySelector("[data-soil-result]");
    const latInput = document.querySelector('[data-input-key="latitude"]');
    const lonInput = document.querySelector('[data-input-key="longitude"]');
    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const setField = (key, value) => {
      const input = document.querySelector(`[data-input-key="${key}"]`);
      if (!input || value === null || value === undefined) return;
      input.value = String(value);
      state[key] = input.value;
    };
    ["soilType", "soilTexture"].forEach((key) => document.querySelector(`[data-input-key="${key}"]`)?.addEventListener("change", () => { state.soilTypeSource = "manual"; saveState(); }));
    soilButton.addEventListener("click", async () => {
      const latitude = Number(latInput?.value);
      const longitude = Number(lonInput?.value);
      if (latInput?.value === "" || lonInput?.value === "" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        showToast("Enter a valid latitude and longitude first.");
        latInput?.focus();
        return;
      }
      soilButton.disabled = true;
      soilResult?.classList.add("hidden");
      soilStatus.textContent = "Looking up soil at these coordinates (SoilGrids can take a few seconds)…";
      try {
        const response = await fetch(`/api/soil/lookup?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`);
        const soil = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(soil.error || soil.errors?.join(" ") || "The soil lookup failed.");
        setField("soilTexture", soil.appTexture);
        setField("soilType", soil.appSoilType);
        if (soil.organicMatterPct !== null) setField("organicMatter", soil.organicMatterPct);
        state.soilTypeSource = "model-suggested";
        saveState();
        updateSnapshot();
        const t = soil.texture;
        soilStatus.textContent = `${soil.appTexture} soil (${t.usdaClass}) filled in below from ${soil.source.name}${soil.cached ? " (cached)" : ""}.`;
        soilResult.innerHTML = `<b>${esc(t.usdaClass)}</b> · clay ${t.clayPct}% · silt ${t.siltPct}% · sand ${t.sandPct}%<p class="muted mt-2">Organic matter ≈ ${soil.organicMatterPct ?? "n/a"}% · ${esc(soil.depth)}</p>${soil.phEstimate !== null ? `<p class="mt-2">Modelled soil pH ≈ <b>${soil.phEstimate}</b> <button type="button" class="ml-2 font-bold text-forest" data-use-soil-ph="${soil.phEstimate}">Use as my pH estimate ↗</button></p><p class="muted mt-1">pH is not filled automatically: a measured value is better than a modelled one.</p>` : ""}<p class="muted mt-2">${esc(soil.caveats[0])}</p>`;
        soilResult.classList.remove("hidden");
        soilResult.querySelector("[data-use-soil-ph]")?.addEventListener("click", (event) => {
          setField("soilPh", event.currentTarget.dataset.useSoilPh);
          saveState();
          updateSnapshot();
          showToast("Soil pH set to the SoilGrids estimate. Replace it with a measured value when you have one.");
        });
        showToast(`Soil type found: ${soil.appTexture}.`);
      } catch (error) {
        soilStatus.textContent = error.message;
        showToast(error.message);
      } finally {
        soilButton.disabled = false;
      }
    });
  }

  document.querySelectorAll("[data-review-inputs]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const firstInvalid = coreInputs.find((input) => !input.value || !input.validity.valid);
      if (firstInvalid) {
        event.preventDefault();
        firstInvalid.focus();
        firstInvalid.reportValidity();
        showToast("Enter all four valid field values before reviewing recommendations.");
        return;
      }
      event.preventDefault();
      window.location.href = `${link.href}?results=1`;
    });
  });

  const saveProfileButton = document.querySelector("[data-save-profile]");
  saveProfileButton?.addEventListener("click", async () => {
    const firstInvalid = coreInputs.find((input) => !input.value || !input.validity.valid);
    if (firstInvalid) {
      firstInvalid.focus();
      firstInvalid.reportValidity();
      showToast("Enter all four valid field values before saving a profile.");
      return;
    }
    const profileData = Object.fromEntries(allInputs.map((input) => [input.dataset.inputKey, input.value]).filter(([, value]) => value !== ""));
    profileData.name = window.prompt("Name this field profile", `Field profile · ${state.region || "my field"}`);
    if (!profileData.name) return;
    saveProfileButton.disabled = true;
    try {
      if (supabaseConfigured) {
        const { client, user } = await getAuthenticatedSupabase();
        const { error } = await client.from("field_profiles").insert({
          user_id: user.id,
          name: profileData.name,
          conditions: Object.fromEntries(Object.entries(profileData).filter(([key]) => key !== "name")),
        });
        if (error) throw error;
      } else {
        const localProfiles = (() => { try { const saved = JSON.parse(localStorage.getItem("tanimtech-local-profiles") || "[]"); return Array.isArray(saved) ? saved : []; } catch { return []; } })();
        localProfiles.unshift({ ...profileData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        localStorage.setItem("tanimtech-local-profiles", JSON.stringify(localProfiles.slice(0, 12)));
        const response = await fetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profileData) });
        const payload = await readJsonResponse(response);
        if (response.status === 401) throw new Error("Field profile saved locally on this device.");
        if (!response.ok) throw new Error(payload.errors?.join(" ") || "The field profile could not be saved.");
      }
      showToast("Field profile saved.");
    } catch (error) {
      showToast(error.message || "The field profile could not be saved.");
    } finally {
      saveProfileButton.disabled = false;
    }
  });

  const recommendationPage = document.querySelector("[data-recommendations-page]");
  if (recommendationPage) {
    const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[character]));
    const inputValue = (key) => {
      const value = Number(state[key]);
      return Number.isFinite(value) ? value : null;
    };
    const conditions = {
      soilPh: inputValue("soilPh"), temperature: inputValue("temperature"),
      humidity: inputValue("humidity"), rainfall: inputValue("rainfall"),
      soilType: state.soilType || "", season: state.season || "",
      region: state.region || "", planningMonth: state.planningMonth || "",
      plantCategory: state.plantCategory || "All categories", lifeForm: state.lifeForm || "No preference",
      soilTexture: state.soilTexture || "", drainage: state.drainage || "", moisture: state.moisture || "",
      salinity: state.salinity || "", organicMatter: inputValue("organicMatter"), soilNotes: state.soilNotes || "",
      catalog: state.catalog || "extended",
      soilTypeSource: state.soilTypeSource || "",
    };
    if ([conditions.soilPh, conditions.temperature, conditions.humidity, conditions.rainfall].some((value) => value === null)) {
      recommendationPage.innerHTML = '<p class="eyebrow">CROP PLANNING / RECOMMENDATIONS</p><h1 class="section-heading mt-3">Enter your field conditions first.</h1><p class="muted mt-3">Recommendations are not generated from placeholder values. Add your measured pH, temperature, humidity, and annual rainfall to continue.</p><div class="notice mt-8"><a class="button button-primary" href="conditions.html">Enter field conditions ↗</a></div>';
      return;
    }
    let cropImages = {};
    const cropImagesPromise = fetch("js/crop-image-credits.json?v=4")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Crop image catalog unavailable")))
      .then((catalog) => Object.fromEntries(Object.entries(catalog || {}).map(([slug, image]) => [slug, image?.src]).filter(([, src]) => src)))
      .catch(() => ({}));
    const cropDefinitions = [
      { slug: "pechay", name: "Pechay", category: "Leafy and fruit vegetables", lifeForm: "Herb", days: [40, 90], bands: [[6, 7.5], [12, 22], [800, 1600], [0, 100]], summary: "FAO ECOCROP requirement profile for Chinese cabbage / pechay." },
      { slug: "kangkong", name: "Kangkong", category: "Leafy and fruit vegetables", lifeForm: "Vine", days: [30, 70], bands: [[5, 7], [15, 35], [2000, 2500], [0, 100]], summary: "FAO ECOCROP requirement profile for water spinach." },
      { slug: "mongo", name: "Mongo", category: "Legumes", lifeForm: "Herb", days: [50, 120], bands: [[5.5, 6.2], [21, 36], [650, 900], [0, 100]], summary: "FAO ECOCROP requirement profile for green gram / mung bean." },
      { slug: "sitaw", name: "Sitaw", category: "Legumes", lifeForm: "Vine", days: [50, 150], bands: [[5.5, 7], [20, 35], [1500, 2000], [0, 100]], summary: "FAO ECOCROP requirement profile for yard-long bean." },
      { slug: "talong", name: "Talong", category: "Leafy and fruit vegetables", lifeForm: "Herb", days: [70, 120], bands: [[5.5, 6.8], [20, 35], [1200, 1600], [0, 100]], summary: "FAO ECOCROP requirement profile for eggplant." },
      { slug: "kamote", name: "Kamote", category: "Root crops", lifeForm: "Vine", days: [80, 170], bands: [[5, 7], [18, 28], [750, 2000], [0, 100]], summary: "FAO ECOCROP requirement profile for sweet potato." },
      { slug: "mais", name: "Mais", category: "Grains", lifeForm: "Herb", days: [65, 365], bands: [[5, 7], [18, 33], [600, 1200], [0, 100]], summary: "FAO ECOCROP requirement profile for maize." },
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
      const factors = [["soilPh", "Soil pH", 35], ["temperature", "Temperature", 35], ["rainfall", "Annual rainfall", 30], ["humidity", "Humidity context", 0]];
      let pool = cropDefinitions.filter((crop) => (!conditions.plantCategory || conditions.plantCategory === "All categories" || crop.category === conditions.plantCategory) && (!conditions.lifeForm || conditions.lifeForm === "No preference" || crop.lifeForm === conditions.lifeForm));
      return pool.map((crop) => {
        const breakdown = factors.map(([key, label, weight], index) => { const value = conditions[key]; const band = crop.bands[index]; return { factor: key, label, value, band, points: scoreFactor(value, band, weight), maxPoints: weight, status: value < band[0] ? "below" : value > band[1] ? "above" : "within" }; });
        const within = breakdown.filter((item) => item.status === "within" && item.maxPoints > 0).map((item) => item.label.toLowerCase());
        const off = breakdown.filter((item) => item.status !== "within");
        return { ...crop, fit: breakdown.reduce((sum, item) => sum + item.points, 0), breakdown, whyItAppears: within.length ? `${within[0][0].toUpperCase() + within[0].slice(1)} and other scored values sit within the FAO ECOCROP requirement bands.` : "The scored values sit outside the strongest ECOCROP requirement bands.", whatToCheck: off.length ? off.map((item) => `${item.label} (${item.value}) is ${item.status} the ${item.band[0]}–${item.band[1]} requirement band.`).join(" ") : "The scored requirements are within band; drainage, pests, and seed quality are still unassessed.", dataEvidence: evidenceByCrop[crop.slug] || { available: false, source: "No matching cleaned evidence profile; crop requirement bands are from FAO ECOCROP." } };
      }).sort((a, b) => b.fit - a.fit).map((result, index) => ({ ...result, label: index === 0 ? "CLOSEST FIT" : "ALTERNATIVE" }));
    };
    let sortMode = "fit";
    let currentResults = [];
    const formatBand = (band) => Array.isArray(band) ? `${band[0]}–${band[1]}` : "not available";
    const evidenceMarkup = (result) => result.dataEvidence?.available ? `<details class="mt-4"><summary class="text-xs font-bold" style="cursor:pointer">View cleaned profile evidence ↗</summary><div class="notice mt-3 text-xs"><p><b>Source</b><br>${escapeHtml(result.dataEvidence.source)}</p><p class="mt-2"><b>Soil profile</b><br>${escapeHtml(result.dataEvidence.soilProfile || "Available")}</p><p class="mt-2"><b>Yield profile</b><br>${escapeHtml(result.dataEvidence.yieldProfile || "Available")}</p></div></details>` : `<details class="mt-4"><summary class="text-xs font-bold" style="cursor:pointer">View data coverage note ↗</summary><div class="warning mt-3 text-xs">${escapeHtml(result.dataEvidence?.source || "No profile matched this crop.")} The fit uses the committed FAO ECOCROP requirement bands.</div></details>`;
    const guideMarkup = (result) => `<a class="button mt-4" href="crop-guide.html?crop=${encodeURIComponent(result.slug)}">Open crop guide ↗</a>`;
    const renderRecommendations = (payload, mode = "API CONNECTED", runId = null) => {
      currentResults = Array.isArray(payload.results) ? [...payload.results] : [];
      if (sortMode === "name") currentResults.sort((a, b) => a.name.localeCompare(b.name)); else currentResults.sort((a, b) => b.fit - a.fit);
      if (!currentResults.length) { recommendationPage.innerHTML = '<section class="warning mt-8"><strong>No crops matched the selected filters.</strong><p class="muted mt-2 text-xs">Return to your conditions and broaden the category or life-form filters.</p></section>'; return; }
      const first = currentResults[0];
      const evidenceCount = currentResults.filter((result) => result.dataEvidence?.available).length;
      const shownCount = conditions.catalog === "extended" ? 6 : 3;
      const cards = currentResults.slice(0, shownCount).map((result, index) => {
        const imageSrc = cropImages[result.slug] || "images/hero-farm.jpg";
        return `<article class="card overflow-hidden"><img class="h-52 w-full object-cover" loading="lazy" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(result.name)}"><div class="p-6"><div class="flex items-center justify-between"><span class="badge" ${index ? 'style="background:#edf0e9"' : ""}>${index ? "ALTERNATIVE" : "CLOSEST FIT"}</span><small class="muted">${result.growingDays ? result.growingDays[0] : result.days[0]}–${result.growingDays ? result.growingDays[1] : result.days[1]} days</small></div><div class="mt-3 flex items-center justify-between"><h2 class="serif text-3xl">${escapeHtml(result.name)}</h2><span class="serif text-3xl">${result.fit}</span></div><p class="muted text-xs">Fit / 100 · not a probability of success</p><div class="score-line my-4"><span style="width:${result.fit}%"></span></div><p class="eyebrow">WHY IT APPEARS</p><p class="mt-2 text-xs">${escapeHtml(result.whyItAppears)}</p><p class="eyebrow mt-4">WHAT TO CHECK</p><p class="mt-2 text-xs">${escapeHtml(result.whatToCheck)}</p><span class="badge mt-4">${result.dataEvidence?.available ? "CLEANED KAGGLE PROFILE" : "ECOCROP REQUIREMENTS"}</span>${result.scientific && result.source === "extended" ? `<p class="muted mt-3 text-xs"><i>${escapeHtml(result.scientific)}</i> · ${escapeHtml(result.category)} · ${escapeHtml(result.lifeForm)}</p>` : ""}${result.soilMatch?.status && result.soilMatch.status !== "unknown" ? `<p class="muted mt-3 text-xs">Soil reference: <b>${escapeHtml(result.soilMatch.status)}</b> for ${escapeHtml(result.soilMatch.label)} texture.</p>` : ""}${evidenceMarkup(result)}${guideMarkup(result)}<button class="button mt-3 w-full" type="button" data-track-crop="${escapeHtml(result.slug)}" data-crop-name="${escapeHtml(result.name)}" data-crop-source="manual" data-crop-fit="${Number.isFinite(Number(result.fit)) ? result.fit : ""}" data-run-id="${escapeHtml(runId || "")}">Track as in progress</button></div></article>`;
      }).join("");
      const breakdown = (first.breakdown || []).map((item) => `<div class="mini-row"><b>${escapeHtml(item.label)}<br><small class="muted font-normal">${item.value}</small></b><span>${formatBand(item.band)}<br><small class="muted">Reference band</small></span><span class="badge">${item.points} / ${item.maxPoints}</span></div>`).join("");
      const saved = !supabaseConfigured && localStorage.getItem("tanimtech-saved-shortlist") === "true";
      recommendationPage.innerHTML = `<p class="eyebrow">CROP PLANNING / ${mode === "API CONNECTED" ? "API SHORTLIST" : "LOCAL CALCULATION"}</p><div class="flex flex-wrap items-end justify-between gap-5"><div><h1 class="section-heading mt-3">Crops worth a closer look.</h1><p class="muted mt-3">${mode === "API CONNECTED" ? "Live fit scores from the recommendation API." : "Fit scores calculated from your entries while the API is unavailable."}</p></div><a class="button button-primary" href="conditions.html">Edit conditions ↗</a></div><div class="notice mt-6 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5"><span>pH ${conditions.soilPh}</span><span>${conditions.temperature} °C mean</span><span>${conditions.humidity}% RH</span><span>${conditions.rainfall} mm / year</span><span>${escapeHtml(conditions.planningMonth)} <span class="badge ml-2">${mode === "API CONNECTED" ? "API RESULTS" : "LOCAL RESULTS"}</span></span></div><div class="mt-6 flex flex-wrap items-center justify-between gap-4"><p class="muted text-xs">${currentResults.length} matches${conditions.catalog === "extended" ? " from the extended edible catalog" : ""} · ${evidenceCount} backed by cleaned Kaggle profiles · ${escapeHtml(conditions.region)}</p><div class="flex flex-wrap gap-3"><button class="field-control min-h-10 text-xs" type="button" data-sort-results>Sort: ${sortMode === "fit" ? "highest fit" : "crop name"} ↕</button><button class="button button-primary" type="button" data-scroll-compare>Compare top ${shownCount} ↗</button></div></div><div class="mt-6 grid gap-5 lg:grid-cols-3">${cards}</div><p class="muted mt-4 text-xs">${escapeHtml(payload.note || "Fit is a transparent screening score, not a yield prediction.")} Cleaned Kaggle profiles are evidence context; they do not turn fit into a forecast.</p><div id="compare" class="mt-10 grid items-start gap-6 lg:grid-cols-[2fr_1fr]"><section class="card p-7"><p class="eyebrow">EXPLAIN THE FIT / ${first.fit} OF 100</p><h2 class="serif mt-3">Why ${escapeHtml(first.name)} ranks first</h2><p class="muted mt-3">The recommendation engine keeps the four weighted core factors visible. Add-on context provides guidance and never adds score points.</p><div class="mt-5">${breakdown}</div><p class="muted mt-4 text-xs">${escapeHtml(first.dataEvidence?.source || "FAO ECOCROP requirement bands")}</p></section><aside class="card p-7"><p class="eyebrow">FIT ≠ CERTAINTY</p><h2 class="serif mt-3 text-3xl">What the score can’t tell you</h2><div class="mt-4"><div class="mini-row"><span class="muted">Input completeness</span><b>4 / 4 core values<br><small class="muted font-normal">Entered, not independently verified</small></b></div><div class="mini-row"><span class="muted">Field blind spots</span><b>Drainage · pests · seed quality<br><small class="muted font-normal">Not included in the score</small></b></div></div><div class="warning mt-5"><strong class="text-xs">⚠ Seasonal risk stays visible</strong><p class="muted mt-2 text-xs">A high fit score must not override current local advisories.</p></div></aside></div>      ${renderFeedbackForm("recommendation", runId)}<section class="mt-8 flex flex-wrap items-center justify-between gap-6 rounded bg-forest px-8 py-7 text-white"><div><h2 class="serif text-2xl">Take the shortlist back to the field.</h2><p class="mt-2 text-sm text-white/75">Save this shortlist on your device, then verify drainage and local conditions before planting at scale.</p></div><button class="button" type="button" data-save-shortlist>${saved ? "Saved on this device ✓" : "Save this shortlist ↗"}</button></section>`;
      recommendationPage.querySelector("[data-result-feedback]")?.addEventListener("submit", submitFeedbackForm);
      recommendationPage.querySelector("[data-sort-results]").addEventListener("click", () => { sortMode = sortMode === "fit" ? "name" : "fit"; renderRecommendations(payload, mode, runId); });
      recommendationPage.querySelector("[data-scroll-compare]").addEventListener("click", () => document.querySelector("#compare")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      recommendationPage.querySelector("[data-save-shortlist]").addEventListener("click", async (event) => {
        if (supabaseConfigured) {
          if (!runId) {
            showToast("This shortlist could not be saved to your Supabase profile. Try again after checking your connection.");
            return;
          }
          event.currentTarget.disabled = true;
          event.currentTarget.textContent = "Saved to profile ✓";
          showToast("This shortlist is saved in your private recommendation history.");
          return;
        }
        localStorage.setItem("tanimtech-saved-shortlist", "true");
        const localSaved = (() => { try { return JSON.parse(localStorage.getItem("tanimtech-saved-recommendations") || "[]"); } catch { return []; } })();
        localSaved.unshift({ label: `Shortlist · ${conditions.region || "my field"}`, inputs: conditions, results: currentResults, createdAt: new Date().toISOString() });
        localStorage.setItem("tanimtech-saved-recommendations", JSON.stringify(localSaved.slice(0, 12)));
        event.currentTarget.disabled = true;
        try {
          const response = await fetch("/api/recommendations/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...conditions, label: `Shortlist · ${conditions.region || "my field"}` }) });
          if (response.status === 401) throw new Error("Saved locally on this device.");
          if (!response.ok) throw new Error("The shortlist could not be saved to your account.");
          event.currentTarget.textContent = "Saved to profile ✓";
          showToast("Shortlist saved to your profile.");
        } catch (error) {
          event.currentTarget.textContent = "Saved on this device ✓";
          showToast(error.message);
        }
      });
    };
    fetch("/api/recommendations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(conditions) })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Recommendation API unavailable")))
      .then(async (payload) => {
        cropImages = await cropImagesPromise;
        const runId = await persistRecommendationRun({
          inputMode: "manual",
          inputData: conditions,
          results: (payload.results || []).slice(0, 20),
          modelName: payload.rankingModel?.name || "crop-fit-recommendations",
          modelVersion: payload.rankingModel?.version || null,
        });
        renderRecommendations(payload, "API CONNECTED", runId);
      })
      .catch(async () => {
        cropImages = await cropImagesPromise;
        const results = localRecommend();
        const runId = await persistRecommendationRun({
          inputMode: "manual",
          inputData: conditions,
          results: results.slice(0, 20),
          modelName: "local-crop-fit",
          modelVersion: null,
        });
        renderRecommendations({ results, note: "The API is unavailable on this static deployment; the same transparent ECOCROP screening calculation is running locally." }, "LOCAL CALCULATION", runId);
      });
  }

  const loginPage = document.querySelector("[data-login-page]");
  const showAuthMessage = (element, text) => {
    if (element) element.textContent = text;
  };
  const isValidEmailAddress = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const authErrorMessage = (error, fallback) => {
    const message = String(error?.message || "");
    if (error?.code === "over_email_send_rate_limit" || /email.*rate.?limit|rate.?limit.*email/i.test(message)) {
      return "Supabase's default email service is rate-limited (currently 2 emails per hour) and only sends to project-team addresses. Avoid retrying for now; configure a custom SMTP provider in Supabase Dashboard → Authentication → SMTP Settings to send to other addresses.";
    }
    if (error?.code === "invalid_credentials" || error?.code === "email_not_confirmed") return fallback;
    return message || fallback;
  };
  const withTimeout = (promise, milliseconds, message) => Promise.race([
    promise,
    new Promise((_, reject) => window.setTimeout(() => reject(new Error(message)), milliseconds)),
  ]);
  const supabaseConfigured = Boolean(window.tanimtechSupabaseConfigured);
  const getAuthenticatedSupabase = async () => {
    if (!supabaseConfigured) throw new Error("Supabase is not configured for this workspace.");
    const client = await window.tanimtechGetSupabaseClient();
    if (!client) throw new Error("Supabase is unavailable.");
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Sign in again before saving account data.");
    return { client, user: data.user };
  };
  const persistRecommendationRun = async ({ inputMode, inputData, results, modelName, modelVersion }) => {
    if (!supabaseConfigured) return null;
    try {
      const { client, user } = await getAuthenticatedSupabase();
      const { data, error } = await client.from("recommendation_runs").insert({
        user_id: user.id,
        input_mode: inputMode,
        input_data: inputData,
        results,
        model_name: modelName,
        model_version: modelVersion,
      }).select("id").single();
      if (error) throw error;
      return data.id;
    } catch (error) {
      showToast(`Result is available, but could not be synced to your profile: ${error.message}`);
      return null;
    }
  };
  const saveTrackedCrop = async (slug, name, sourceMode, runId, fitScore) => {
    if (!slug || !name) throw new Error("This crop result is incomplete and cannot be saved.");
    const score = fitScore === "" || fitScore === undefined ? null : Number(fitScore);
    if (supabaseConfigured) {
      const { client, user } = await getAuthenticatedSupabase();
      const { error } = await client.from("crop_plans").upsert({
        user_id: user.id,
        crop_slug: slug,
        crop_name: name,
        status: "in_progress",
        source_mode: sourceMode === "image" ? "image" : "manual",
        recommendation_run_id: runId || null,
        fit_score: Number.isFinite(score) ? score : null,
      }, { onConflict: "user_id,crop_slug" });
      if (error) throw error;
    } else {
      const saved = (() => {
        try {
          const value = JSON.parse(localStorage.getItem("tanimtech-crop-plans") || "[]");
          return Array.isArray(value) ? value : [];
        } catch {
          return [];
        }
      })();
      const plan = {
        id: slug,
        crop_slug: slug,
        crop_name: name,
        status: "in_progress",
        source_mode: sourceMode === "image" ? "image" : "manual",
        fit_score: Number.isFinite(score) ? score : null,
        updated_at: new Date().toISOString(),
      };
      const existing = saved.findIndex((item) => item.crop_slug === slug);
      if (existing >= 0) saved[existing] = { ...saved[existing], ...plan };
      else saved.unshift(plan);
      localStorage.setItem("tanimtech-crop-plans", JSON.stringify(saved));
    }
    showToast(`${name} added to your crop tracker.`);
  };
  const renderFeedbackForm = (kind, runId) => {
    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[character]));
    const correctionField = kind === "soil_image"
      ? `<label class="mt-4 block"><span class="field-label">If it was wrong, what soil type is closer?</span><span class="field-control"><select name="corrected_soil_type"><option value="">No correction</option>${["Clay", "Loam", "Sandy", "Silty", "Peaty", "Unknown"].map((soilType) => `<option value="${soilType}">${soilType}</option>`).join("")}</select></span></label>`
      : `<label class="mt-4 block"><span class="field-label">Which crop should have ranked higher? (optional)</span><span class="field-control"><input name="corrected_crop_slug" type="text" maxlength="120" placeholder="Crop name or slug"></span></label>`;
    return `<section class="card mt-8 p-6"><p class="eyebrow">HELP IMPROVE FUTURE RESULTS</p><h2 class="serif mt-2 text-2xl">${kind === "soil_image" ? "Was the soil suggestion useful?" : "How accurate was this crop shortlist?"}</h2><p class="muted mt-2 text-xs">Your feedback is saved with this result for later review. It does not automatically change the live model.</p><form class="mt-4" data-result-feedback data-feedback-kind="${kind}" data-run-id="${esc(runId || "")}"><label class="block"><span class="field-label">${kind === "soil_image" ? "Was the suggestion accurate?" : "Was this shortlist helpful?"}</span><span class="field-control"><select name="helpful" required><option value="">Choose one</option><option value="true">Yes</option><option value="false">No</option></select></span></label>${correctionField}<label class="mt-4 block"><span class="field-label">Additional details (optional)</span><span class="field-control"><textarea name="comment" maxlength="1000" rows="3" placeholder="What should the result have considered?"></textarea></span></label><button class="button button-primary mt-4" type="submit" ${runId ? "" : "disabled"}>Send feedback</button><p class="field-note mt-3" data-feedback-status aria-live="polite">${runId ? "Feedback is private to your account." : "This result could not be synced, so feedback cannot be attached to it."}</p></form></section>`;
  };
  const submitFeedbackForm = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const runId = form.dataset.runId;
    const status = form.querySelector("[data-feedback-status]");
    if (!runId) {
      showAuthMessage(status, "This result is not synced to your account. Feedback could not be saved.");
      return;
    }
    const values = new FormData(form);
    const feedbackKind = form.dataset.feedbackKind;
    const helpfulValue = values.get("helpful");
    const feedback = {
      recommendation_run_id: runId,
      feedback_kind: feedbackKind,
      helpful: helpfulValue === "" ? null : helpfulValue === "true",
      corrected_crop_slug: feedbackKind === "recommendation" ? values.get("corrected_crop_slug") || null : null,
      corrected_soil_type: feedbackKind === "soil_image" ? values.get("corrected_soil_type") || null : null,
      comment: String(values.get("comment") || "").trim(),
    };
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      const { client, user } = await getAuthenticatedSupabase();
      feedback.user_id = user.id;
      const { error } = await client.from("model_feedback").upsert(feedback, {
        onConflict: "recommendation_run_id,user_id,feedback_kind",
      });
      if (error) throw error;
      showAuthMessage(status, "Thank you. Your feedback was saved for later review.");
      showToast("Feedback saved.");
    } catch (error) {
      showAuthMessage(status, error.message || "Feedback could not be saved.");
      showToast(error.message || "Feedback could not be saved.");
    } finally {
      if (button) button.disabled = false;
    }
  };
  const updateCropPlanStatus = async (planId, status) => {
    if (supabaseConfigured) {
      const { client, user } = await getAuthenticatedSupabase();
      const { error } = await client.from("crop_plans").update({ status }).eq("id", planId).eq("user_id", user.id);
      if (error) throw error;
      return;
    }
    const plans = (() => {
      try {
        const value = JSON.parse(localStorage.getItem("tanimtech-crop-plans") || "[]");
        return Array.isArray(value) ? value : [];
      } catch {
        return [];
      }
    })();
    const plan = plans.find((item) => item.id === planId);
    if (!plan) throw new Error("The saved crop could not be found.");
    plan.status = status;
    plan.updated_at = new Date().toISOString();
    localStorage.setItem("tanimtech-crop-plans", JSON.stringify(plans));
  };
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-track-crop]");
    if (!button || button.disabled) return;
    button.disabled = true;
    try {
      await saveTrackedCrop(
        button.dataset.trackCrop,
        button.dataset.cropName,
        button.dataset.cropSource,
        button.dataset.runId,
        button.dataset.cropFit
      );
      button.textContent = "In your crop tracker ✓";
    } catch (error) {
      button.disabled = false;
      showToast(error.message || "The crop could not be saved.");
    }
  });
  if (loginPage) {
    const message = loginPage.querySelector("[data-login-message]");
    const loginForm = loginPage.querySelector("[data-login-form]");
    const forgotPasswordButton = loginPage.querySelector("[data-forgot-password]");
    const resendConfirmationButton = loginPage.querySelector("[data-resend-confirmation]");
    const resetRequestForm = loginPage.querySelector("[data-password-reset-request-form]");
    const resetRequestMessage = loginPage.querySelector("[data-reset-request-message]");
    const confirmationForm = loginPage.querySelector("[data-confirmation-form]");
    const confirmationMessage = loginPage.querySelector("[data-confirmation-message]");
    const resetPasswordForm = loginPage.querySelector("[data-password-reset-form]");
    const resetPasswordMessage = loginPage.querySelector("[data-reset-password-message]");
    const recoveryLink = new URLSearchParams(window.location.search).has("recovery");
    const setAuthView = (view) => {
      if (loginForm) loginForm.hidden = view !== "login";
      if (forgotPasswordButton) forgotPasswordButton.hidden = view !== "login";
      if (resendConfirmationButton) resendConfirmationButton.hidden = view !== "login";
      if (resetRequestForm) resetRequestForm.classList.toggle("hidden", view !== "request");
      if (confirmationForm) confirmationForm.classList.toggle("hidden", view !== "confirmation");
      if (resetPasswordForm) resetPasswordForm.classList.toggle("hidden", view !== "reset");
    };
    if (supabaseConfigured) {
      if (!new URLSearchParams(window.location.search).has("registered")) {
        showAuthMessage(message, "Use your email address and Supabase password to sign in.");
      }
    }
    if (new URLSearchParams(window.location.search).has("registered")) {
      showAuthMessage(message, supabaseConfigured
        ? "Signup request received. If a new account was created, Supabase sent a verification email. Check your inbox and spam folder before trying to sign up again. Use Resend confirmation email if needed."
        : "Secure sign-in is unavailable because Supabase Auth is not configured.");
    }
    if (new URLSearchParams(window.location.search).has("password-reset")) {
      showAuthMessage(message, "Your password was updated. Sign in with your new password.");
    }
    if (recoveryLink) {
      setAuthView("reset");
      (async () => {
        try {
          if (!supabaseConfigured) throw new Error("Supabase Auth is not configured.");
          const client = await window.tanimtechGetSupabaseClient();
          const { data, error } = await client.auth.getSession();
          if (error) throw error;
          if (!data.session) throw new Error("This reset link is invalid or expired. Request a new one.");
        } catch (error) {
          showAuthMessage(resetPasswordMessage, error.message || "Could not validate this reset link.");
          const submit = resetPasswordForm?.querySelector('button[type="submit"]');
          if (submit) submit.disabled = true;
        }
      })();
    }
    forgotPasswordButton?.addEventListener("click", () => {
      setAuthView("request");
      loginPage.querySelector("[data-reset-email]").value = loginPage.querySelector("[data-login-username]")?.value.trim() || "";
      resetRequestMessage.textContent = "";
    });
    resendConfirmationButton?.addEventListener("click", () => {
      setAuthView("confirmation");
      loginPage.querySelector("[data-confirmation-email]").value = loginPage.querySelector("[data-login-username]")?.value.trim() || "";
      confirmationMessage.textContent = "";
    });
    loginPage.querySelectorAll("[data-cancel-password-reset]").forEach((button) => {
      button.addEventListener("click", () => {
        setAuthView("login");
        showAuthMessage(message, "Use your email address and Supabase password to sign in.");
      });
    });
    resetRequestForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = loginPage.querySelector("[data-reset-email]")?.value.trim().toLowerCase() || "";
      if (!isValidEmailAddress(email)) {
        showAuthMessage(resetRequestMessage, "Enter a valid email address for this account.");
        return;
      }
      const button = resetRequestForm.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      try {
        if (!supabaseConfigured) throw new Error("Supabase Auth is not configured.");
        const client = await window.tanimtechGetSupabaseClient();
        const redirectTo = new URL("index.html?recovery=1", window.location.href).href;
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        showAuthMessage(resetRequestMessage, "If an account exists for that address, Supabase will email a password reset link. Check your inbox and spam folder.");
      } catch (error) {
        showAuthMessage(resetRequestMessage, authErrorMessage(error, "The reset email could not be sent."));
      } finally {
        if (button) button.disabled = false;
      }
    });
    confirmationForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = loginPage.querySelector("[data-confirmation-email]")?.value.trim().toLowerCase() || "";
      if (!isValidEmailAddress(email)) {
        showAuthMessage(confirmationMessage, "Enter a valid email address for this account.");
        return;
      }
      const button = confirmationForm.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      try {
        if (!supabaseConfigured) throw new Error("Supabase Auth is not configured.");
        const client = await window.tanimtechGetSupabaseClient();
        const emailRedirectTo = new URL("index.html", window.location.href).href;
        const { error } = await client.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo },
        });
        if (error) throw error;
        showAuthMessage(confirmationMessage, "If this address has an unconfirmed account, Supabase will resend its confirmation email. Check your inbox and spam folder.");
      } catch (error) {
        showAuthMessage(confirmationMessage, authErrorMessage(error, "The confirmation email could not be resent."));
      } finally {
        if (button) button.disabled = false;
      }
    });
    resetPasswordForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = loginPage.querySelector("[data-reset-password]")?.value || "";
      const confirmed = loginPage.querySelector("[data-reset-confirm]")?.value || "";
      if (!Object.values(passwordChecks).every((check) => check(password))) {
        showAuthMessage(resetPasswordMessage, "Use at least 8 characters with uppercase, lowercase, a number, and a symbol.");
        return;
      }
      if (password !== confirmed) {
        showAuthMessage(resetPasswordMessage, "The new passwords do not match.");
        return;
      }
      const button = resetPasswordForm.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      try {
        const client = await window.tanimtechGetSupabaseClient();
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        window.location.replace("homepage.html");
      } catch (error) {
        showAuthMessage(resetPasswordMessage, error.message || "The password could not be updated.");
        if (button) button.disabled = false;
      }
    });
    loginForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = loginPage.querySelector("[data-login-username]")?.value.trim();
      const password = loginPage.querySelector("[data-login-password]")?.value;
      if (!supabaseConfigured) {
        showAuthMessage(message, "Secure sign-in is unavailable because Supabase Auth is not configured.");
        return;
      }
      try {
        const supabaseClient = await window.tanimtechGetSupabaseClient();
        if (!supabaseClient) throw new Error("Supabase Auth is unavailable.");
        if (!isValidEmailAddress(username || "")) {
          throw new Error("Enter the email address used when you signed up with Supabase.");
        }
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email: username.toLowerCase(), password });
        if (error) throw error;
        const signedInUser = data.user;
        saveCurrentUser({
          email: signedInUser?.email || "",
          username: signedInUser?.username || signedInUser?.user_metadata?.username || signedInUser?.email?.split("@")[0] || "",
        });
        const requested = new URLSearchParams(window.location.search).get("next") || "homepage.html";
        const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "homepage.html";
        window.location.href = next;
      } catch (error) {
        const detail = error.code === "invalid_credentials"
          ? "Supabase did not recognize that email/password combination. Check that you confirmed the signup email and use Forgot your password? if needed."
          : error.code === "email_not_confirmed"
            ? "Confirm your email from the Supabase message before signing in. Check your inbox and spam folder."
            : error.message || "Sign-in failed.";
        showAuthMessage(message, authErrorMessage(error, detail));
        showToast(authErrorMessage(error, detail));
      }
    });
  }

  const signupPage = document.querySelector("[data-signup-page]");
  if (signupPage) {
    const form = signupPage.querySelector("[data-signup-form]");
    const emailInput = signupPage.querySelector("[data-signup-email]");
    const usernameInput = signupPage.querySelector("[data-signup-username]");
    const passwordInput = signupPage.querySelector("[data-signup-password]");
    const confirmInput = signupPage.querySelector("[data-signup-confirm]");
    const message = signupPage.querySelector("[data-signup-message]");
    const successNotice = signupPage.querySelector("[data-signup-success]");
    const storageMessage = signupPage.querySelector("[data-account-storage-message]");
    const submitButton = form?.querySelector('button[type="submit"]');
    const newAccountButton = signupPage.querySelector("[data-signup-new-account]");
    const originalSubmitLabel = submitButton?.innerHTML || "";
    const verificationPendingKey = "tanimtech-signup-verification-pending";
    let signupPending = false;
    let signupComplete = sessionStorage.getItem(verificationPendingKey) === "true";
    if (signupComplete) {
      if (form) form.hidden = true;
      if (successNotice) successNotice.hidden = false;
      if (submitButton) submitButton.disabled = true;
    }
    newAccountButton?.addEventListener("click", () => {
      sessionStorage.removeItem(verificationPendingKey);
      signupComplete = false;
      if (form) form.hidden = false;
      if (successNotice) successNotice.hidden = true;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = originalSubmitLabel;
      }
      emailInput?.focus();
    });
    if (supabaseConfigured && storageMessage) {
      const storageTitle = signupPage.querySelector("[data-account-storage-title]");
      if (storageTitle) storageTitle.textContent = "Supabase account";
      storageMessage.textContent = "Supabase Auth will manage this account. Email confirmation follows your Supabase Auth settings.";
    }
    const updatePasswordRules = () => {
      const password = passwordInput?.value || "";
      Object.entries(passwordChecks).forEach(([rule, check]) => {
        const item = signupPage.querySelector(`[data-password-rule="${rule}"]`);
        if (item) {
          item.classList.toggle("text-forest", check(password));
          item.classList.toggle("text-muted", !check(password));
        }
      });
    };
    passwordInput?.addEventListener("input", updatePasswordRules);
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (signupPending || signupComplete) return;
      const email = emailInput?.value.trim().toLowerCase() || "";
      const username = usernameInput?.value.trim() || "";
      const password = passwordInput?.value || "";
      const confirmed = confirmInput?.value || "";
      updatePasswordRules();
      if (!isValidEmailAddress(email)) {
        showAuthMessage(message, "Enter a valid email address.");
        return;
      }
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
        showAuthMessage(message, "Username must be 3–20 letters, numbers, or underscores.");
        return;
      }
      if (!Object.values(passwordChecks).every((check) => check(password))) {
        showAuthMessage(message, "Your password must meet every rule listed above.");
        return;
      }
      if (password !== confirmed) {
        showAuthMessage(message, "The passwords do not match.");
        return;
      }
      if (!supabaseConfigured) {
        showAuthMessage(message, "Secure account creation is unavailable because Supabase Auth is not configured.");
        return;
      }
      signupPending = true;
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Creating account…";
      }
      try {
        const supabaseClient = await window.tanimtechGetSupabaseClient();
        if (!supabaseClient) throw new Error("Supabase Auth is unavailable.");
        const emailRedirectTo = new URL("index.html", window.location.href).href;
        const { data, error } = await withTimeout(
          supabaseClient.auth.signUp({
            email,
            password,
            options: { data: { username }, emailRedirectTo },
          }),
          15000,
          "Supabase did not respond within 15 seconds. Check your connection and try again once."
        );
        if (error) throw error;
        if (!data.user) throw new Error("Supabase did not return a user after signup.");
        signupComplete = true;
        if (data.session) {
          saveCurrentUser({
            email: data.user.email || "",
            username: data.user.user_metadata?.username || data.user.email?.split("@")[0] || "",
          });
          window.location.href = "homepage.html";
        } else {
          try {
            sessionStorage.setItem(verificationPendingKey, "true");
          } catch (storageError) {
            showToast("Signup was accepted, but this tab could not remember the verification state. Do not submit signup again.");
          }
          passwordInput.value = "";
          confirmInput.value = "";
          if (successNotice) {
            form.hidden = true;
            successNotice.hidden = false;
          } else {
            showAuthMessage(message, "Signup request received. If a new account was created, Supabase sent a verification email. Check your inbox and spam folder before trying to sign up again.");
          }
          showToast("Signup request received. Check your email for verification.");
        }
      } catch (error) {
        signupComplete = false;
        const detail = authErrorMessage(error, "Could not create the account.");
        showAuthMessage(message, detail);
        showToast(detail);
      } finally {
        signupPending = false;
        if (!signupComplete && submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = originalSubmitLabel;
        }
      }
    });
  }

  const profileMenus = Array.from(document.querySelectorAll("[data-profile-actions]"));
  const setProfileMenuOpen = (profileMenu, isOpen) => {
    const trigger = profileMenu?.querySelector("[data-profile-menu-trigger]");
    const panel = profileMenu?.querySelector(".profile-actions-panel");
    if (!trigger || !panel) return;
    trigger.setAttribute("aria-expanded", String(isOpen));
    panel.hidden = !isOpen;
  };
  profileMenus.forEach((profileMenu) => {
    const trigger = profileMenu.querySelector("[data-profile-menu-trigger]");
    const panel = profileMenu.querySelector(".profile-actions-panel");
    trigger?.addEventListener("click", () => setProfileMenuOpen(profileMenu, trigger.getAttribute("aria-expanded") !== "true"));
    panel?.querySelectorAll("[data-profile-menu-close]").forEach((link) => link.addEventListener("click", () => {
      setProfileMenuOpen(profileMenu, false);
      const href = link.getAttribute("href") || "";
      const destination = href.startsWith("#") ? document.querySelector(href) : null;
      if (destination) window.setTimeout(() => destination.focus({ preventScroll: true }), 0);
    }));
    profileMenu.addEventListener("focusout", (event) => {
      if (!profileMenu.contains(event.relatedTarget)) setProfileMenuOpen(profileMenu, false);
    });
    profileMenu.querySelector("[data-profile-menu-signout]")?.addEventListener("click", async () => {
      setProfileMenuOpen(profileMenu, false);
      try {
        await window.tanimtechAuth?.signOut();
      } catch (error) {
        showToast(error.message || "Could not sign out.");
      }
    });
  });
  document.addEventListener("click", (event) => {
    profileMenus.forEach((profileMenu) => {
      if (!profileMenu.contains(event.target)) setProfileMenuOpen(profileMenu, false);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    profileMenus.forEach((profileMenu) => {
      const trigger = profileMenu.querySelector("[data-profile-menu-trigger]");
      if (trigger?.getAttribute("aria-expanded") !== "true") return;
      setProfileMenuOpen(profileMenu, false);
      trigger.focus();
    });
  });
  const profilePage = document.querySelector("[data-profile-page]");
  if (profilePage) {
    const profileState = profilePage.querySelector("[data-profile-state]");
    const profileMenu = document.querySelector("[data-profile-actions]");
    const profileMenuTrigger = profileMenu?.querySelector("[data-profile-menu-trigger]");
    const profileEscape = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
    const readLocal = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
    const asList = (value) => Array.isArray(value) ? value : [];
    const localProfiles = supabaseConfigured ? [] : asList(readLocal("tanimtech-local-profiles", []));
    const localRecommendations = supabaseConfigured ? [] : asList(readLocal("tanimtech-saved-recommendations", []));
    const localCropPlans = supabaseConfigured ? [] : asList(readLocal("tanimtech-crop-plans", []));
    let displayedProfiles = localProfiles;
    let displayedRecommendations = localRecommendations;
    const nameInput = profilePage.querySelector("[data-profile-name]");
    let savedName = localStorage.getItem("tanimtech-profile-name") || "Field planner";
    if (nameInput) nameInput.value = savedName;
    const accountForm = profilePage.querySelector("[data-account-form]");
    const accountUsernameInput = profilePage.querySelector("[data-account-username]");
    const accountEmailInput = profilePage.querySelector("[data-account-email]");
    const accountPasswordInput = profilePage.querySelector("[data-account-password]");
    const accountConfirmInput = profilePage.querySelector("[data-account-confirm]");
    const accountMessage = profilePage.querySelector("[data-account-message]");
    const accountSource = profilePage.querySelector("[data-account-source]");
    let profileSupabaseClient = null;
    let profileSupabaseUser = null;
    const fillAccountFields = (user) => {
      if (accountUsernameInput) accountUsernameInput.value = user.username || user.user_metadata?.username || "";
      if (accountEmailInput) accountEmailInput.value = user.email || "";
    };
    const loadAccountDetails = async () => {
      if (!supabaseConfigured) throw new Error("Supabase Auth is required to manage account details.");
      profileSupabaseClient = await window.tanimtechGetSupabaseClient();
      if (!profileSupabaseClient) throw new Error("Supabase Auth is unavailable.");
      const { data, error } = await profileSupabaseClient.auth.getUser();
      if (error) throw error;
      if (!data.user) throw new Error("No signed-in Supabase user was found. Sign in again.");
      profileSupabaseUser = data.user;
      const { data: profile, error: profileError } = await profileSupabaseClient
        .from("profiles")
        .select("workspace_name")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (profile?.workspace_name) {
        savedName = profile.workspace_name;
        if (nameInput) nameInput.value = savedName;
      }
      fillAccountFields({
        email: data.user.email || "",
        username: data.user.user_metadata?.username || data.user.email?.split("@")[0] || "",
      });
      saveCurrentUser({
        email: data.user.email || "",
        username: data.user.user_metadata?.username || data.user.email?.split("@")[0] || "",
      });
      if (accountSource) accountSource.textContent = "Supabase account. Email changes may require confirmation.";
    };
    loadAccountDetails().catch((error) => {
      if (accountSource) accountSource.textContent = "Account details could not be loaded.";
      showAuthMessage(accountMessage, error.message || "Account details could not be loaded.");
    });
    accountForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = accountUsernameInput?.value.trim() || "";
      const email = accountEmailInput?.value.trim().toLowerCase() || "";
      const password = accountPasswordInput?.value || "";
      const confirmed = accountConfirmInput?.value || "";
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
        showAuthMessage(accountMessage, "Username must be 3–20 letters, numbers, or underscores.");
        return;
      }
      if (!isValidEmailAddress(email)) {
        showAuthMessage(accountMessage, "Enter a valid email address.");
        return;
      }
      if (password && !Object.values(passwordChecks).every((check) => check(password))) {
        showAuthMessage(accountMessage, "Your new password must meet all five password rules.");
        return;
      }
      if (password !== confirmed) {
        showAuthMessage(accountMessage, "The new passwords do not match.");
        return;
      }
      try {
        if (!profileSupabaseClient || !profileSupabaseUser) throw new Error("Account details are still loading. Try again in a moment.");
        const emailChanged = email !== (profileSupabaseUser.email || "").toLowerCase();
        const usernameChanged = username !== (profileSupabaseUser.user_metadata?.username || "").trim();
        const updates = {
          data: { ...(profileSupabaseUser.user_metadata || {}), username },
        };
        if (emailChanged) updates.email = email;
        if (password) updates.password = password;
        const { data, error } = await profileSupabaseClient.auth.updateUser(updates);
        if (error) throw error;
        if (!data.user) throw new Error("Supabase did not return updated account details.");
        profileSupabaseUser = data.user;
        if (usernameChanged) {
          const { error: profileUpdateError } = await profileSupabaseClient
            .from("profiles")
            .update({ username })
            .eq("id", profileSupabaseUser.id);
          if (profileUpdateError) throw profileUpdateError;
        }
        fillAccountFields({
          email: data.user.email || email,
          username: data.user.user_metadata?.username || username,
        });
        saveCurrentUser({
          email: data.user.email || email,
          username: data.user.user_metadata?.username || username,
        });
        showAuthMessage(accountMessage, emailChanged
          ? "Username updated. Check your new email inbox to confirm the email change."
          : "Account details updated.");
        if (accountPasswordInput) accountPasswordInput.value = "";
        if (accountConfirmInput) accountConfirmInput.value = "";
        showToast("Account details saved.");
      } catch (error) {
        const detail = authErrorMessage(error, "Could not save account details.");
        showAuthMessage(accountMessage, detail);
        showToast(detail);
      }
    });
    const pdfSafe = (value) => String(value ?? "").replace(/[^\x20-\x7E]/g, "?").replace(/[\\()]/g, "\\$&");
    const wrapPdf = (value, width = 92) => { const words = String(value ?? "").split(/\s+/); const lines = []; let line = ""; words.forEach((word) => { if ((line + " " + word).trim().length > width) { if (line) lines.push(line); line = word; } else line = (line + " " + word).trim(); }); if (line) lines.push(line); return lines; };
    const downloadReport = (profiles, saved) => {
      const lines = [`TanimTech planting report`, `Profile: ${nameInput?.value || savedName}`, `Generated: ${new Date().toISOString().slice(0, 10)}`, "", "FARM PROFILE HISTORY"];
      if (!profiles.length) lines.push("No saved field profiles.");
      profiles.forEach((item, index) => { lines.push(`${index + 1}. ${item.name || "Field profile"}`); lines.push(`   pH ${item.soilPh ?? "-"} | Temperature ${item.temperature ?? "-"} C | Humidity ${item.humidity ?? "-"}% | Rainfall ${item.rainfall ?? "-"} mm/year`); if (item.soilTexture || item.drainage || item.soilNotes) lines.push(`   Soil: ${item.soilTexture || "-"} | Drainage: ${item.drainage || "-"} | Notes: ${item.soilNotes || "-"}`); });
      lines.push("", "SAVED CROP RECOMMENDATIONS");
      if (!saved.length) lines.push("No saved crop recommendation shortlists.");
      saved.forEach((item, index) => { lines.push(`${index + 1}. ${item.label || "Saved shortlist"} (${(item.createdAt || "").slice(0, 10)})`); (item.results || []).slice(0, 5).forEach((result, resultIndex) => lines.push(`   ${resultIndex + 1}. ${result.name || "Crop"} - fit ${result.fit ?? "-"}/100`)); });
      lines.push("", "Fit is a transparent screening score, not a probability of success or a yield guarantee.");
      const wrapped = lines.flatMap((line) => line ? wrapPdf(line) : [""]); const perPage = 48; const pages = [];
      for (let i = 0; i < wrapped.length; i += perPage) pages.push(wrapped.slice(i, i + perPage));
      const objects = [null, "<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]; const pageIds = [];
      pages.forEach((pageLines) => { const pageId = objects.length; objects.push(""); const contentId = objects.length; objects.push(""); pageIds.push(pageId); objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`; const commands = ["BT", "/F1 11 Tf", "50 760 Td", "14 TL", ...pageLines.map((line, lineIndex) => `${lineIndex ? "T* " : ""}(${pdfSafe(line)}) Tj`), "ET"].join("\n"); objects[contentId] = `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`; });
      objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
      let pdf = "%PDF-1.4\n"; const offsets = [0]; objects.slice(1).forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }); const xref = pdf.length; pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
      const blob = new Blob([pdf], { type: "application/pdf" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${(nameInput?.value || "tanimtech-profile").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-report.pdf`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); showToast("PDF report downloaded.");
    };
    profileMenu?.querySelector("[data-profile-menu-export]")?.addEventListener("click", () => {
      setProfileMenuOpen(profileMenu, false);
      profileMenuTrigger?.focus();
      downloadReport(displayedProfiles, displayedRecommendations);
    });
    profilePage.querySelector("[data-save-profile-name]")?.addEventListener("click", async () => {
      const name = nameInput?.value.trim() || "Field planner";
      try {
        if (supabaseConfigured) {
          const { client, user } = await getAuthenticatedSupabase();
          const { error } = await client.from("profiles").update({ workspace_name: name }).eq("id", user.id);
          if (error) throw error;
          const heading = profileState.querySelector("[data-profile-heading]");
          if (heading) heading.textContent = name;
          showToast("Workspace name saved to your account.");
        } else {
          localStorage.setItem("tanimtech-profile-name", name);
          const heading = profileState.querySelector("[data-profile-heading]");
          if (heading) heading.textContent = name;
          showToast("Profile name saved on this device.");
        }
      } catch (error) {
        showToast(error.message || "The workspace name could not be saved.");
      }
    });
    const renderLocalProfile = (profiles, saved, note = "Saved locally. Clearing browser storage removes this profile and its history.", cropPlans = localCropPlans) => {
      displayedProfiles = asList(profiles);
      displayedRecommendations = asList(saved);
      cropPlans = asList(cropPlans);
      profiles = displayedProfiles;
      saved = displayedRecommendations;
      const profileCards = profiles.length ? profiles.map((item) => `<article class="card p-6"><div class="flex items-center justify-between gap-3"><span class="badge">FIELD PROFILE</span><small class="muted">${profileEscape((item.updatedAt || item.createdAt || "").slice(0, 10))}</small></div><h3 class="serif mt-4 text-2xl">${profileEscape(item.name)}</h3><p class="muted mt-2 text-xs">pH ${profileEscape(item.soilPh)} · ${profileEscape(item.temperature)} °C · ${profileEscape(item.rainfall)} mm/year</p></article>`).join("") : '<div class="notice text-xs">No saved farm profiles yet. Save field conditions from the conditions page to see them here.</div>';
      const recommendationCards = saved.length ? saved.slice(0, 6).map((item) => { const top = item.results?.[0]; return `<article class="card p-6"><div class="flex items-center justify-between gap-3"><span class="badge">SAVED SHORTLIST</span><small class="muted">${profileEscape((item.createdAt || "").slice(0, 10))}</small></div><h3 class="serif mt-4 text-2xl">${profileEscape(item.label)}</h3><p class="muted mt-2 text-xs">${top ? `Closest fit: ${profileEscape(top.name)} · ${top.fit}/100` : "No crop result saved"}</p><div class="mt-4 flex flex-wrap gap-2">${(item.results || []).slice(0, 3).map((result) => `<span class="badge">${profileEscape(result.name)}</span>`).join("")}</div></article>`; }).join("") : '<div class="notice text-xs">No saved recommendation shortlists yet. Generate a shortlist, then choose “Save this shortlist”.</div>';
      const cropPlanCards = cropPlans.length ? cropPlans.map((plan) => `<article class="card p-6"><div class="flex items-center justify-between gap-3"><span class="badge">${profileEscape(plan.source_mode === "image" ? "PHOTO RESULT" : "MANUAL RESULT")}</span><small class="muted">${profileEscape((plan.updated_at || "").slice(0, 10))}</small></div><h3 class="serif mt-4 text-2xl">${profileEscape(plan.crop_name)}</h3><p class="muted mt-2 text-xs">${plan.fit_score === null || plan.fit_score === undefined ? "Soil-reference suggestion" : `Fit score ${profileEscape(plan.fit_score)}/100`}</p><label class="mt-4 block"><span class="field-label">Crop status</span><span class="field-control"><select data-crop-plan-status="${profileEscape(plan.id)}"><option value="planned" ${plan.status === "planned" ? "selected" : ""}>Planned</option><option value="in_progress" ${plan.status === "in_progress" ? "selected" : ""}>In progress</option><option value="completed" ${plan.status === "completed" ? "selected" : ""}>Completed</option><option value="skipped" ${plan.status === "skipped" ? "selected" : ""}>Skipped</option></select></span></label></article>`).join("") : '<div class="notice text-xs">No crops tracked yet. Save a crop from a manual or photo-based result to get started.</div>';
      profileState.innerHTML = `<div class="flex flex-wrap items-start justify-between gap-5"><div><p class="eyebrow">PRIVATE PROFILE</p><h2 class="serif mt-3 text-3xl" data-profile-heading>${profileEscape(nameInput?.value || savedName)}</h2><p class="muted mt-2 text-sm">${supabaseConfigured ? "Your Supabase account" : "This device"}</p></div><span class="badge">${supabaseConfigured ? "PRIVATE ACCOUNT" : "PRIVATE LOCAL SPACE"}</span></div><p class="field-note mt-4">${profileEscape(note)}</p><div class="divider my-7"></div><p class="eyebrow">YOUR FIELD PROFILES</p><h2 class="serif mt-3 text-3xl">Saved field conditions.</h2><div class="mt-5 grid gap-5 md:grid-cols-2">${profileCards}</div><div class="divider my-8"></div><p class="eyebrow">CROP TRACKER</p><h2 class="serif mt-3 text-3xl">Crops in progress.</h2><div class="mt-5 grid gap-5 md:grid-cols-2">${cropPlanCards}</div><div class="divider my-8"></div><p class="eyebrow">YOUR RECOMMENDATION HISTORY</p><h2 class="serif mt-3 text-3xl">Shortlists made for you.</h2><div class="mt-5 grid gap-5 md:grid-cols-2">${recommendationCards}</div><p class="field-note mt-6">Recommendations are screening results based on the inputs saved at the time. They are not forecasts or guarantees.</p>`;
      profileState.querySelectorAll("[data-crop-plan-status]").forEach((select) => {
        select.addEventListener("change", async () => {
          select.disabled = true;
          try {
            await updateCropPlanStatus(select.dataset.cropPlanStatus, select.value);
            showToast("Crop status updated.");
          } catch (error) {
            showToast(error.message || "Crop status could not be updated.");
          } finally {
            select.disabled = false;
          }
        });
      });
    };
    renderLocalProfile(localProfiles, localRecommendations, undefined, localCropPlans);
    if (supabaseConfigured) {
      (async () => {
        const { client, user } = await getAuthenticatedSupabase();
        const [profileResponse, planResponse, runResponse] = await Promise.all([
          client.from("field_profiles").select("id,name,conditions,created_at,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }),
          client.from("crop_plans").select("id,crop_slug,crop_name,status,source_mode,fit_score,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }),
          client.from("recommendation_runs").select("id,input_mode,results,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        ]);
        if (profileResponse.error) throw profileResponse.error;
        if (planResponse.error) throw planResponse.error;
        if (runResponse.error) throw runResponse.error;
        const profiles = (profileResponse.data || []).map((item) => ({
          ...item.conditions,
          id: item.id,
          name: item.name,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        }));
        const recommendations = (runResponse.data || []).map((run) => ({
          id: run.id,
          label: run.input_mode === "image" ? "Photo-based soil result" : "Manual crop recommendation",
          createdAt: run.created_at,
          results: Array.isArray(run.results) ? run.results : [],
        }));
        renderLocalProfile(profiles, recommendations, "Profile data synced securely to your Supabase account.", planResponse.data || []);
      })().catch((error) => {
        showToast(`Your profile data could not be loaded from Supabase: ${error.message}`);
      });
    } else fetch("/api/auth/me").then(readJsonResponse).then(async (authState) => {
      if (!authState.authenticated) return;
      const [profileResponse, savedResponse] = await Promise.all([fetch("/api/profiles"), fetch("/api/recommendations/saved")]);
      const profiles = profileResponse.ok ? (await readJsonResponse(profileResponse)).profiles : localProfiles;
      const saved = savedResponse.ok ? (await readJsonResponse(savedResponse)).recommendations : localRecommendations;
      renderLocalProfile(profiles, saved, "Account data loaded from the TanimTech API.", localCropPlans);
    }).catch(() => { /* Static deployments use the local profile above. */ });
  }
  if (new URLSearchParams(window.location.search).has("results")) {
    showToast("Recommendations loaded from your saved field values.");
  }

  updateSnapshot();
})();

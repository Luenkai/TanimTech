(() => {
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

  const readJsonResponse = async (response) => {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error("This page is running without the TanimTech API. Your local profile is still available.");
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
      const soilDetails = Object.fromEntries(["soilTexture", "drainage", "moisture", "salinity", "organicMatter", "soilNotes"].map((key) => [key, state[key] || ""]));
      form.append("details", JSON.stringify(soilDetails));
      const response = await fetch("/api/soil/analyze", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Soil analysis is unavailable.");
      const analysis = payload.analysis;
      state.soilAnalysis = analysis;
      if (analysis.suggestedSoilType && analysis.suggestedSoilType !== "Unknown") {
        state.soilType = analysis.suggestedSoilType;
        state.soilTexture = analysis.suggestedSoilType;
        state.soilTypeSource = "model-suggested";
      }
      saveState();
      if (soilAnalysisResult) {
        const observations = (analysis.observations || []).map((item) => `<li>${htmlEscape(item)}</li>`).join("");
        const checks = (analysis.recommendedChecks || []).map((item) => `<li>${htmlEscape(item)}</li>`).join("");
        soilAnalysisResult.innerHTML = `<strong>Model suggestion: ${htmlEscape(analysis.suggestedSoilType)} · ${htmlEscape(analysis.confidence)} confidence</strong><p class="mt-2">Visible observations</p><ul class="mt-1 list-disc pl-5">${observations || "<li>No clear visual traits were returned.</li>"}</ul><p class="mt-2">Recommended checks</p><ul class="mt-1 list-disc pl-5">${checks || "<li>Use a representative soil test before relying on this suggestion.</li>"}</ul><p class="mt-3 muted">This suggestion is saved as model-suggested context. Confirm or override it in the field conditions form.</p>`;
      }
      showToast("Soil review complete. Confirm the suggestion before using it.");
    } catch (error) {
      if (soilAnalysisResult) soilAnalysisResult.textContent = error.message;
      showToast(error.message);
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
    const localProfiles = (() => { try { return JSON.parse(localStorage.getItem("tanimtech-local-profiles") || "[]"); } catch { return []; } })();
    localProfiles.unshift({ ...profileData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    localStorage.setItem("tanimtech-local-profiles", JSON.stringify(localProfiles.slice(0, 12)));
    saveProfileButton.disabled = true;
    try {
      const response = await fetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profileData) });
      const payload = await readJsonResponse(response);
      if (response.status === 401) throw new Error("Field profile saved locally on this device.");
      if (!response.ok) throw new Error(payload.errors?.join(" ") || "The field profile could not be saved.");
      showToast("Field profile saved.");
    } catch (error) {
      showToast(error.message.includes("locally") || error.message.includes("without the TanimTech API") ? error.message : "Field profile saved locally on this device.");
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
    const guideMarkup = (result) => `<button class="button mt-4" type="button" data-crop-guide="${escapeHtml(result.slug)}">Open crop guide ↗</button>`;
    const renderGuideDialog = (slug) => { const guide = cropGuides[slug] || cropGuides.pechay; const existing = document.querySelector("[data-guide-dialog]"); existing?.remove(); const dialog = document.createElement("div"); dialog.setAttribute("data-guide-dialog", "true"); dialog.innerHTML = `<div style="position:fixed;inset:0;background:rgb(23 75 58 / 30%);z-index:100;display:grid;place-items:center;padding:20px"><section class="card" style="max-width:520px;padding:28px;box-shadow:0 18px 50px rgb(23 75 58 / 20%)" role="dialog" aria-modal="true"><p class="eyebrow">FIELD GUIDE / ${escapeHtml(slug)}</p><h2 class="serif mt-3 text-3xl">${escapeHtml(guide.title)}</h2><p class="muted mt-4 text-sm">${escapeHtml(guide.body)}</p><div class="notice mt-5 text-xs">Use the guide to frame the next field check. It does not replace local advice, soil testing, or a validated yield forecast.</div><button class="button button-primary mt-6" type="button" data-close-guide>Close guide</button></section></div>`; document.body.append(dialog); dialog.querySelector("[data-close-guide]").addEventListener("click", () => dialog.remove()); dialog.firstElementChild.addEventListener("click", (event) => { if (event.target === dialog.firstElementChild) dialog.remove(); }); };
    const renderRecommendations = (payload, mode = "API CONNECTED") => {
      currentResults = Array.isArray(payload.results) ? [...payload.results] : [];
      if (sortMode === "name") currentResults.sort((a, b) => a.name.localeCompare(b.name)); else currentResults.sort((a, b) => b.fit - a.fit);
      if (!currentResults.length) { recommendationPage.innerHTML = '<section class="warning mt-8"><strong>No crops matched the selected filters.</strong><p class="muted mt-2 text-xs">Return to your conditions and broaden the category or life-form filters.</p></section>'; return; }
      const first = currentResults[0];
      const evidenceCount = currentResults.filter((result) => result.dataEvidence?.available).length;
      const shownCount = conditions.catalog === "extended" ? 6 : 3;
      const cards = currentResults.slice(0, shownCount).map((result, index) => `<article class="card overflow-hidden"><img class="h-52 w-full object-cover" src="images/${escapeHtml(cropImage[result.slug] || "hero-farm.jpg")}" alt="${escapeHtml(result.name)}"><div class="p-6"><div class="flex items-center justify-between"><span class="badge" ${index ? 'style="background:#edf0e9"' : ""}>${index ? "ALTERNATIVE" : "CLOSEST FIT"}</span><small class="muted">${result.growingDays ? result.growingDays[0] : result.days[0]}–${result.growingDays ? result.growingDays[1] : result.days[1]} days</small></div><div class="mt-3 flex items-center justify-between"><h2 class="serif text-3xl">${escapeHtml(result.name)}</h2><span class="serif text-3xl">${result.fit}</span></div><p class="muted text-xs">Fit / 100 · not a probability of success</p><div class="score-line my-4"><span style="width:${result.fit}%"></span></div><p class="eyebrow">WHY IT APPEARS</p><p class="mt-2 text-xs">${escapeHtml(result.whyItAppears)}</p><p class="eyebrow mt-4">WHAT TO CHECK</p><p class="mt-2 text-xs">${escapeHtml(result.whatToCheck)}</p><span class="badge mt-4">${result.dataEvidence?.available ? "CLEANED KAGGLE PROFILE" : "ECOCROP REQUIREMENTS"}</span>${result.scientific && result.source === "extended" ? `<p class="muted mt-3 text-xs"><i>${escapeHtml(result.scientific)}</i> · ${escapeHtml(result.category)} · ${escapeHtml(result.lifeForm)}</p>` : ""}${result.soilMatch?.status && result.soilMatch.status !== "unknown" ? `<p class="muted mt-3 text-xs">Soil reference: <b>${escapeHtml(result.soilMatch.status)}</b> for ${escapeHtml(result.soilMatch.label)} texture.</p>` : ""}${evidenceMarkup(result)}${guideMarkup(result)}</div></article>`).join("");
      const breakdown = (first.breakdown || []).map((item) => `<div class="mini-row"><b>${escapeHtml(item.label)}<br><small class="muted font-normal">${item.value}</small></b><span>${formatBand(item.band)}<br><small class="muted">Reference band</small></span><span class="badge">${item.points} / ${item.maxPoints}</span></div>`).join("");
      const saved = localStorage.getItem("tanimtech-saved-shortlist") === "true";
      recommendationPage.innerHTML = `<p class="eyebrow">CROP PLANNING / ${mode === "API CONNECTED" ? "API SHORTLIST" : "LOCAL CALCULATION"}</p><div class="flex flex-wrap items-end justify-between gap-5"><div><h1 class="section-heading mt-3">Crops worth a closer look.</h1><p class="muted mt-3">${mode === "API CONNECTED" ? "Live fit scores from the recommendation API." : "Fit scores calculated from your entries while the API is unavailable."}</p></div><a class="button button-primary" href="conditions.html">Edit conditions ↗</a></div><div class="notice mt-6 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5"><span>pH ${conditions.soilPh}</span><span>${conditions.temperature} °C mean</span><span>${conditions.humidity}% RH</span><span>${conditions.rainfall} mm / year</span><span>${escapeHtml(conditions.planningMonth)} <span class="badge ml-2">${mode === "API CONNECTED" ? "API RESULTS" : "LOCAL RESULTS"}</span></span></div><div class="mt-6 flex flex-wrap items-center justify-between gap-4"><p class="muted text-xs">${currentResults.length} matches${conditions.catalog === "extended" ? " from the extended edible catalog" : ""} · ${evidenceCount} backed by cleaned Kaggle profiles · ${escapeHtml(conditions.region)}</p><div class="flex flex-wrap gap-3"><button class="field-control min-h-10 text-xs" type="button" data-sort-results>Sort: ${sortMode === "fit" ? "highest fit" : "crop name"} ↕</button><button class="button button-primary" type="button" data-scroll-compare>Compare top ${shownCount} ↗</button></div></div><div class="mt-6 grid gap-5 lg:grid-cols-3">${cards}</div><p class="muted mt-4 text-xs">${escapeHtml(payload.note || "Fit is a transparent screening score, not a yield prediction.")} Cleaned Kaggle profiles are evidence context; they do not turn fit into a forecast.</p><div id="compare" class="mt-10 grid items-start gap-6 lg:grid-cols-[2fr_1fr]"><section class="card p-7"><p class="eyebrow">EXPLAIN THE FIT / ${first.fit} OF 100</p><h2 class="serif mt-3">Why ${escapeHtml(first.name)} ranks first</h2><p class="muted mt-3">The recommendation engine keeps the four weighted core factors visible. Add-on context provides guidance and never adds score points.</p><div class="mt-5">${breakdown}</div><p class="muted mt-4 text-xs">${escapeHtml(first.dataEvidence?.source || "FAO ECOCROP requirement bands")}</p></section><aside class="card p-7"><p class="eyebrow">FIT ≠ CERTAINTY</p><h2 class="serif mt-3 text-3xl">What the score can’t tell you</h2><div class="mt-4"><div class="mini-row"><span class="muted">Input completeness</span><b>4 / 4 core values<br><small class="muted font-normal">Entered, not independently verified</small></b></div><div class="mini-row"><span class="muted">Field blind spots</span><b>Drainage · pests · seed quality<br><small class="muted font-normal">Not included in the score</small></b></div></div><div class="warning mt-5"><strong class="text-xs">⚠ Seasonal risk stays visible</strong><p class="muted mt-2 text-xs">A high fit score must not override current local advisories.</p></div></aside></div><section class="mt-8 flex flex-wrap items-center justify-between gap-6 rounded bg-forest px-8 py-7 text-white"><div><h2 class="serif text-2xl">Take the shortlist back to the field.</h2><p class="mt-2 text-sm text-white/75">Save this shortlist on your device, then verify drainage and local conditions before planting at scale.</p></div><button class="button" type="button" data-save-shortlist>${saved ? "Saved on this device ✓" : "Save this shortlist ↗"}</button></section>`;
      recommendationPage.querySelector("[data-sort-results]").addEventListener("click", () => { sortMode = sortMode === "fit" ? "name" : "fit"; renderRecommendations(payload, mode); });
      recommendationPage.querySelector("[data-scroll-compare]").addEventListener("click", () => document.querySelector("#compare")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      recommendationPage.querySelector("[data-save-shortlist]").addEventListener("click", async (event) => {
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
      recommendationPage.querySelectorAll("[data-crop-guide]").forEach((button) => button.addEventListener("click", () => renderGuideDialog(button.dataset.cropGuide)));
    };
    fetch("/api/recommendations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(conditions) })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Recommendation API unavailable")))
      .then((payload) => renderRecommendations(payload, "API CONNECTED"))
      .catch(() => { renderRecommendations({ results: localRecommend(), note: "The API is unavailable on this static deployment; the same transparent ECOCROP screening calculation is running locally." }, "LOCAL CALCULATION"); });
  }

  const loginPage = document.querySelector("[data-login-page]");
  if (loginPage) {
    loginPage.querySelector("[data-login-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const username = loginPage.querySelector("[data-login-username]")?.value.trim();
      const password = loginPage.querySelector("[data-login-password]")?.value;
      const message = loginPage.querySelector("[data-login-message]");
      if (username === "admin" && password === "TanimTech2026!") {
        localStorage.setItem("tanimtech-login-session", "true");
        const requested = new URLSearchParams(window.location.search).get("next") || "index.html";
        const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "index.html";
        window.location.href = next;
        return;
      }
      if (message) message.textContent = "That demo username or password is incorrect.";
      showToast("Incorrect demo credentials.");
    });
  }

  const profilePage = document.querySelector("[data-profile-page]");
  if (profilePage) {
    const profileState = profilePage.querySelector("[data-profile-state]");
    const profileEscape = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
    const readLocal = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
    const localProfiles = readLocal("tanimtech-local-profiles", []);
    const localRecommendations = readLocal("tanimtech-saved-recommendations", []);
    const nameInput = profilePage.querySelector("[data-profile-name]");
    const savedName = localStorage.getItem("tanimtech-profile-name") || "Field planner";
    if (nameInput) nameInput.value = savedName;
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
      const blob = new Blob([pdf], { type: "application/pdf" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${(nameInput?.value || "tanimtech-profile").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-report.pdf`; link.click(); URL.revokeObjectURL(url); showToast("PDF report downloaded.");
    };
    profilePage.querySelector("[data-save-profile-name]")?.addEventListener("click", () => {
      const name = nameInput?.value.trim() || "Field planner";
      localStorage.setItem("tanimtech-profile-name", name);
      showToast("Profile name saved on this device.");
    });
    const renderLocalProfile = (profiles, saved, note = "Saved locally. Clearing browser storage removes this profile and its history.") => {
      const profileCards = profiles.length ? profiles.map((item) => `<article class="card p-6"><div class="flex items-center justify-between gap-3"><span class="badge">FIELD PROFILE</span><small class="muted">${profileEscape((item.updatedAt || item.createdAt || "").slice(0, 10))}</small></div><h3 class="serif mt-4 text-2xl">${profileEscape(item.name)}</h3><p class="muted mt-2 text-xs">pH ${profileEscape(item.soilPh)} · ${profileEscape(item.temperature)} °C · ${profileEscape(item.rainfall)} mm/year</p></article>`).join("") : '<div class="notice text-xs">No saved farm profiles yet. Save field conditions from the conditions page to see them here.</div>';
      const recommendationCards = saved.length ? saved.slice(0, 6).map((item) => { const top = item.results?.[0]; return `<article class="card p-6"><div class="flex items-center justify-between gap-3"><span class="badge">SAVED SHORTLIST</span><small class="muted">${profileEscape((item.createdAt || "").slice(0, 10))}</small></div><h3 class="serif mt-4 text-2xl">${profileEscape(item.label)}</h3><p class="muted mt-2 text-xs">${top ? `Closest fit: ${profileEscape(top.name)} · ${top.fit}/100` : "No crop result saved"}</p><div class="mt-4 flex flex-wrap gap-2">${(item.results || []).slice(0, 3).map((result) => `<span class="badge">${profileEscape(result.name)}</span>`).join("")}</div></article>`; }).join("") : '<div class="notice text-xs">No saved recommendation shortlists yet. Generate a shortlist, then choose “Save this shortlist”.</div>';
      profileState.innerHTML = `<div class="flex flex-wrap items-start justify-between gap-5"><div><p class="eyebrow">LOCAL PROFILE</p><h2 class="serif mt-3 text-3xl">${profileEscape(nameInput?.value || savedName)}</h2><p class="muted mt-2 text-sm">This device</p></div><span class="flex flex-wrap items-center gap-3"><span class="badge">PRIVATE LOCAL SPACE</span><button class="button" type="button" data-export-report>Download PDF report</button><button class="button" type="button" data-local-logout>Sign out</button></span></div><p class="field-note mt-4">${profileEscape(note)}</p><div class="divider my-7"></div><p class="eyebrow">YOUR FARM PROFILES</p><h2 class="serif mt-3 text-3xl">Saved field conditions.</h2><div class="mt-5 grid gap-5 md:grid-cols-2">${profileCards}</div><div class="divider my-8"></div><p class="eyebrow">YOUR RECOMMENDATION HISTORY</p><h2 class="serif mt-3 text-3xl">Shortlists made for you.</h2><div class="mt-5 grid gap-5 md:grid-cols-2">${recommendationCards}</div><p class="field-note mt-6">Recommendations are screening results based on the inputs saved at the time. They are not forecasts or guarantees.</p>`;
      profileState.querySelector("[data-export-report]")?.addEventListener("click", () => downloadReport(profiles, saved));
      profileState.querySelector("[data-local-logout]")?.addEventListener("click", () => window.tanimtechAuth?.signOut());
    };
    renderLocalProfile(localProfiles, localRecommendations);
    fetch("/api/auth/me").then(readJsonResponse).then(async (authState) => {
      if (!authState.authenticated) return;
      const [profileResponse, savedResponse] = await Promise.all([fetch("/api/profiles"), fetch("/api/recommendations/saved")]);
      const profiles = profileResponse.ok ? (await readJsonResponse(profileResponse)).profiles : localProfiles;
      const saved = savedResponse.ok ? (await readJsonResponse(savedResponse)).recommendations : localRecommendations;
      renderLocalProfile(profiles, saved, "Account data loaded from the TanimTech API.");
    }).catch(() => { /* Static deployments use the local profile above. */ });
  }
  if (new URLSearchParams(window.location.search).has("results")) {
    showToast("Recommendations loaded from your saved field values.");
  }

  updateSnapshot();
})();

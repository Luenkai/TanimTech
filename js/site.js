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

  if (new URLSearchParams(window.location.search).has("demo-results")) {
    showToast("Personalized crop scoring is under development. These are illustrative demo results.");
  }

  updateSnapshot();
})();

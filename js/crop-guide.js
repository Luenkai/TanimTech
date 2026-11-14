(() => {
  const page = document.querySelector("[data-crop-guide-page]");
  if (!page) return;

  const select = page.querySelector("[data-crop-select]");
  const status = page.querySelector("[data-crop-guide-status]");
  const errorPanel = page.querySelector("[data-crop-guide-error]");
  const errorMessage = page.querySelector("[data-crop-guide-error-message]");
  const content = page.querySelector("[data-crop-guide-content]");
  const image = page.querySelector("[data-crop-guide-image]");
  const imageNote = page.querySelector("[data-crop-guide-image-note]");
  const cropImages = {
    pechay: { file: "pechay-detail.jpg", label: "Crop photo" },
    kangkong: { file: "kangkong.jpg", label: "Crop photo" },
    mongo: { file: "mongo.jpg", label: "Crop photo" },
    sitaw: { file: "sitaw-guide.svg", label: "Crop illustration" },
    talong: { file: "talong-guide.svg", label: "Crop illustration" },
    kamote: { file: "kamote-guide.svg", label: "Crop illustration" },
    mais: { file: "mais-guide.svg", label: "Crop illustration" },
  };
  let crops = [];
  let cropDataSource = "API";

  const setText = (selector, value) => {
    const element = page.querySelector(selector);
    if (element) element.textContent = value || "Not available in dataset";
  };
  const formatRange = (range, unit = "") => {
    if (!Array.isArray(range) || range.length < 2 || range.some((value) => value === null || value === "")) return "Not available in dataset";
    return `${range[0]}–${range[1]}${unit}`;
  };
  const formatMonths = (months) => {
    if (!Array.isArray(months) || !months.length) return "Not available in dataset";
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map((month) => names[month - 1] || month).join(", ");
  };
  const showError = (message) => {
    status.textContent = "";
    errorMessage.textContent = message;
    errorPanel.classList.remove("hidden");
    content.classList.add("hidden");
  };
  const renderCrop = (crop) => {
    if (!crop) {
      showError("That crop was not found. Choose one of the available crops from the list.");
      return;
    }

    setText("[data-crop-category]", crop.category);
    setText("[data-crop-name]", crop.name);
    setText("[data-crop-scientific]", crop.scientific);
    setText("[data-crop-summary]", crop.summary);
    setText("[data-crop-life-form]", crop.lifeForm);
    setText("[data-crop-days]", formatRange(crop.growingDays, " days"));
    setText("[data-crop-best-months]", formatMonths(crop.bestMonths));
    setText("[data-crop-ph]", formatRange(crop.bands?.soilPh));
    setText("[data-crop-temperature]", formatRange(crop.bands?.temperature, " °C"));
    setText("[data-crop-rainfall]", formatRange(crop.bands?.rainfall, " mm/year"));
    setText("[data-crop-humidity]", formatRange(crop.bands?.humidity, "%"));
    setText("[data-crop-flood-note]", crop.floodNote);
    setText("[data-crop-typhoon-note]", crop.typhoonNote);
    setText("[data-crop-source]", crop.dataSource);

    const cropImage = cropImages[crop.slug];
    image.src = `images/${cropImage?.file || "hero-farm.jpg"}`;
    image.alt = cropImage ? `${crop.name} ${cropImage.label.toLowerCase()}` : `Field overview; crop-specific image unavailable for ${crop.name}`;
    imageNote.textContent = cropImage?.label || "Field overview · crop-specific image unavailable";
    select.value = crop.slug;
    errorPanel.classList.add("hidden");
    content.classList.remove("hidden");
    status.textContent = `${crop.name} · ${crops.length} crop profiles · ${cropDataSource}`;
    const url = new URL(window.location.href);
    url.searchParams.set("crop", crop.slug);
    window.history.replaceState(null, "", url);
  };

  const loadCrops = async () => {
    select.disabled = true;
    status.textContent = "Loading crop profiles…";
    errorPanel.classList.add("hidden");
    try {
      let localDataError;
      try {
        const response = await fetch("js/crop-guide-data.json");
        if (!response.ok) throw new Error(`Local crop data returned HTTP ${response.status}.`);
        const payload = await response.json();
        if (!Array.isArray(payload.crops) || !payload.crops.length) throw new Error("Local crop data has no profiles.");
        crops = payload.crops;
        cropDataSource = "local dataset";
      } catch (error) {
        localDataError = error;
      }
      if (!crops.length) {
        try {
          const response = await fetch("/api/crops");
          if (!response.ok) throw new Error(`Crop API returned HTTP ${response.status}.`);
          const payload = await response.json();
          if (!Array.isArray(payload.crops) || !payload.crops.length) throw new Error("Crop API returned no profiles.");
          crops = payload.crops;
          cropDataSource = "API";
        } catch (fallbackError) {
          throw new Error(`Crop data could not be loaded from local dataset (${localDataError.message}) or API (${fallbackError.message}).`);
        }
      }
      select.replaceChildren(new Option("Choose a crop", ""));
      crops.forEach((crop) => select.add(new Option(crop.name, crop.slug)));
      select.disabled = false;

      const requestedSlug = new URLSearchParams(window.location.search).get("crop");
      const requestedCrop = requestedSlug ? crops.find((crop) => crop.slug === requestedSlug) : crops[0];
      if (requestedSlug && !requestedCrop) {
        select.value = "";
        showError(`No crop matches “${requestedSlug}”. Choose a crop from the list.`);
        return;
      }
      renderCrop(requestedCrop);
    } catch (error) {
      showError(error.message || "Crop data could not be loaded from the API or local dataset.");
    }
  };

  select.addEventListener("change", () => {
    const crop = crops.find((item) => item.slug === select.value);
    if (crop) renderCrop(crop);
  });
  page.querySelector("[data-crop-guide-retry]").addEventListener("click", loadCrops);
  loadCrops();
})();

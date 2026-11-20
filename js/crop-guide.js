(() => {
  const page = document.querySelector("[data-crop-guide-page]");
  if (!page) return;
  const select = page.querySelector("[data-crop-select]");
  const status = page.querySelector("[data-crop-guide-status]");
  const errorPanel = page.querySelector("[data-crop-guide-error]");
  const errorMessage = page.querySelector("[data-crop-guide-error-message]");
  const content = page.querySelector("[data-crop-guide-content]");
  const image = page.querySelector("[data-crop-guide-image]");
  const imageCreator = page.querySelector("[data-crop-guide-image-creator]");
  const imageLicense = page.querySelector("[data-crop-guide-image-license]");
  const imageSource = page.querySelector("[data-crop-guide-image-source]");
  let crops = [];
  let cropImages = {};
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
  const stripMarkup = (value) => String(value || "").replace(/<[^>]*>/g, "").trim();
  const range = (low, high) => (low === null || low === undefined || high === null || high === undefined ? null : [low, high]);
  const asGuideCrop = (plant) => {
    const isApiShape = Array.isArray(plant.bands);
    return {
      slug: plant.id || plant.slug,
      name: stripMarkup(plant.name),
      scientific: stripMarkup(plant.scientific),
      category: plant.category || plant.edibleGroup || plant.edible_group,
      lifeForm: plant.lifeForm || plant.life_form,
      summary: stripMarkup(plant.summary) || `${stripMarkup(plant.name)} edible-plant profile from the FAO ECOCROP catalog.`,
      growingDays: isApiShape ? plant.growingDays : range(plant.days_min, plant.days_max),
      bands: isApiShape ? plant.bands : {
        soilPh: range(plant.ph_min, plant.ph_max),
        temperature: range(plant.temp_min, plant.temp_max),
        rainfall: range(plant.rain_min, plant.rain_max),
        humidity: range(plant.humidity_min, plant.humidity_max),
      },
      bestMonths: plant.bestMonths || plant.best_months || [],
      floodNote: plant.notes?.flood || plant.flood_note || "Check local drainage and flood exposure before planting.",
      typhoonNote: plant.notes?.typhoon || plant.typhoon_note || "Check local storm advisories and provide support where needed.",
      dataSource: plant.dataSource || plant.data_source || "FAO ECOCROP edible-plant catalog",
    };
  };
  const renderCrop = (crop) => {
    if (!crop) {
      showError("That crop was not found. Choose one of the available crops from the list.");
      return;
    }
    const cropImage = cropImages[crop.slug];
    if (!cropImage) {
      showError(`No photo credit is configured for ${crop.name}.`);
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
    select.value = crop.slug;
    image.dataset.cropSlug = crop.slug;
    image.alt = `${cropImage.type === "illustration" ? "Illustration" : "Photograph"} of ${crop.name} (${crop.scientific})`;
    imageCreator.textContent = `${cropImage.type === "illustration" ? "Illustration" : "Photo"}: ${cropImage.creator}`;
    imageLicense.textContent = cropImage.license;
    if (cropImage.licenseUrl) imageLicense.href = cropImage.licenseUrl;
    else imageLicense.removeAttribute("href");
    imageSource.href = cropImage.sourceUrl;
    image.src = cropImage.src;
    errorPanel.classList.add("hidden");
    content.classList.remove("hidden");
    status.textContent = `${crop.name} · ${crops.length} Philippine edible crop profiles · ${cropDataSource}`;
    const url = new URL(window.location.href);
    url.searchParams.set("crop", crop.slug);
    window.history.replaceState(null, "", url);
  };
  const loadPlantCatalog = async () => {
    const firstResponse = await fetch("/api/plants/search?source=ecocrop&page=1&limit=100");
    if (!firstResponse.ok) throw new Error(`Plant API returned HTTP ${firstResponse.status}.`);
    const first = await firstResponse.json();
    if (!Array.isArray(first.plants) || !first.plants.length) throw new Error("Plant API returned no edible profiles.");
    const total = Number(first.count || first.plants.length);
    const pageCount = Math.ceil(total / 100);
    const remaining = await Promise.all(Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
      fetch(`/api/plants/search?source=ecocrop&page=${index + 2}&limit=100`).then((response) => {
        if (!response.ok) throw new Error(`Plant API page ${index + 2} returned HTTP ${response.status}.`);
        return response.json();
      })
    ));
    crops = [first, ...remaining].flatMap((payload) => (payload.plants || []).map(asGuideCrop));
    cropDataSource = "ECOCROP edible catalog API";
  };
  const loadCrops = async () => {
    select.disabled = true;
    status.textContent = "Loading Philippine edible crop profiles…";
    errorPanel.classList.add("hidden");
    try {
      const [response, imageCreditsResponse] = await Promise.all([
        fetch("js/philippine-edible-catalog.json"),
        fetch("js/crop-image-credits.json?v=4"),
      ]);
      if (!response.ok) throw new Error(`Philippine crop dataset returned HTTP ${response.status}.`);
      if (!imageCreditsResponse.ok) throw new Error(`Crop image credits returned HTTP ${imageCreditsResponse.status}.`);
      const payload = await response.json();
      if (!Array.isArray(payload.crops) || !payload.crops.length) throw new Error("The Philippine crop dataset has no profiles.");
      const imageCredits = await imageCreditsResponse.json();
      const missingImageCredits = payload.crops.find((crop) => !imageCredits[crop.slug]?.src || !imageCredits[crop.slug]?.creator || !imageCredits[crop.slug]?.license || !imageCredits[crop.slug]?.sourceUrl);
      if (missingImageCredits) throw new Error(`The photo or attribution for ${missingImageCredits.name} is incomplete.`);
      crops = payload.crops;
      cropImages = imageCredits;
      cropDataSource = "Philippine edible crop dataset";
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
  image.addEventListener("error", () => {
    const failedCrop = crops.find((crop) => crop.slug === image.dataset.cropSlug);
    if (failedCrop && failedCrop.slug === select.value) showError(`The photo for ${failedCrop.name} could not be loaded.`);
  });
  select.addEventListener("change", () => {
    const crop = crops.find((item) => item.slug === select.value);
    if (crop) renderCrop(crop);
  });
  page.querySelector("[data-crop-guide-retry]").addEventListener("click", loadCrops);
  loadCrops();
})();

# TanimTech data sources

The recommendation flow no longer seeds a farm with illustrative measurements. Users enter a measured soil pH and can load climate values for a representative coordinate from the NASA POWER Climatology API.

## Crop requirements

The committed profile file at `backend/data_pipeline/clean/crops_clean.json` is a seven-crop subset derived from the FAO ECOCROP export maintained by OpenCLIM. Each record preserves the ECOCROP EcoPort code and requirement fields for optimal temperature, annual rainfall, soil pH, and crop cycle. The selected crops are pechay/Chinese cabbage, kangkong/water spinach, mongo/green gram, sitaw/yard-long bean, talong/eggplant, kamote/sweet potato, and mais/maize.

Source: [FAO ECOCROP](https://gaez.fao.org/pages/ecocrop), using the [OpenCLIM EcoCrop DB export](https://github.com/OpenCLIM/ecocrop/blob/ea43ecd418fd1a1ea08d32c7dce64b7fae02dec4/EcoCrop_DB.csv). ECOCROP thresholds are expert estimates and are not validated field or trial results.

## Climate inputs

The conditions page calls NASA POWER’s `temporal/climatology/point` endpoint with `T2M`, `RH2M`, and `PRECTOTCORR`. The endpoint reports January 2001–December 2025 climatology in the current response. Temperature and humidity use the selected month. Precipitation is converted from NASA POWER’s daily millimetre value to an annual millimetre total because ECOCROP records rainfall requirements as annual totals.

Source: [NASA POWER API documentation](https://power.larc.nasa.gov/docs/services/api/).

## Local verification

TanimTech does not infer soil chemistry from a photo. For Philippine verification, users should consult the [DA-PhilRice Soil Information System](https://www.philrice.gov.ph/philippine-soils-online-data-treasury/), a representative soil test, current PAGASA advisories, and PSA OpenSTAT production statistics where relevant.

## Scoring scope

The fit score uses soil pH, temperature, and annual rainfall. Relative humidity is displayed as climate context but receives zero score weight because the committed ECOCROP records do not provide a comparable humidity requirement. Drainage, pests, seed quality, market demand, and local advisories remain field checks rather than model outputs.

## Soil reference dataset and image review

`backend/data/soil_profiles.json` is a committed advisory dataset covering clay, loam, sandy, silty, and peaty/organic-rich textures. It records broad pH, organic-matter, salinity, and drainage guidance plus crop-level suitability labels. It is used only as a transparent soil-context ranking signal; it does not add points to the core fit score and is not a laboratory classification. The API and browser use the canonical labels Clay, Loam, Sandy, Silty, Peaty, and Unknown for the handoff.

`POST /api/soil/analyze` accepts a JPG, PNG, or WebP image up to 10 MB only when the request includes explicit consent and the user requests model review. The backend forwards it to the configured OpenAI-compatible vision model and asks for cautious observations, a tentative visible-texture suggestion, limitations, and recommended checks. This cannot establish texture, pH, nutrients, drainage, organic matter, or chemistry as a soil test would. Set `OPENAI_API_KEY` (or `OPENAI_API_TOKEN`) on the backend; optionally set `OPENAI_API_BASE` with or without `/v1` or `/chat/completions`, `SOIL_VISION_MODEL`, and `SOIL_REASONING`. If the service is not configured, users can continue with manual soil details and the recommendation API remains available.

The suggested texture becomes advisory context only. It does not alter the displayed climate/pH fit score. For core crops, the API uses `cropSuitability` in `backend/data/soil_profiles.json` as a secondary ordering signal; the local browser fallback uses the same table. Extended-catalog crops use ECOCROP texture/drainage requirement fields. These matches are broad screening guidance, not locally validated crop prescriptions.

## Extended edible plant catalog

`backend/data/edible_catalog.json` holds the 719 edible plants from the full FAO ECOCROP database (OpenCLIM export) that have complete pH, temperature, rainfall and crop-cycle bands. Edible means ECOCROP files the plant under fruits & nuts, vegetables, roots/tubers, pulses or cereals; forage, timber, ornamental, weed and medicinal-only species are excluded. Bands use the optimum range, falling back to the absolute range. A few entries are borderline edibles that ECOCROP classes as fruit or nut crops (for example rain tree pods), so review before recommending an unfamiliar plant. Rebuild with `python -m data_pipeline.build_edible_catalog`.

## Trefle plant API (optional)

[Trefle](https://trefle.io) adds species, common names, photos and edible parts when `TREFLE_TOKEN` is set. Its growth fields are incomplete and give tolerance limits, so Trefle plants are only scored through a matching ECOCROP record.

## SoilGrids soil lookup

`GET /api/soil/lookup` uses the [ISRIC SoilGrids 2.0 REST API](https://rest.isric.org/soilgrids/v2.0/docs) (clay, sand, silt, pH in water, organic carbon, CEC, nitrogen; 0–30 cm thickness-weighted mean). It is a modelled 250 m prediction, not a laboratory measurement, and pH is only copied into the form when the user clicks to accept it.

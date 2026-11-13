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

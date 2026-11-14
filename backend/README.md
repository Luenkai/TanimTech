# TanimTech Backend (Python + Flask, no database yet)

Data is kept in memory and saved to `storage/store.json`. No XAMPP or MySQL needed.

## Run
```
cd backend
python -m venv .venv
.venv\Scripts\activate          (Mac/Linux: source .venv/bin/activate)
pip install -r requirements.txt
python app.py                   # http://localhost:3000  (also serves your website pages)
python -m unittest -v           # run the tests
```

## Screens -> endpoints
| Figma screen | Endpoint |
|---|---|
| 2 Farm overview | `GET /api/profiles/<id>/overview` |
| 3 Growing conditions / 7 Recommendations | `POST /api/recommendations` |
| 4-6 Soil photo / soil type | `GET /api/soil/dataset`, `POST /api/soil/analyze` (opt-in image review); send soil type as `soilType` (+ `soilTypeSource`) |
| 8 Crop details | `GET /api/crops/<slug>` |
| 9 Crop explorer | `GET /api/crops?q=&category=&lifeForm=&maxDays=&sort=name\|days` |
| 10 Crop comparison | `POST /api/compare` `{ "slugs": ["pechay","kangkong"], ...conditions }` |
| 11 Planting calendar | `GET /api/calendar?crops=pechay,mais`, `POST /api/calendar` (12 monthly climate values), `GET /api/profiles/<id>/calendar` |
| 12 Saved farm profiles | `GET/POST /api/profiles`, `GET/PUT/DELETE /api/profiles/<id>`, `GET/POST /api/profiles/<id>/shortlists` |
| 13 Methodology | `GET /api/methodology` |

Example `POST /api/recommendations`:
```json
{ "soilPh": 6.4, "temperature": 27, "humidity": 78, "rainfall": 101, "soilType": "Loam", "soilTexture": "Loam", "drainage": "Well-drained", "organicMatter": 3.5, "soilTypeSource": "manual", "season": "Wet season" }
```

## Adding the database later
Only `tanimtech/store.py` touches storage. Re-write its `Crops`, `Profiles` and `Shortlists`
methods with SQL (same method names and return shapes). Nothing else changes.

## Cleaned Kaggle data integration
The `kaggle-data-cleaning` branch is merged into this integration branch. Its committed cleaned
outputs live in `data_pipeline/clean/`, including the crop-soil and yield-condition profile CSVs.
Run `python -m data_pipeline.clean_kaggle` after replacing the raw inputs to regenerate them.

`POST /api/recommendations` includes `dataEvidence` for every crop and identifies the matching
cleaned Kaggle profile. `GET /api/recommendations/data-status` reports which profile artifacts
are available. The four-factor fit score remains transparent and the cleaned data is shown as evidence,
not converted into a false confidence estimate.

## Accounts and saved planning work

The profile workspace uses Manus OAuth. Configure `MANUS_PROJECT_ID`, `MANUS_OAUTH_PORTAL_URL`,
`MANUS_OAUTH_API_URL`, and `MANUS_JWT_SECRET` in the deployment environment. The application session
uses the reserved-compatible `webdev_app_session` cookie name and protects farm profiles and saved
recommendation history by user. `GET /api/auth/me` reports the current account, while
`GET/POST /api/recommendations/saved` stores and retrieves crop shortlists for that account.

The frontend recommendations page posts the saved condition inputs to the API and displays the live
fit breakdown plus a cleaned-data badge. If the API is unavailable, the original static preview
remains visible.

## JSON in this project
- Storage: `storage/store.json` (profiles + shortlists), created on first save.
- Data pipeline: every cleaned table is written as both `.csv` (for MySQL) and `.json` in `data_pipeline/clean/`.
- Crops: if `data_pipeline/clean/crops_clean.json` exists, the API uses it instead of the demo crops
  (`isDemoData` becomes `false`). Delete the file to go back to the demo data. Override the path with `TANIM_CROPS_FILE`.
- `sample_requests/*.json`: example request bodies, e.g.
  `curl -X POST localhost:3000/api/recommendations -H "Content-Type: application/json" -d @sample_requests/recommendations.json`

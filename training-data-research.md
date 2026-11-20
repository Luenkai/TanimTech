# Soil-photo classifier: binary research prototype

**Status (20 November 2026):** A standalone soil-versus-non-soil research prototype has been trained and evaluated. It is not connected to the live `POST /api/soil/analyze` route and is not production-validated. Its only labels are `soil` and `non_soil`; it does not predict clay, loam, sandy, or silty texture. The earlier photo-screening correction remains in `main` as commit `17496e7`.

## Data collected and reviewed

The positive class uses 136 close-range soil images from 26 physical samples in the Zenodo dataset. The source includes repeated views of the same samples, captured in a controlled laboratory setup, so all images from each physical sample were kept together during validation. It contains no non-soil photos.[1] [2]

The negative class contains 44 visually reviewed Openverse images from five broad searches: bottles, portraits, buildings, food, and rocks. The selected records are CC BY 2.0 or CC0 1.0; their creator, attribution, source URL, and license metadata were retained in the local manifest.[3] [4] [5] A separate CC BY 2.0 photo titled “Vintage Coca Cola Bottles 9/5” was reserved as a hard-negative check and was not used in training.[3] [4] [6]

The vehicle, leaf, and concrete searches yielded no accepted examples; the vehicle request encountered a gateway timeout. One rock-search result dominated by sandy ground was excluded because its `non_soil` label was ambiguous. The curated training manifest has no exact duplicate image hashes. The source photos and working manifests remain outside the repository.

## Grouped evaluation

The prototype uses RGB/HSV color histograms and HOG-like image features with an RBF support-vector machine. Five-fold `StratifiedGroupKFold` validation kept all Zenodo images from a physical sample in the same fold. Openverse images were grouped by image record. The curated set contains 180 images: 136 soil images from 26 sample groups and 44 non-soil images from 44 image groups.

Mean fold balanced accuracy was **98.75%** with a fold standard deviation of **2.50 percentage points**. Out-of-fold balanced accuracy was **98.86%**. With matrix rows and columns ordered as `non_soil`, `soil`, the out-of-fold confusion matrix was `[[43, 1], [0, 136]]`: 43 of 44 non-soil images were rejected correctly, one was incorrectly flagged as soil, and all 136 soil images were detected. The separate Coca-Cola hard-negative image was classified `non_soil`; its SVM decision score was `-0.7287`.

The score is an uncalibrated SVM decision value, not a probability. The high grouped scores do not establish field-photo performance: the soil positives are close-up laboratory sample trays, while the negatives are mostly unrelated web photographs. Grouping removes repeated-sample leakage, but it does not remove this source and capture-condition mismatch. The model may be distinguishing the laboratory image style rather than recognizing soil reliably in ordinary outdoor photos. The single Coca-Cola result is only one check.

## Integration decision

The model is being kept as a standalone research artifact and **not connected to the live site**. Despite strong internal grouped metrics and a passing Coca-Cola check, the data are too domain-mismatched to justify changing user-facing screening behavior. Connecting it now could cause field soil photos to be rejected. A future integration decision should wait for a substantially larger, representative, site- and sample-grouped set of field soil and non-soil images, including soil photographed on the ground and difficult negatives such as rocks, rubble, plants, and branded objects.

The existing browser flow still posts to `POST /api/soil/analyze` and may use the optional external vision model. The separate legacy Keras model still has three visual soil classes and is not wired into that route. Neither route uses this binary artifact. The prototype inference contract returns only a binary label, marks the result experimental, and explicitly identifies its score as uncalibrated.

## Project artifacts

The standalone model is `backend/models/soil_binary_prototype.joblib`, with the evaluation JSON alongside it. Collection, grouped training, inference, and focused tests are in `backend/data_pipeline/collect_soil_binary_data.py`, `backend/data_pipeline/train_soil_binary_model.py`, `backend/tanimtech/soil_binary_model.py`, and `backend/tests/test_soil_binary_model.py`. The model SHA-256 is `35efb8ad81a5efa8d32ef090b1286d85e8661bf1b4c11892f2336c9a3fb972e8`.

The collector verifies Zenodo’s archive checksum, records Openverse attribution and licensing, excludes the reviewed ambiguous image, and writes source images outside the repository. Four focused tests pass for feature extraction, invalid image handling, binary output, and the absence of texture labels.

## Other data sources reviewed

The Mendeley record is CC BY 4.0 but does not expose labels that can be mapped safely to the requested texture classes. Phantom-fs is CC BY-NC 4.0 and was not used for a potentially commercial site. Open Images requires per-image license checks, so it was not used for this prototype.[7] [8] [9]

## References

[1]: https://zenodo.org/records/14725633 "Close range images of soils and their particle size distributions dataset"
[2]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12152572/ "Close range images of soils and their particle size distributions article"
[3]: https://api.openverse.org/v1/images/ "Openverse image API"
[4]: https://creativecommons.org/licenses/by/2.0/ "Attribution 2.0 Generic"
[5]: https://creativecommons.org/publicdomain/zero/1.0/ "CC0 1.0 Universal"
[6]: https://www.flickr.com/photos/58606771@N00/4975298471 "Vintage Coca Cola Bottles 9/5"
[7]: https://data.mendeley.com/datasets/xfvw7fj7hx/1 "Multirange Scale Soil Image Dataset"
[8]: https://github.com/Phantom-fs/Soil-Classification-Dataset "Soil Classification Dataset license and documentation"
[9]: https://github.com/openimages/dataset/blob/main/READMEV3.md "Open Images dataset documentation"

-- For XAMPP MySQL / phpMyAdmin. Import the CSVs from data_pipeline/clean/ into these tables
-- (phpMyAdmin -> pick the table -> Import -> CSV -> tick "The first line of the file contains the table column names").
CREATE DATABASE IF NOT EXISTS tanimtech CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tanimtech;

CREATE TABLE IF NOT EXISTS crops (
  slug VARCHAR(60) PRIMARY KEY, name VARCHAR(100) NOT NULL, scientific VARCHAR(150),
  category VARCHAR(60) NOT NULL, life_form ENUM('Herb','Vine','Tree') NOT NULL, summary VARCHAR(255),
  ph_min DECIMAL(4,1), ph_max DECIMAL(4,1), temp_min DECIMAL(4,1), temp_max DECIMAL(4,1),
  rain_min INT, rain_max INT, humidity_min INT NULL, humidity_max INT NULL,
  days_min INT, days_max INT,
  best_months VARCHAR(40), possible_months VARCHAR(40),      -- e.g. "11,12,1,2"
  flood_note VARCHAR(255), typhoon_note VARCHAR(255),
  ph_abs_min DECIMAL(4,1) NULL, ph_abs_max DECIMAL(4,1) NULL, temp_abs_min DECIMAL(4,1) NULL, temp_abs_max DECIMAL(4,1) NULL,
  rain_abs_min INT NULL, rain_abs_max INT NULL,
  data_source VARCHAR(100), humidity_source VARCHAR(30), needs_review TINYINT(1) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS province_climate_monthly (
  province VARCHAR(80) NOT NULL, month TINYINT NOT NULL,
  temp_c DECIMAL(4,1), humidity_pct INT, rainfall_mm INT,
  PRIMARY KEY (province, month)
);

CREATE TABLE IF NOT EXISTS province_typhoon_monthly (
  province VARCHAR(80) NOT NULL, month TINYINT NOT NULL,
  storms_per_year DECIMAL(6,3), risk_label ENUM('Low','Caution','High'),
  PRIMARY KEY (province, month)
);

CREATE TABLE IF NOT EXISTS crop_area (
  province VARCHAR(80) NOT NULL, crop VARCHAR(100) NOT NULL, year SMALLINT NOT NULL,
  area_planted_ha DECIMAL(14,2) NULL, area_harvested_ha DECIMAL(14,2) NULL,
  PRIMARY KEY (province, crop, year)
);
-- crop_area_clean.csv columns: province,crop,year,area_harvested_ha,area_planted_ha (import by column name).

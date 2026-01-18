# Data Generation Scripts

This directory contains Python scripts to download the sample dataset and convert it into a format suitable for the `expo-vector-search` demo app.

## Prerequisites

1.  **Python 3.8+**
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

**Important:** Run all commands from the **project root directory** so that file paths (e.g., `./assets/`) resolve correctly.

```bash
# Example
python scripts/download_and_convert_products.py
```

## Usage

### 1. Download & Convert
This script downloads the "Shopping Queries Image Dataset" from Hugging Face (Crossing Minds), merges the features and image URLs, and creates a single large JSON file.

```bash
python download_and_convert_products.py
```
> Output: `assets/products_vectors.json` (~150MB) + `data/*.parquet`

### 2. Chunk Data
This script splits the large JSON file into smaller chunks to prevent memory issues during the app's initial load. It also generates the `index.ts` file needed by the application.

```bash
python split_dataset.py
```
> Output: `assets/chunks/*.json` and `assets/chunks/index.ts`

### 3. Cleanup (Optional)
After generating the chunks, you can delete the large JSON file to save space:

```bash
rm ../assets/products_vectors.json
```

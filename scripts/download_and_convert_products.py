import os
import json
import pandas as pd
from huggingface_hub import hf_hub_download
# Configuration
REPO_ID = "crossingminds/shopping-queries-image-dataset"
FILES = {
    "features": "data/product_features.parquet",
    "image_urls": "data/product_image_urls.parquet"
}
OUTPUT_FILE = "./assets/products_vectors.json"
MAX_ITEMS = 10000

def process():
    print(f"🚀 Starting download + conversion from {REPO_ID}...")
    
    # 1. Download Files
    local_paths = {}
    for key, filename in FILES.items():
        print(f"� Downloading {filename}...")
        try:
            path = hf_hub_download(repo_id=REPO_ID, filename=filename, repo_type="dataset")
            local_paths[key] = path
            print(f"✅ Downloaded to {path}")
        except Exception as e:
            print(f"❌ Failed to download {filename}: {e}")
            return

    # 2. Load Data
    print("🔄 Loading Parquet files into DataFrame...")
    
    # Features
    df_features = pd.read_parquet(local_paths["features"])
    print(f"   Features shape: {df_features.shape}")
    print(f"   Features columns: {df_features.columns.tolist()}")
    
    # Image URLs
    df_images = pd.read_parquet(local_paths["image_urls"])
    print(f"   Images shape: {df_images.shape}")
    print(f"   Images columns: {df_images.columns.tolist()}")

    # 3. Merge
    common_col = 'product_id' # Verified via debug
    print(f"🔄 Merging on '{common_col}'...")
    
    df_merged = pd.merge(df_features, df_images, on=common_col, how='inner')
    print(f"✅ Merged shape: {df_merged.shape}")
    
    # 4. Convert to JSON
    print(f"🔄 Converting top {MAX_ITEMS} items to JSON...")
    
    output_data = []
    count = 0
    
    # Confirmed column names
    emb_col = 'clip_image_features'
    img_col = 'image_url'

    print(f"   Using embedding column: {emb_col}")
    print(f"   Using image column: {img_col}")

    if emb_col not in df_merged.columns:
        print(f"❌ Error: Available columns are {df_merged.columns.tolist()}")
        return

    for _, row in df_merged.iterrows():
        try:
            vec = row[emb_col]
            # Ensure it's a list
            if hasattr(vec, 'tolist'): vec = vec.tolist()
            
            item = {
                "id": str(row[common_col]),
                "name": f"Product {row[common_col]}", # Dataset might not have names in these files?
                "image": row[img_col] if img_col in row else None,
                "vector": vec,
                "metadata": {
                    "type": "product"
                }
            }
            output_data.append(item)
            count += 1
            if count >= MAX_ITEMS:
                break
        except Exception as e:
            continue

    # 5. Save
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output_data, f)
        
    print(f"🎉 Success! Saved {len(output_data)} products to '{OUTPUT_FILE}'")

if __name__ == "__main__":
    process()

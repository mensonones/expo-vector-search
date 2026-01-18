import json
import os
import math

INPUT_FILE = "./assets/products_vectors.json"
OUTPUT_DIR = "./assets/chunks"
ITEMS_PER_CHUNK = 1000

def split_json():
    print(f"🚀 Reading {INPUT_FILE}...")
    
    if not os.path.exists(INPUT_FILE):
        print("❌ Input file not found.")
        return

    with open(INPUT_FILE, 'r') as f:
        data = json.load(f)
        
    total_items = len(data)
    num_chunks = math.ceil(total_items / ITEMS_PER_CHUNK)
    print(f"📦 Total items: {total_items}. Splitting into {num_chunks} chunks of {ITEMS_PER_CHUNK}...")
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Generate index file for easy importing
    index_content = ["const chunks = ["]
    
    for i in range(num_chunks):
        start = i * ITEMS_PER_CHUNK
        end = start + ITEMS_PER_CHUNK
        chunk = data[start:end]
        
        filename = f"products_chunk_{i}.json"
        chunk_file = os.path.join(OUTPUT_DIR, filename)
        with open(chunk_file, 'w') as f:
            json.dump(chunk, f)
            
        print(f"   ✅ Saved {chunk_file} ({len(chunk)} items)")
        index_content.append(f"  require('./{filename}'),")
        
    index_content.append("];")
    index_content.append("export default chunks;")
    
    # Save index.ts
    with open(os.path.join(OUTPUT_DIR, "index.ts"), "w") as f:
        f.write("\n".join(index_content))
    print(f"   ✅ Saved index.ts")

if __name__ == "__main__":
    split_json()

import os
import json

# Define paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
RAW_DATA_DIR = os.path.join(PROJECT_ROOT, "webapp", "public", "data", "raw")

def main():
    print(f"Scanning {RAW_DATA_DIR} for '*unknown*'...")
    
    modified_count = 0
    files = [f for f in os.listdir(RAW_DATA_DIR) if f.endswith(".json")]
    
    for filename in files:
        filepath = os.path.join(RAW_DATA_DIR, filename)
        
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            
            if "*unknown*" in content:
                print(f"Modifying {filename}...")
                new_content = content.replace("*unknown*", "unknown")
                
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(new_content)
                
                modified_count += 1
        except Exception as e:
            print(f"Error processing {filename}: {e}")

    print(f"Done. Modified {modified_count} files.")

if __name__ == "__main__":
    main()

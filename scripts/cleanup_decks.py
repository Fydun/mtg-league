import os
import sys

# Define paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
RAW_DATA_DIR = os.path.join(PROJECT_ROOT, "webapp", "public", "data", "raw")

def main():
    if len(sys.argv) != 3:
        print(f"Usage: python {os.path.basename(__file__)} <search> <replace>")
        print(f"Example: python {os.path.basename(__file__)} Stiflenought Dreadnought")
        sys.exit(1)

    search = sys.argv[1]
    replace = sys.argv[2]

    print(f"Scanning {RAW_DATA_DIR} for '{search}' → '{replace}'...")

    modified_count = 0
    files = [f for f in os.listdir(RAW_DATA_DIR) if f.endswith(".json")]

    for filename in files:
        filepath = os.path.join(RAW_DATA_DIR, filename)

        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

            if search in content:
                print(f"Modifying {filename}...")
                new_content = content.replace(search, replace)

                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(new_content)

                modified_count += 1
        except Exception as e:
            print(f"Error processing {filename}: {e}")

    print(f"Done. Modified {modified_count} files.")

if __name__ == "__main__":
    main()

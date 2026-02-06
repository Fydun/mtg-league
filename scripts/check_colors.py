import zipfile
import re
import xml.etree.ElementTree as ET

filename = 'Oslo Legacy League.xlsx'

def get_tab_colors():
    with zipfile.ZipFile(filename) as z:
        # 1. Map Sheet Name -> rId in workbook.xml
        wb_xml = z.read('xl/workbook.xml')
        wb_root = ET.fromstring(wb_xml)
        namespaces = {'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
        
        sheet_map = {} # name -> rId
        for sheet in wb_root.findall('.//{*}sheet'):
            name = sheet.get('name')
            rId = sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            sheet_map[name] = rId
            
        # 2. Map rId -> Target XML in xl/_rels/workbook.xml.rels
        rels_xml = z.read('xl/_rels/workbook.xml.rels')
        rels_root = ET.fromstring(rels_xml)
        
        id_to_file = {}
        for rel in rels_root.findall('.//{*}Relationship'):
            rId = rel.get('Id')
            target = rel.get('Target')
            id_to_file[rId] = target

        # 3. For each "Week" sheet, read properties
        results = []
        for name, rId in sheet_map.items():
            if not name.startswith('Week'): continue
            
            target = id_to_file.get(rId)
            if not target: continue
            
            # Target is relative to xl/, e.g., "worksheets/sheet1.xml"
            path = f"xl/{target}"
            
            try:
                sheet_xml = z.read(path)
                sheet_root = ET.fromstring(sheet_xml)
                
                # Look for <sheetPr><tabColor rgb="..."/></sheetPr>
                # Namespace is typically default
                sheetPr = sheet_root.find('.//{*}sheetPr')
                color_code = None
                if sheetPr is not None:
                    tabColor = sheetPr.find('.//{*}tabColor')
                    if tabColor is not None:
                        # rgb is usually ARGB hex
                        color_code = tabColor.get('rgb') 
                        if not color_code:
                            # Try theme/tint?
                            theme = tabColor.get('theme')
                            if theme: color_code = f"THEME-{theme}"
                        
                results.append((name, color_code))
            except Exception as e:
                print(f"Error reading {name}: {e}")

        # Print results sorted by week
        def sort_key(x):
            try: return int(re.search(r'\d+', x[0]).group())
            except: return 0
            
        results.sort(key=sort_key)
        
        for name, color in results:
            print(f"{name}: {color}")

if __name__ == "__main__":
    get_tab_colors()

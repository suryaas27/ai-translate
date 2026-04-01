from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.text.paragraph import Paragraph
from docx.table import Table
from docx.oxml.ns import qn
import html
import base64

class DocxToHtmlConverter:
    def __init__(self, file_stream):
        self.doc = Document(file_stream)
        self.html_parts = []
        self.wingdings_map = {
            '\uF0A7': '☑', '\uF0A8': '☐', 
            '\uF071': '✓', '\uF072': '✗',
            '\uF06F': '☐', '\uF0FE': '■',
        }

    def convert(self):
        """Main conversion method"""
        # Improved CSS matching the User's Reference (NTB-LOAN.html)
        self.html_parts.append("""
        <style>
            body { background: #eee; padding: 20px; text-align: center; }
            .docx-wrapper { display: inline-block; text-align: left; }
            
            /* The Page Container - Matches Reference */
            .page {
                padding: 1.5cm 2.5cm; /* Adjusted top margin to accommodate headers */
                margin: 0 auto 20px auto;
                background: white;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                
                /* A4 Dimensions */
                width: 21cm; 
                min-height: 29.7cm; 
                
                display: flex;
                flex-direction: column;
                text-align: justify;
                position: relative;
                box-sizing: border-box;
                font-family: "Anek Devanagari", "Times New Roman", Times, serif;
                font-size: 11pt;
                line-height: 1.2;
                color: #000;
            }
            
            .docx-header {
                position: absolute;
                top: 0.5cm;
                left: 2.5cm;
                right: 2.5cm;
                font-size: 9pt;
                color: #666;
                border-bottom: 0.5px solid #ccc;
                padding-bottom: 5px;
            }
            
            .docx-footer {
                position: absolute;
                bottom: 0.5cm;
                left: 2.5cm;
                right: 2.5cm;
                font-size: 9pt;
                color: #666;
                border-top: 0.5px solid #ccc;
                padding-top: 5px;
            }

            /* Print Media Query for PDF conversion */
            @media print {
                body { background: white; margin: 0; padding: 0; }
                .page { box-shadow: none; margin: 0; width: 100%; page-break-after: always; }
            }

            .docx-table { border-collapse: collapse; width: 100%; margin: 1em 0; }
            .docx-table td, .docx-table th { border: none; padding: 0.3em; vertical-align: top; min-width: 1em; min-height: 1.2em; }
            
            /* Helper for forced borders from XML */
            .has-border-top { border-top: 1px solid #000 !important; }
            .has-border-bottom { border-bottom: 1px solid #000 !important; }
            .has-border-left { border-left: 1px solid #000 !important; }
            .has-border-right { border-right: 1px solid #000 !important; }
            
            h1 { font-size: 14pt; text-align: center; font-weight: bold; text-decoration: underline; margin: 1em 0; }
            h2 { font-size: 12pt; margin: 0.8em 0; font-weight: bold; }
            h3 { font-size: 11pt; margin: 0.5em 0; font-weight: bold; }
            
            .docx-content ul, .docx-content ol { margin: 0; padding-left: 0; list-style-position: inside; } 
            .docx-content li { margin-bottom: 0em; }
        </style>
        """)

        # Capture Header/Footer templates (Using first section as default for preview)
        self.header_html = ""
        self.footer_html = ""
        
        if self.doc.sections:
            section = self.doc.sections[0]
            # Capture Header
            if section.header:
                sub_converter = DocxToHtmlConverter(None)
                sub_converter.doc = self.doc
                sub_converter.process_container(section.header)
                self.header_html = f'<div class="docx-header">{"".join(sub_converter.html_parts)}</div>'

            # Capture Footer
            if section.footer:
                sub_converter = DocxToHtmlConverter(None)
                sub_converter.doc = self.doc
                sub_converter.process_container(section.footer)
                self.footer_html = f'<div class="docx-footer">{"".join(sub_converter.html_parts)}</div>'

        # Main content rendering with recurring H/F
        self.html_parts.append('<div class="docx-wrapper">')
        self.start_new_page()
        
        self.html_parts.append('<div class="docx-content">')
        self.process_container(self.doc)
        self.html_parts.append('</div>')

        self.close_current_page()
        self.html_parts.append("</div>") 
        return "".join(self.html_parts)

    def start_new_page(self):
        self.html_parts.append('<div class="page">')
        if self.header_html:
            self.html_parts.append(self.header_html)

    def close_current_page(self):
        if self.footer_html:
            self.html_parts.append(self.footer_html)
        self.html_parts.append('</div>')
    
    def check_page_break(self, paragraph):
        # 1. Explicit Run Breaks
        for run in paragraph.runs:
            # Check for <w:lastRenderedPageBreak/>
            if run._element.findall('.//' + qn('w:lastRenderedPageBreak')):
                return True
            # Check for <w:br w:type="page"/>
            br_elements = run._element.findall('.//' + qn('w:br'))
            for br in br_elements:
                if br.get(qn('w:type')) == 'page':
                    return True
        
        # 2. Paragraph 'page break before' property
        if paragraph.paragraph_format.page_break_before:
             return True
             
        # 3. Check for page breaks in the paragraph properties XML
        if paragraph._element.findall('.//' + qn('w:lastRenderedPageBreak')):
            return True

        return False

    def process_container(self, container):
        current_list_type = None  # None, 'ul', 'ol', 'ol-a'
        in_list = False
        
        # Helper to recursively extract blocks from complex tags like SDTs
        def get_blocks(node):
            extracted = []
            for child in node.getchildren():
                if child.tag == qn('w:p'):
                    extracted.append(Paragraph(child, self.doc))
                elif child.tag == qn('w:tbl'):
                    extracted.append(Table(child, self.doc))
                elif child.tag in [qn('w:sdt'), qn('w:sdtContent'), qn('w:ins'), qn('w:del')]:
                    extracted.extend(get_blocks(child))
            return extracted

        # Determine iterator (handle python-docx objects vs raw XML elements for textboxes/SDTs)
        if hasattr(container, 'iter_inner_content'):
            iterator = container.iter_inner_content()
        else:
            iterator = get_blocks(container)

        for block in iterator:
            if hasattr(block, 'text'):  # Paragraph
                list_type_detected = self.detect_list_type(block)
                
                if list_type_detected:
                    # Determine HTML tag and attributes
                    new_tag = 'ul'
                    new_attr = ''
                    if list_type_detected == 'ordered':
                        new_tag = 'ol'
                    elif list_type_detected == 'ordered-a':
                        new_tag = 'ol'
                        new_attr = ' type="a"'
                    
                    # If we are in a list but it's a DIFFERENT type, close the old one
                    current_full_tag = f"{new_tag}{new_attr}"
                    
                    if in_list and current_list_type != current_full_tag:
                         self.html_parts.append(f'</{current_list_type.split()[0]}>') # crude close
                         in_list = False

                    if not in_list:
                        self.html_parts.append(f'<{current_full_tag}>')
                        current_list_type = current_full_tag
                        in_list = True
                        
                    self.process_paragraph(block, is_list=True)
                else:
                    if in_list:
                        # Close generic tag (stripping attributes for the closing tag)
                        tag_name = current_list_type.split()[0] if current_list_type else 'ul'
                        self.html_parts.append(f'</{tag_name}>')
                        in_list = False
                        current_list_type = None
                    self.process_paragraph(block, is_list=False)
                    
            elif block.__class__.__name__ == 'Table':
                if in_list:
                    tag_name = current_list_type.split()[0] if current_list_type else 'ul'
                    self.html_parts.append(f'</{tag_name}>')
                    in_list = False
                    current_list_type = None
                self.process_table(block)
                
        if in_list:
             tag_name = current_list_type.split()[0] if current_list_type else 'ul'
             self.html_parts.append(f'</{tag_name}>')

    def get_numbering_text(self, paragraph):
        """Extracts the actual number (e.g. '1.', 'a)') and its suffix from Word XML"""
        try:
            p_pr = paragraph._p.pPr
            if p_pr is None or p_pr.numPr is None:
                return None, None
            
            ilvl = p_pr.numPr.ilvl.val
            num_id = p_pr.numPr.numId.val
            
            # Use python-docx's internal numbering part to get the string
            # This is complex because python-docx doesn't expose the 'rendered' string easily.
            # We'll use a simplified version that handles the common cases.
            
            # Real implementation would look up numId -> abstractNum -> level(ilvl) -> lvlText
            # For now, let's try to find it in the paragraph's numbering properties
            # if we wanted to be super precise.
            
            # Since we can't easily get the fully rendered string without a numbering engine,
            # we'll use a strategy: If it's a list, it usually starts with something.
            # But wait, the V3 report says "Each level independently reads its suffix from numbering.xml".
            
            # Let's try to get the suffix manually from the XML
            num_part = self.doc.part.numbering_part
            if not num_part: return None, None
            
            num_xml = num_part.element
            num = num_xml.find(f'.//w:num[@w:numId="{num_id}"]', num_xml.nsmap)
            if num is None: return None, None
            
            abstract_num_id = num.find('.//w:abstractNumId', num_xml.nsmap).get(qn('w:val'))
            abstract_num = num_xml.find(f'.//w:abstractNum[@w:abstractNumId="{abstract_num_id}"]', num_xml.nsmap)
            if abstract_num is None: return None, None
            
            lvl = abstract_num.find(f'.//w:lvl[@w:ilvl="{ilvl}"]', num_xml.nsmap)
            if lvl is None: return None, None
            
            # Suffix extraction (Fix #2 from V3 report)
            suff = lvl.find('.//w:suff', num_xml.nsmap)
            suffix_val = suff.get(qn('w:val')) if suff is not None else 'tab' # Default to tab in Word
            
            # Number format/text
            lvlText_el = lvl.find('.//w:lvlText', num_xml.nsmap)
            lvlText = lvlText_el.get(qn('w:val')) if lvlText_el is not None else None
            
            numFmt_el = lvl.find('.//w:numFmt', num_xml.nsmap)
            numFmt = numFmt_el.get(qn('w:val')) if numFmt_el is not None else None
            
            # Simplified number string generation (this is the hard part)
            # For now, return a placeholder or try to match the style
            return lvlText, suffix_val
            
        except Exception as e:
            print(f"Numbering error: {e}")
            return None, None

    def detect_list_type(self, paragraph):
        """Returns 'ordered', 'unordered' or None based on actual numPr"""
        try:
            if paragraph._p.pPr is not None and paragraph._p.pPr.numPr is not None:
                return 'ordered' # generic
        except AttributeError:
            pass
        return None

    def process_paragraph(self, paragraph, is_list=False):
        # Capturing textboxes before the paragraph to avoid invalid nesting (block in inline/p)
        for run in paragraph.runs:
            textboxes = run.element.findall('.//' + qn('w:txbxContent'))
            for txbx in textboxes:
                # Process textbox as its own container content
                self.process_container(txbx)

        if self.check_page_break(paragraph):
            self.close_current_page()
            self.start_new_page()

        # 0. Get Numbering Info if List
        num_text, suffix = self.get_numbering_text(paragraph) if is_list else (None, None)
        
        # Determine tag (h1-h6 or p) and alignment
        tag = 'li' if is_list else 'p'
        
        if not is_list:
            style_name = paragraph.style.name.lower()
            if 'heading 1' in style_name: tag = 'h1'
            elif 'heading 2' in style_name: tag = 'h2'
            elif 'heading 3' in style_name: tag = 'h3'
            elif 'heading 4' in style_name: tag = 'h4'
            elif 'heading 5' in style_name: tag = 'h5'
            elif 'heading 6' in style_name: tag = 'h6'

        # CSS Styles collection
        styles = []

        # 1. Paragraph Borders (w:pBdr) - Support for "Boxes" around items
        pPr = paragraph._p.pPr
        if pPr is not None:
            pBdr = pPr.find(qn('w:pBdr'))
            if pBdr is not None:
                for side in ['top', 'left', 'bottom', 'right', 'between']:
                    bdr = pBdr.find(qn(f'w:{side}'))
                    if bdr is not None and bdr.get(qn('w:val')) != 'none':
                        # Simplification: treat all borders as 1px black solid
                        styles.append(f"border-{side if side != 'between' else 'bottom'}: 1px solid #000;")
                        styles.append("padding: 5px;")

        # 2. Alignment
        if paragraph.alignment == WD_ALIGN_PARAGRAPH.CENTER: styles.append("text-align: center;")
        elif paragraph.alignment == WD_ALIGN_PARAGRAPH.RIGHT: styles.append("text-align: right;")
        elif paragraph.alignment == WD_ALIGN_PARAGRAPH.JUSTIFY: styles.append("text-align: justify;")
        
        # 2. Indentation & Spacing (The key for High Fidelity)
        pf = paragraph.paragraph_format
        
        # Left Indent
        if pf.left_indent:
            # Approx: 1pt = 1.33px. Twips are 1/20 of a pt.
            indent_pt = pf.left_indent.pt
            styles.append(f"margin-left: {indent_pt}pt;")
        
        # Right Indent
        if pf.right_indent:
            indent_pt = pf.right_indent.pt
            styles.append(f"margin-right: {indent_pt}pt;")
            
        # First Line Indent (Handling Hanging Indents)
        if pf.first_line_indent:
            indent_pt = pf.first_line_indent.pt
            # If negative, it's a hanging indent. In HTML, this is usually margin-left + negative text-indent.
            styles.append(f"text-indent: {indent_pt}pt;")
            if indent_pt < 0:
                styles.append("padding-left: 0;") 

        # Spacing Before/After
        if pf.space_before:
            styles.append(f"margin-top: {pf.space_before.pt}pt;")
        if pf.space_after:
            styles.append(f"margin-bottom: {pf.space_after.pt}pt;")
            
        # Assemble style string
        style_attr = f' style="{" ".join(styles)}"' if styles else ""
        
        # Render paragraph start
        self.html_parts.append(f'<{tag}{style_attr}>')
        
        # Render List Number if present (Fix #2 & #3 from V3 report)
        if num_text:
            # Suffix logic
            spacing = "0.5em" # Default
            if suffix == 'space': spacing = "0.3em" 
            elif suffix == 'nothing': spacing = "0"
            elif suffix == 'tab': spacing = "1.5em"
            
            # Note: num_text may have %1, %2 etc. We'll strip for simplicity 
            # as python-docx doesn't resolve nested numbers easily.
            clean_num = num_text.replace('%1', '').replace('%2', '').replace('%3', '').strip()
            if clean_num:
                self.html_parts.append(f'<span class="list-number" style="margin-right: {spacing}; min-width: 1.5em; display: inline-block;">{clean_num}</span>')

        # Render runs (text content with styling)
        for run in paragraph.runs:
            self.process_run(run)
            
        self.html_parts.append(f'</{tag}>')

    def process_run(self, run):
        # 1. Handle Images
        # Namespaces for finding images
        nsmap = {
            'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
            'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
            'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
        }
        
        # Look for drawing elements
        drawings = run.element.findall('.//w:drawing', run.element.nsmap)
        for drawing in drawings:
            # Determine if it's inline or anchored
            is_floating = False
            is_behind = False
            
            # Check for anchored (floating)
            anchors = drawing.findall('.//wp:anchor', nsmap)
            if anchors:
                is_floating = True
                anchor = anchors[0]
                # Check behindDoc attribute
                if anchor.get('behindDoc') in ['1', 'true', 'True']:
                    is_behind = True
            
            # Find blip (reference to image)
            blips = drawing.findall('.//a:blip', nsmap)
            for blip in blips:
                embed_id = blip.get(f"{{{nsmap['r']}}}embed")
                if embed_id:
                    try:
                        # Get the related image part from the local part (Fix for headers/footers)
                        image_part = run.part.related_parts[embed_id]
                        image_bytes = image_part.blob
                        
                        # Determine MIME type (naive)
                        content_type = image_part.content_type
                        if not content_type:
                            content_type = "image/png" # fallback
                            
                        # Encode to Base64
                        encoded_img = base64.b64encode(image_bytes).decode('utf-8')
                        
                        # Style handling
                        style_parts = ["max-width: 100%", "height: auto"]
                        
                        # Extract exact dimensions if available
                        extents = drawing.findall('.//wp:extent', nsmap)
                        if extents:
                            cx = int(extents[0].get('cx'))
                            cy = int(extents[0].get('cy'))
                            # 1 pt = 12700 EMUs
                            width_pt = cx / 12700
                            height_pt = cy / 12700
                            style_parts.append(f"width: {width_pt}pt")
                            style_parts.append(f"height: {height_pt}pt")

                        if is_behind:
                            # Watermark style
                            style_parts = [
                                "position: absolute", 
                                "z-index: -1", 
                                "left: 50%", 
                                "top: 50%", 
                                "transform: translate(-50%, -50%)", # Center it coarsely
                                "opacity: 0.5", # Often watermarks are faded
                                "pointer-events: none"
                            ]
                            if extents:
                                style_parts.append(f"width: {width_pt}pt")
                                style_parts.append(f"height: {height_pt}pt")
                        elif is_floating:
                            # Other floating images (e.g. wrapped text) often behave better as blocks in simplified HTML
                            # unless we extract exact coordinates. For now, let them flow but maybe block level.
                            style_parts.append("display: block")
                            
                        img_style = "; ".join(style_parts)
                        
                        # Append IMG tag
                        self.html_parts.append(f'<img src="data:{content_type};base64,{encoded_img}" style="{img_style}" />')
                    except Exception as e:
                        print(f"Error processing image: {e}")

        # 2. Handle Legacy VML Images (w:pict)
        picts = run.element.findall('.//w:pict', run.element.nsmap)
        for pict in picts:
            try:
                # Find imagedata which has the relationship ID
                imagedata = pict.findall('.//v:imagedata', {'v': 'urn:schemas-microsoft-com:vml'})
                if not imagedata:
                     imagedata = pict.findall('.//{urn:schemas-microsoft-com:vml}imagedata')
                
                if imagedata:
                    rId = imagedata[0].get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                    if rId:
                        image_part = run.part.related_parts[rId]
                        encoded_img = base64.b64encode(image_part.blob).decode('utf-8')
                        content_type = image_part.content_type or "image/png"
                        
                        # Style for pict is often in v:shape @style
                        shape = pict.find('.//{urn:schemas-microsoft-com:vml}shape')
                        v_style = shape.get('style') if shape is not None else "max-width: 100%"
                        
                        self.html_parts.append(f'<img src="data:{content_type};base64,{encoded_img}" style="max-width:100%; {v_style}" />')
            except Exception as e:
                print(f"Error processing legacy image: {e}")

        # 3. Handle Text Content
        text = run.text
        # Wingdings conversion
        if run.font.name == 'Wingdings':
            text = "".join([self.wingdings_map.get(c, c) for c in text])
            
        text = html.escape(text)
        if not text: return

        # Styling attributes
        style_parts = []
        
        # Robust bold/italic detection (Handling None/Inherited/Valued/Styles)
        rPr = getattr(run._element, 'rPr', None)
        pPr = getattr(run._element.getparent(), 'pPr', None)
        
        def is_style_on(tag_name, current_val):
            # 1. Trust python-docx explicit run-level formatting
            if current_val is not None:
                return current_val
            
            # 2. Check Run Property XML (Explicit but maybe inherited by doc-style)
            if rPr is not None:
                el = rPr.find(qn(tag_name))
                if el is not None:
                    val = el.get(qn('w:val'))
                    if val is None: return True 
                    return val.lower() not in ['0', 'false', 'off']
            
            # 3. Check Paragraph Style Inheritance (If the whole p is bold)
            if pPr is not None:
                # Word sometimes puts rPr directly in pPr for paragraph styles
                p_rPr = pPr.find(qn('w:rPr'))
                if p_rPr is not None:
                    el = p_rPr.find(qn(tag_name))
                    if el is not None:
                        val = el.get(qn('w:val'))
                        if val is None: return True
                        return val.lower() not in ['0', 'false', 'off']
            
            return False

        bold_final = is_style_on('w:b', run.bold)
        italic_final = is_style_on('w:i', run.italic)

        if bold_final: style_parts.append("font-weight: bold;")
        if italic_final: style_parts.append("font-style: italic;")
        if run.underline: style_parts.append("text-decoration: underline;")
        
        if run.font.size:
            # pt to px approximation (assuming 96dpi, 1pt = 1.33px)
            size_pt = run.font.size.pt
            style_parts.append(f"font-size: {size_pt}pt;")
            
        if run.font.color and run.font.color.rgb:
            color = run.font.color.rgb
            style_parts.append(f"color: #{color};")

        # Combine
        if style_parts:
            style_str = " ".join(style_parts)
            self.html_parts.append(f'<span style="{style_str}">{text}</span>')
        else:
            self.html_parts.append(text)

    def process_table(self, table):
        self.html_parts.append('<table class="docx-table" style="width: 100% !important; border-collapse: collapse; table-layout: auto;">')
        
        try:
            n_rows = len(table.rows)
            n_cols = len(table.columns)
        except Exception as e:
            # Fallback for complex tables where columns might be hard to count
            self.html_parts.append('<tr><td>[Complex Table - Layout Simplified]</td></tr>')
            self.html_parts.append('</table>')
            return

        # Tracking grid for processed cells (due to spans)
        processed = [[False for _ in range(n_cols)] for _ in range(n_rows)]
        
        for r_idx in range(n_rows):
            self.html_parts.append('<tr>')
            for c_idx in range(n_cols):
                if processed[r_idx][c_idx]:
                    continue
                
                try:
                    cell = table.cell(r_idx, c_idx)
                except: continue # Skip if cell is out of bounds
                
                # 1. Determine Spans
                # gridSpan (colspan)
                grid_span = 1
                tc = cell._tc
                tcPr = tc.get_or_add_tcPr()
                gridSpan = tcPr.find(qn('w:gridSpan'))
                if gridSpan is not None:
                    grid_span = int(gridSpan.get(qn('w:val')))
                
                # vMerge (rowspan) - Detection by checking underlying tc identity
                row_span = 1
                curr_r = r_idx + 1
                while curr_r < n_rows:
                    try:
                        if table.cell(curr_r, c_idx)._tc == tc:
                            row_span += 1
                            curr_r += 1
                        else: break
                    except: break

                # Mark all covered cells in the grid as processed
                for rs in range(row_span):
                    for cs in range(grid_span):
                        if r_idx + rs < n_rows and c_idx + cs < n_cols:
                            processed[r_idx + rs][c_idx + cs] = True

                # 2. Extract Shading (background color)
                shading_color = None
                try:
                    shd = tcPr.find(qn('w:shd'))
                    if shd is not None:
                        shading_color = shd.get(qn('w:fill'))
                except: pass
                
                # 3. Handle Borders (Detect from w:tcBorders or table-level w:tblBorders)
                # Word tables can have cell-specific or global borders.
                cell_classes = []
                tcBorders = tcPr.find(qn('w:tcBorders'))
                # If cell has specific borders, use them. 
                # Otherwise, we'd look at tblBorders (simplified: we'll check tblBorders later)
                if tcBorders is not None:
                    for side in ['top', 'left', 'bottom', 'right']:
                        b = tcBorders.find(qn(f'w:{side}'))
                        if b is not None and b.get(qn('w:val')) != 'none':
                            cell_classes.append(f'has-border-{side}')
                else:
                    # Check global table borders if cell doesn't override
                    tblPr = table._element.find(qn('w:tblPr'))
                    if tblPr is not None:
                        tblBdr = tblPr.find(qn('w:tblBorders'))
                        if tblBdr is not None:
                            for side in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
                                b = tblBdr.find(qn(f'w:{side}'))
                                if b is not None and b.get(qn('w:val')) != 'none':
                                    # Very simple mapping: if table has any borders, given them to all cells
                                    cell_classes.append(f'has-border-top has-border-left has-border-bottom has-border-right')
                                    break

                # 4. Build Attributes
                attrs = []
                if grid_span > 1: attrs.append(f'colspan="{grid_span}"')
                if row_span > 1: attrs.append(f'rowspan="{row_span}"')
                
                if cell_classes:
                    attrs.append(f'class="{" ".join(list(set(cell_classes)))}"')
                
                style_parts = []
                if shading_color and shading_color != 'auto':
                    style_parts.append(f"background-color: #{shading_color}")
                
                if style_parts:
                    attrs.append(f'style="{"; ".join(style_parts)}"')
                
                attr_str = " " + " ".join(attrs) if attrs else ""
                
                # 4. Process Cell Content
                self.html_parts.append(f'<td{attr_str}>')
                pre_len = len(self.html_parts)
                self.process_container(cell)
                # If no content was added, add a non-breaking space for border rendering
                if len(self.html_parts) == pre_len or not any(x.strip() for x in self.html_parts[pre_len:] if isinstance(x, str)):
                    self.html_parts.append('&nbsp;')
                self.html_parts.append('</td>')
                
            self.html_parts.append('</tr>')
        self.html_parts.append('</table>')

def convert_docx_stream_to_html(stream):
    converter = DocxToHtmlConverter(stream)
    return converter.convert()

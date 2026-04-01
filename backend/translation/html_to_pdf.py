import pdfkit
import io

def html_to_pdf(html_content: str) -> io.BytesIO:
    """
    Converts HTML content to a PDF file in memory.
    """
    options = {
        'page-size': 'A4',
        'margin-top': '0.75in',
        'margin-right': '0.75in',
        'margin-bottom': '0.75in',
        'margin-left': '0.75in',
        'encoding': "UTF-8",
        'no-outline': None,
        'enable-local-file-access': None,
        'quiet': ''
    }
    
    # Generate PDF from string
    pdf_bytes = pdfkit.from_string(html_content, False, options=options)
    
    return io.BytesIO(pdf_bytes)

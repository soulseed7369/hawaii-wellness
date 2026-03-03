import requests
import hashlib
from pathlib import Path
from PIL import Image
from typing import Optional
import io
import re

from src.config import CACHE_DIR

def download_and_resize(image_url: str, entity_website_url: str, max_size: int = 400) -> Optional[str]:
    try:
        # Step 1: GET image_url with timeout=10, headers={User-Agent: AlohaHealthBot/1.0}
        response = requests.get(image_url, timeout=10, headers={'User-Agent': 'AlohaHealthBot/1.0'})
        response.raise_for_status()
        
        # Step 2: Check Content-Type starts with image/ — if not, return None
        content_type = response.headers.get('Content-Type', '')
        if not content_type.startswith('image/'):
            return None
        
        # Step 3: Open with PIL.Image.open(io.BytesIO(response.content))
        image = Image.open(io.BytesIO(response.content))
        
        # Step 4: Convert to RGB (handles RGBA/palette PNGs)
        if image.mode in ('RGBA', 'LA', 'P'):
            image = image.convert('RGB')
        
        # Step 5: Resize: compute scale so max(width, height) <= max_size, use Image.LANCZOS
        width, height = image.size
        if width > max_size or height > max_size:
            # Step 6: Only resize if image is larger than max_size in either dimension
            scale = max_size / max(width, height)
            new_width = int(width * scale)
            new_height = int(height * scale)
            image = image.resize((new_width, new_height), Image.LANCZOS)
        
        # Step 7: Save path: CACHE_DIR / images / hashlib.md5(entity_website_url.encode()).hexdigest() + .jpg
        save_filename = hashlib.md5(entity_website_url.encode()).hexdigest() + '.jpg'
        save_path = CACHE_DIR / 'images' / save_filename
        
        # Step 8: Create parent dir if needed
        save_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Step 9: Save as JPEG quality=85
        image.save(save_path, 'JPEG', quality=85)
        
        # Step 10: Return str(save_path)
        return str(save_path)
        
    except Exception:
        return None

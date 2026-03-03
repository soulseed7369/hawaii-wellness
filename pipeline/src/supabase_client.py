import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

from src.config import BASE_DIR

# Load environment variables
load_dotenv(dotenv_path=BASE_DIR.parent / '.env')

# Read Supabase configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL')
if not SUPABASE_URL:
    raise KeyError("SUPABASE_URL environment variable is required")

SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
if not SUPABASE_SERVICE_ROLE_KEY:
    raise KeyError("SUPABASE_SERVICE_ROLE_KEY environment variable is required")

# Create Supabase client
try:
    client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
except Exception as e:
    print(f"Failed to create Supabase client: {e}")
    raise

# Export variables for use in other modules
__all__ = ['client', 'SUPABASE_URL']
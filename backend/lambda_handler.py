"""Lambda entry point wrapping FastAPI with Mangum."""
from mangum import Mangum

from src.app import app

handler = Mangum(app)

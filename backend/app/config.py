import os

try:
    from pydantic_settings import BaseSettings
    class Settings(BaseSettings):
        PROJECT_NAME: str = "WebContact AI"
        API_V1_STR: str = "/api"
        
        # Database
        DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./webcontact.db")
        
        # Redis
        REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        
        # Crawler Limits
        MAX_PAGES_PER_SITE: int = int(os.getenv("MAX_PAGES_PER_SITE", "5"))
        REQUEST_TIMEOUT: int = int(os.getenv("REQUEST_TIMEOUT", "15"))
        MAX_CONCURRENT_SITES: int = int(os.getenv("MAX_CONCURRENT_SITES", "5"))
        REQUEST_DELAY: float = float(os.getenv("REQUEST_DELAY", "0.5"))
        USE_PLAYWRIGHT_FALLBACK: bool = os.getenv("USE_PLAYWRIGHT_FALLBACK", "true").lower() == "true"
        
        # Security
        SECRET_KEY: str = os.getenv("SECRET_KEY", "webcontact_ai_secret_key_change_in_production")
        ALLOWED_ORIGINS: list[str] = ["*"]

        model_config = {
            "case_sensitive": True,
            "env_file": ".env",
            "extra": "ignore"
        }

except Exception:
    class Settings:
        PROJECT_NAME: str = "WebContact AI"
        API_V1_STR: str = "/api"
        
        # Database
        DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./webcontact.db")
        
        # Redis
        REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        
        # Crawler Limits
        MAX_PAGES_PER_SITE: int = int(os.getenv("MAX_PAGES_PER_SITE", "5"))
        REQUEST_TIMEOUT: int = int(os.getenv("REQUEST_TIMEOUT", "15"))
        MAX_CONCURRENT_SITES: int = int(os.getenv("MAX_CONCURRENT_SITES", "5"))
        REQUEST_DELAY: float = float(os.getenv("REQUEST_DELAY", "0.5"))
        USE_PLAYWRIGHT_FALLBACK: bool = os.getenv("USE_PLAYWRIGHT_FALLBACK", "true").lower() == "true"
        
        # Security
        SECRET_KEY: str = os.getenv("SECRET_KEY", "webcontact_ai_secret_key_change_in_production")
        ALLOWED_ORIGINS: list[str] = ["*"]

settings = Settings()

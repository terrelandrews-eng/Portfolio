from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central config, loaded from environment / .env. Never hardcode secrets."""

    # protected_namespaces=() lets us name fields model_main / model_fast without
    # colliding with pydantic's reserved "model_" prefix.
    model_config = SettingsConfigDict(
        env_file=".env", extra="ignore", protected_namespaces=()
    )

    # Core
    api_token: str = "dev-local-token-change-me"
    database_url: str = "postgresql+asyncpg://lifeos:lifeos@localhost:5432/lifeos"
    mock_integrations: bool = True
    timezone: str = "America/New_York"
    user_name: str = "Terrel"

    # LLM (Phase 2+)
    anthropic_api_key: str = ""
    model_main: str = "claude-sonnet-4-6"
    model_fast: str = "claude-haiku-4-5-20251001"

    # Embeddings
    embedding_api_key: str = ""
    embedding_model: str = "voyage-3"
    embedding_dim: int = 1024

    # Integrations (Phase 2+)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_refresh_token: str = ""
    resend_api_key: str = ""
    briefing_email_to: str = ""
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    briefing_hour: int = 6
    weekly_plan_day: str = "SUN"
    weekly_plan_hour: int = 16

    # Location
    latitude: float = 40.7128
    longitude: float = -74.0060

    @property
    def use_real_embeddings(self) -> bool:
        """Use Voyage only when explicitly online and a key is present."""
        return not self.mock_integrations and bool(self.embedding_api_key)

    @property
    def use_real_llm(self) -> bool:
        """Call the Anthropic API only when online and a key is present.
        Otherwise the deterministic fallback renderer stands in, so the full
        briefing/chat flow is demoable offline with no API key."""
        return not self.mock_integrations and bool(self.anthropic_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()

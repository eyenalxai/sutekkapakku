from enum import Enum

from pydantic import BaseSettings, Field, validator


class PollType(Enum):
    WEBHOOK = "WEBHOOK"
    POLLING = "POLLING"


class Settings(BaseSettings):
    api_token: str = Field(env="API_TOKEN")
    admin_username: str = Field(env="ADMIN_USERNAME")
    database_url: str = Field(env="DATABASE_URL")
    domain: str = Field(env="DOMAIN")
    port: int = Field(env="PORT")
    poll_type: PollType = Field(env="POLL_TYPE")
    main_bot_path = "/webhook/main"

    @property
    def async_database_url(self) -> str:
        async_database_url = self.database_url.replace("postgresql://", "postgresql+asyncpg://")
        assert async_database_url.startswith(
            "postgresql+asyncpg://"), "DATABASE_URL must start with postgresql+asyncpg://"
        return async_database_url

    @property
    def webhook_url(self) -> str:
        return f"https://{self.domain}{self.main_bot_path}"

    @validator("domain")
    def domain_must_not_end_with_slash(cls, v: str) -> str:
        assert not v.endswith("/"), "DOMAIN must not end with slash"
        assert not v.startswith("http"), "DOMAIN must not start with http"
        assert not v.startswith("https"), "DOMAIN must not start with https"
        return v


settings = Settings()

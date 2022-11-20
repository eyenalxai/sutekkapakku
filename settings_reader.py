from typing import Any

from pydantic import BaseSettings, Field, validator

from util.random import random_letter_string


class Settings(BaseSettings):
    api_token: str = Field(env='API_TOKEN')
    admin_username: str = Field(env='ADMIN_USERNAME')
    database_url: str = Field(env='DATABASE_URL')
    domain: str = Field(env='DOMAIN')
    port: int = Field(env='PORT')
    poll_type: str = Field(env='POLL_TYPE')
    environment: str = Field(env='ENVIRONMENT')
    main_bot_path: str

    # init
    def __init__(self, **data: Any) -> None:
        super().__init__(**data)
        main_bot_path_initial = "/webhook/main"
        random_string = random_letter_string(length=6)
        self.main_bot_path = f"{main_bot_path_initial}_{random_string}"

    @property
    def async_database_url(self) -> str:
        async_database_url = self.database_url.replace('postgresql://', 'postgresql+asyncpg://')
        assert async_database_url.startswith(
            'postgresql+asyncpg://'), 'DATABASE_URL must start with postgresql+asyncpg://'
        return async_database_url

    @property
    def webhook_url(self) -> str:
        return f"https://{self.domain}{self.main_bot_path}"

    @validator('domain')
    def domain_must_not_end_with_slash(cls, v: str) -> str:
        assert not v.endswith('/'), 'DOMAIN must not end with slash'
        assert not v.startswith('http'), 'DOMAIN must not start with http'
        assert not v.startswith('https'), 'DOMAIN must not start with https'
        return v

    @validator('poll_type')
    def poll_type_must_be_webhook_or_polling(cls, v: str) -> str:
        assert v in ['WEBHOOK', 'POLLING'], 'POLL_TYPE must be WEBHOOK or POLLING'
        return v

    @validator('environment')
    def environment_must_be_dev_or_prod(cls, v: str) -> str:
        assert v in ['DEV', 'PROD'], 'ENVIRONMENT must be DEV or PROD'
        return v


settings = Settings()

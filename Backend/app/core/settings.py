from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    db_name: str
    db_user: str
    db_password: str
    db_host: str
    db_port: int
    frontend_url: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
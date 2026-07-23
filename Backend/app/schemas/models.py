from pydantic import BaseModel
from enum import Enum
from typing import Optional


class OrderOptions(str, Enum):
    price_asc = "price-asc"
    price_desc = "price-desc"
    relevance = "relevance"
    rating_asc = "rating-asc"
    rating_desc = "rating-desc"


class Product(BaseModel):
    name: str
    rating: float
    price: float
    link: str
    image: str
    description: str


class Search(BaseModel):
    product_search: str
    filters: OrderOptions = OrderOptions.relevance
    page_number: int = 1


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = ""


class LogoutRequest(BaseModel):
    session_id: str


class ChangePasswordRequest(BaseModel):
    username: str
    old_password: str
    new_password: str
    session_id: str


class TrackProductRequest(BaseModel):
    session_id: str
    product_link: str
    product_name: str
    latest_price: str


class UnTrackProductRequest(BaseModel):
    session_id: str
    product_link: str


class GetProfileRequest(BaseModel):
    session_id: str


class UpdateTrackedProductRequest(BaseModel):
    session_id: str
    tracked_product_id: int
    target_price: Optional[float] = None
    notify: Optional[bool] = None


class RemoveTrackedProductRequest(BaseModel):
    session_id: str
    tracked_product_id: int


class GetStatsRequest(BaseModel):
    session_id: str


class GetTrackedRequest(BaseModel):
    session_id: str
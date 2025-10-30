"""
Pydantic schemas for calls API endpoints.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator


class CallBase(BaseModel):
    """Base call schema with common fields."""
    
    client_id: int = Field(..., gt=0, description="Client ID must be a positive integer")
    phone_number: str = Field(..., max_length=20, description="Phone number")
    response_category: Optional[str] = Field(None, description="Response category")
    recording_url: Optional[str] = Field(None, description="Recording URL")
    recording_length: Optional[float] = Field(None, ge=0, description="Recording length in seconds")
    list_id: Optional[str] = Field(None, max_length=50, description="List identifier")
    final_transcription: Optional[str] = Field(None, description="Final transcription of the call")
    
    @validator("phone_number")
    def validate_phone_number(cls, v):
        """Validate phone number format."""
        if not v or not v.strip():
            raise ValueError("Phone number cannot be empty")
        return v.strip()
    
    @validator("recording_url")
    def validate_recording_url(cls, v):
        """Validate recording URL format."""
        if v and not v.strip():
            return None
        return v
    
    @validator("list_id")
    def validate_list_id(cls, v):
        """Validate list ID format."""
        if v and not v.strip():
            return None
        return v
    
    @validator("final_transcription")
    def validate_final_transcription(cls, v):
        """Validate final transcription format."""
        if v and not v.strip():
            return None
        return v


class CallCreate(CallBase):
    """Schema for creating a new call."""
    pass


class CallUpdate(CallBase):
    """Schema for updating an existing call."""
    pass


class CallInDB(CallBase):
    """Schema for call as stored in database."""
    
    call_id: int = Field(..., description="Unique call identifier")
    timestamp: datetime = Field(..., description="Call timestamp")
    
    class Config:
        orm_mode = True


class CallResponse(CallInDB):
    """Schema for call API responses."""
    pass


class CallBatchCreate(BaseModel):
    """Schema for batch call creation."""
    
    calls: List[CallCreate] = Field(..., min_items=1, max_items=1000, description="List of calls to create")
    
    @validator("calls")
    def validate_calls_list(cls, v):
        """Validate calls list."""
        if not v:
            raise ValueError("Calls list cannot be empty")
        return v


class CallBatchResponse(BaseModel):
    """Schema for batch operation responses."""
    
    message: str = Field(..., description="Operation result message")
    calls: List[CallResponse] = Field(..., description="Created calls")


class CallListResponse(BaseModel):
    """Schema for paginated call list responses."""
    
    calls: List[CallResponse] = Field(..., description="List of calls")
    pagination: "PaginationInfo" = Field(..., description="Pagination information")


class PaginationInfo(BaseModel):
    """Schema for pagination information."""
    
    page: int = Field(..., ge=1, description="Current page number")
    limit: int = Field(..., ge=1, le=1000, description="Items per page")
    total: int = Field(..., ge=0, description="Total number of items")
    total_pages: int = Field(..., ge=0, description="Total number of pages")


class SuccessResponse(BaseModel):
    """Schema for success responses."""
    
    message: str = Field(..., description="Success message")
    call: Optional[CallResponse] = Field(None, description="Call data if applicable")


class ErrorResponse(BaseModel):
    """Schema for error responses."""
    
    error: str = Field(..., description="Error message")
    details: Optional[str] = Field(None, description="Additional error details")


# Update forward references
CallListResponse.update_forward_refs()

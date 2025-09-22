"""
API endpoints for calls management.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from databases import Database
import math

from app.schemas.calls import (
    CallCreate, CallUpdate, CallResponse, CallBatchCreate, 
    CallBatchResponse, CallListResponse, SuccessResponse, PaginationInfo
)
from app.dependencies.database import get_database
from app.dependencies.pagination import get_pagination_params
from app.core.config import settings

router = APIRouter()


@router.get("/", response_model=CallListResponse)
async def get_calls(
    pagination: dict = Depends(get_pagination_params),
    db: Database = Depends(get_database),
):
    """Get all calls with pagination."""
    try:
        # get total count
        count_query = "SELECT COUNT(*) FROM calls"
        total_calls = await db.fetch_val(count_query)
        
        # get paginated calls
        query = """
            SELECT call_id, client_id, phone_number, response_category, 
                   timestamp, recording_url, recording_length, list_id, final_transcription
            FROM calls 
            ORDER BY timestamp DESC 
            LIMIT :limit OFFSET :offset
        """
        
        calls = await db.fetch_all(
            query, 
            values={"limit": pagination["limit"], "offset": pagination["offset"]}
        )
        
        # convert to response format
        call_responses = [CallResponse(**dict(call)) for call in calls]
        
        # calculate pagination info
        total_pages = math.ceil(total_calls / pagination["limit"]) if total_calls > 0 else 0
        
        pagination_info = PaginationInfo(
            page=pagination["page"],
            limit=pagination["limit"],
            total=total_calls,
            total_pages=total_pages
        )
        
        return CallListResponse(calls=call_responses, pagination=pagination_info)
        
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/{call_id}", response_model=CallResponse)
async def get_call(
    call_id: int,
    db: Database = Depends(get_database)
):
    """Get call by ID."""
    if call_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid call ID"
        )
    
    try:
        query = """
            SELECT call_id, client_id, phone_number, response_category, 
                   timestamp, recording_url, recording_length, list_id, final_transcription
            FROM calls 
            WHERE call_id = :call_id
        """
        
        call = await db.fetch_one(query, values={"call_id": call_id})
        
        if not call:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Call not found"
            )
        
        return CallResponse(**dict(call))
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def create_call(
    call_data: CallCreate,
    db: Database = Depends(get_database)
):
    """Create a new call."""
    try:
        # verify client exists
        client_check_query = "SELECT client_id FROM clients WHERE client_id = :client_id"
        client_exists = await db.fetch_one(
            client_check_query, 
            values={"client_id": call_data.client_id}
        )
        
        if not client_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Client ID does not exist"
            )
        
        # insert new call
        insert_query = """
            INSERT INTO calls (client_id, phone_number, response_category, 
                             recording_url, recording_length, list_id, final_transcription)
            VALUES (:client_id, :phone_number, :response_category, 
                    :recording_url, :recording_length, :list_id, :final_transcription)
            RETURNING *
        """
        
        new_call = await db.fetch_one(insert_query, values=call_data.dict())
        
        return SuccessResponse(
            message="Call created successfully",
            call=CallResponse(**dict(new_call))
        )
        
    except HTTPException:
        raise
    except Exception as e:
        # handle foreign key violations
        if "foreign key constraint" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid client_id"
            )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/batch", response_model=CallBatchResponse, status_code=status.HTTP_201_CREATED)
async def create_calls_batch(
    batch_data: CallBatchCreate,
    db: Database = Depends(get_database)
):
    """Create multiple calls in batch."""
    if len(batch_data.calls) > settings.api.max_batch_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {settings.api.max_batch_size} calls per batch"
        )
    
    try:
        # start transaction
        async with db.transaction():
            unique_client_ids = list(set(call_data.client_id for call_data in batch_data.calls))
            
            # Single query to check all client IDs exist using IN clause
            placeholders = ','.join([f':client_id_{i}' for i in range(len(unique_client_ids))])
            existing_clients_query = f"""
                SELECT client_id FROM clients 
                WHERE client_id IN ({placeholders})
            """
            
            # Create parameter dict for each client_id
            client_params = {f'client_id_{i}': client_id for i, client_id in enumerate(unique_client_ids)}
            
            existing_clients = await db.fetch_all(
                existing_clients_query, 
                values=client_params
            )
            
            existing_client_ids = {row["client_id"] for row in existing_clients}
            
            # Check for any missing client IDs
            for call_data in batch_data.calls:
                if call_data.client_id not in existing_client_ids:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Client ID {call_data.client_id} does not exist"
                    )
            
            insert_query = """
                INSERT INTO calls (client_id, phone_number, response_category, 
                                 recording_url, recording_length, list_id, final_transcription)
                VALUES (:client_id, :phone_number, :response_category, 
                        :recording_url, :recording_length, :list_id, :final_transcription)
                RETURNING *
            """
            
            # Prepare list of dicts for each call
            insert_values = [
                {
                    "client_id": call.client_id,
                    "phone_number": call.phone_number,
                    "response_category": call.response_category,
                    "recording_url": call.recording_url,
                    "recording_length": call.recording_length,
                    "list_id": call.list_id,
                    "final_transcription": call.final_transcription
                }
                for call in batch_data.calls
            ]
            
            # Execute all inserts within the transaction
            inserted_calls = []
            for values in insert_values:
                row = await db.fetch_one(insert_query, values=values)
                inserted_calls.append(CallResponse(**dict(row)))
            
            return CallBatchResponse(
                message=f"{len(inserted_calls)} calls created successfully",
                calls=inserted_calls
            )
            
    except HTTPException:
        raise
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.put("/{call_id}", response_model=SuccessResponse)
async def update_call(
    call_id: int,
    call_data: CallUpdate,
    db: Database = Depends(get_database)
):
    """Update call by ID."""
    if call_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid call ID"
        )
    
    try:
        # verify client exists
        client_check_query = "SELECT client_id FROM clients WHERE client_id = :client_id"
        client_exists = await db.fetch_one(
            client_check_query, 
            values={"client_id": call_data.client_id}
        )
        
        if not client_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Client ID does not exist"
            )
        
        # update call
        update_query = """
            UPDATE calls 
            SET client_id = :client_id, phone_number = :phone_number, 
                response_category = :response_category, recording_url = :recording_url, 
                recording_length = :recording_length, list_id = :list_id, 
                final_transcription = :final_transcription
            WHERE call_id = :call_id
            RETURNING *
        """
        
        values = call_data.dict()
        values["call_id"] = call_id
        
        updated_call = await db.fetch_one(update_query, values=values)
        
        if not updated_call:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Call not found"
            )
        
        return SuccessResponse(
            message="Call updated successfully",
            call=CallResponse(**dict(updated_call))
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.delete("/{call_id}", response_model=SuccessResponse)
async def delete_call(
    call_id: int,
    db: Database = Depends(get_database)
):
    """Delete call by ID."""
    if call_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid call ID"
        )
    
    try:
        delete_query = "DELETE FROM calls WHERE call_id = :call_id RETURNING *"
        deleted_call = await db.fetch_one(delete_query, values={"call_id": call_id})
        
        if not deleted_call:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Call not found"
            )
        
        return SuccessResponse(
            message="Call deleted successfully",
            call=CallResponse(**dict(deleted_call))
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

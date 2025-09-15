# Response Categories Database Storage Guide

## Database Schema Recommendations

### 1. Primary Response Categories (Main Categories)
Store these exact values in your `calls.response_category` column:

```sql
-- Standard call outcomes
'Interested'              -- Positive response, wants more info
'Not_Interested'          -- Polite decline
'Answering_Machine'       -- Voicemail/answering machine detected
'DNC'                     -- Do Not Call request
'DNQ'                     -- Does Not Qualify (doesn't meet criteria)
'Unknown'                 -- Unclear/undetermined response
'User_Silent'             -- Person answered but didn't respond
'HUMAN'                   -- Human answered (general)
'ANSWERED'                -- Call was answered
'VOICEMAIL'               -- Went to voicemail
'NO_ANSWER'               -- No one answered
'BUSY'                    -- Line was busy
'FAILED'                  -- Call failed technically
'ERROR'                   -- System error during call
'EXTERNAL_RECORDING'      -- Recording from external system
```

### 2. Database Table Structure

```sql
CREATE TABLE calls (
    call_id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(client_id),
    phone_number VARCHAR(20) NOT NULL,
    response_category VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recording_url TEXT,
    recording_length INTEGER,
    list_id VARCHAR(100),
    speech_text TEXT,
    -- Add constraint to ensure valid categories
    CONSTRAINT valid_response_category CHECK (
        response_category IN (
            'Interested', 'Not_Interested', 'Answering_Machine',
            'DNC', 'DNQ', 'Unknown', 'User_Silent', 'HUMAN',
            'ANSWERED', 'VOICEMAIL', 'NO_ANSWER', 'BUSY',
            'FAILED', 'ERROR', 'EXTERNAL_RECORDING'
        )
    )
);

-- Index for fast filtering
CREATE INDEX idx_calls_response_category ON calls(response_category);
CREATE INDEX idx_calls_timestamp ON calls(timestamp);
```

### 3. Category Hierarchy and Grouping

```typescript
// Group similar categories for analysis
const categoryGroups = {
  positive: ['Interested', 'ANSWERED', 'HUMAN'],
  negative: ['Not_Interested', 'DNC'],  
  neutral: ['DNQ', 'Unknown', 'User_Silent'],
  technical: ['Answering_Machine', 'VOICEMAIL', 'NO_ANSWER', 'BUSY'],
  errors: ['FAILED', 'ERROR'],
  external: ['EXTERNAL_RECORDING']
}
```

### 4. Color Coding System

```typescript
const getCategoryColor = (category: string) => {
  switch (category.toUpperCase()) {
    // Positive outcomes - Green
    case 'INTERESTED':
    case 'ANSWERED':
    case 'HUMAN':
      return 'bg-green-100 text-green-800'
    
    // Negative outcomes - Red  
    case 'NOT_INTERESTED':
    case 'DNC':
      return 'bg-red-100 text-red-800'
    
    // Technical/Voicemail - Blue
    case 'ANSWERING_MACHINE':
    case 'VOICEMAIL':
      return 'bg-blue-100 text-blue-800'
    
    // No contact - Yellow
    case 'NO_ANSWER':
    case 'BUSY':
    case 'USER_SILENT':
      return 'bg-yellow-100 text-yellow-800'
    
    // Qualification issues - Orange
    case 'DNQ':
      return 'bg-orange-100 text-orange-800'
    
    // Errors - Red (darker)
    case 'FAILED':
    case 'ERROR':
      return 'bg-red-200 text-red-900'
    
    // External/Unknown - Purple/Gray
    case 'EXTERNAL_RECORDING':
      return 'bg-purple-100 text-purple-800'
    case 'UNKNOWN':
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
```

## Best Practices

### 1. Data Consistency
- Always store categories with exact casing: `Interested` not `interested`
- Use underscores for multi-word categories: `Not_Interested`
- Validate input before saving to database

### 2. Migration Strategy
If you have existing data with different formats:

```sql
-- Update existing inconsistent data
UPDATE calls SET response_category = 'Interested' 
WHERE LOWER(response_category) IN ('interested', 'INTERESTED');

UPDATE calls SET response_category = 'Not_Interested' 
WHERE LOWER(response_category) IN ('not interested', 'not_interested', 'NOT_INTERESTED');

UPDATE calls SET response_category = 'Answering_Machine'
WHERE LOWER(response_category) IN ('answering machine', 'answering_machine', 'voicemail');
```

### 3. API Standardization

```typescript
// Always normalize categories before saving
const normalizeCategory = (category: string): string => {
  const normalized = category.trim().replace(/\s+/g, '_');
  
  const mapping: {[key: string]: string} = {
    'interested': 'Interested',
    'not_interested': 'Not_Interested', 
    'answering_machine': 'Answering_Machine',
    'do_not_call': 'DNC',
    'does_not_qualify': 'DNQ',
    'unknown': 'Unknown'
  };
  
  return mapping[normalized.toLowerCase()] || normalized;
};
```

### 4. Reporting and Analytics

```sql
-- Get category distribution
SELECT 
    response_category,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM calls 
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY response_category
ORDER BY count DESC;

-- Group by category type
SELECT 
    CASE 
        WHEN response_category IN ('Interested', 'ANSWERED', 'HUMAN') THEN 'Positive'
        WHEN response_category IN ('Not_Interested', 'DNC') THEN 'Negative'
        WHEN response_category IN ('Answering_Machine', 'VOICEMAIL') THEN 'Voicemail'
        WHEN response_category IN ('NO_ANSWER', 'BUSY') THEN 'No Contact'
        ELSE 'Other'
    END as category_type,
    COUNT(*) as count
FROM calls 
GROUP BY category_type
ORDER BY count DESC;
```

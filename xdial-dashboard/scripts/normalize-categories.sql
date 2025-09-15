-- Migration script to normalize response categories
-- Run this script to standardize existing response category data

BEGIN;

-- Create backup table
CREATE TABLE calls_backup_categories AS 
SELECT call_id, response_category as old_response_category 
FROM calls;

-- Normalize common variations
UPDATE calls SET response_category = 'Interested' 
WHERE LOWER(TRIM(response_category)) IN ('interested', 'INTERESTED');

UPDATE calls SET response_category = 'Not_Interested' 
WHERE LOWER(TRIM(response_category)) IN (
    'not interested', 'not_interested', 'NOT_INTERESTED', 
    'notinterested', 'not-interested'
);

UPDATE calls SET response_category = 'Answering_Machine'
WHERE LOWER(TRIM(response_category)) IN (
    'answering machine', 'answering_machine', 'ANSWERING_MACHINE',
    'answer machine', 'answer_machine', 'answeringmachine',
    'voicemail', 'VOICEMAIL', 'voice mail'
);

UPDATE calls SET response_category = 'DNC'
WHERE LOWER(TRIM(response_category)) IN (
    'do not call', 'do_not_call', 'DO_NOT_CALL',
    'dnc', 'DNC', 'do-not-call', 'donotcall'
);

UPDATE calls SET response_category = 'DNQ' 
WHERE LOWER(TRIM(response_category)) IN (
    'does not qualify', 'does_not_qualify', 'DOES_NOT_QUALIFY',
    'dnq', 'DNQ', 'do-not-qualify', 'doesnotqualify'
);

UPDATE calls SET response_category = 'Unknown'
WHERE LOWER(TRIM(response_category)) IN (
    'unknown', 'UNKNOWN', 'unclear', 'UNCLEAR', 'other', 'OTHER'
);

UPDATE calls SET response_category = 'User_Silent'
WHERE LOWER(TRIM(response_category)) IN (
    'user silent', 'user_silent', 'USER_SILENT', 'silent', 'SILENT',
    'no response', 'no_response', 'NO_RESPONSE'
);

-- Standardize technical categories
UPDATE calls SET response_category = 'HUMAN'
WHERE LOWER(TRIM(response_category)) IN ('human', 'HUMAN', 'person', 'PERSON');

UPDATE calls SET response_category = 'ANSWERED'
WHERE LOWER(TRIM(response_category)) IN ('answered', 'ANSWERED', 'answer', 'ANSWER');

UPDATE calls SET response_category = 'VOICEMAIL'
WHERE LOWER(TRIM(response_category)) IN ('voicemail', 'VOICEMAIL', 'vm', 'VM');

UPDATE calls SET response_category = 'NO_ANSWER'
WHERE LOWER(TRIM(response_category)) IN (
    'no answer', 'no_answer', 'NO_ANSWER', 'noanswer', 'NOANSWER'
);

UPDATE calls SET response_category = 'BUSY'
WHERE LOWER(TRIM(response_category)) IN ('busy', 'BUSY', 'busy signal', 'BUSY_SIGNAL');

UPDATE calls SET response_category = 'FAILED'
WHERE LOWER(TRIM(response_category)) IN ('failed', 'FAILED', 'fail', 'FAIL');

UPDATE calls SET response_category = 'ERROR'
WHERE LOWER(TRIM(response_category)) IN ('error', 'ERROR', 'err', 'ERR');

-- Set any remaining unrecognized categories to 'Unknown'
UPDATE calls SET response_category = 'Unknown'
WHERE response_category NOT IN (
    'Interested', 'Not_Interested', 'Answering_Machine', 'DNC', 'DNQ', 
    'Unknown', 'User_Silent', 'HUMAN', 'ANSWERED', 'VOICEMAIL', 
    'NO_ANSWER', 'BUSY', 'FAILED', 'ERROR', 'EXTERNAL_RECORDING'
);

-- Add constraint to prevent future invalid values
ALTER TABLE calls 
ADD CONSTRAINT valid_response_category CHECK (
    response_category IN (
        'Interested', 'Not_Interested', 'Answering_Machine',
        'DNC', 'DNQ', 'Unknown', 'User_Silent', 'HUMAN',
        'ANSWERED', 'VOICEMAIL', 'NO_ANSWER', 'BUSY',
        'FAILED', 'ERROR', 'EXTERNAL_RECORDING'
    )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_calls_response_category ON calls(response_category);
CREATE INDEX IF NOT EXISTS idx_calls_timestamp_category ON calls(timestamp, response_category);

-- Show migration summary
SELECT 
    'Migration Summary' as report_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT response_category) as unique_categories
FROM calls;

SELECT 
    response_category,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM calls 
GROUP BY response_category
ORDER BY count DESC;

COMMIT;

-- Add customizable caregiver labels for inclusive language
-- This allows users to define who the caregivers are instead of defaulting to "Mom/Dad"

-- Add caregiver configuration to user_settings table
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS caregiver1_label TEXT DEFAULT 'Mom',
ADD COLUMN IF NOT EXISTS caregiver1_emoji TEXT DEFAULT '💗',
ADD COLUMN IF NOT EXISTS caregiver2_label TEXT DEFAULT 'Dad',
ADD COLUMN IF NOT EXISTS caregiver2_emoji TEXT DEFAULT '💙',
ADD COLUMN IF NOT EXISTS both_label TEXT DEFAULT 'Both',
ADD COLUMN IF NOT EXISTS both_emoji TEXT DEFAULT '💜';

-- Update existing user_settings records to have default values
UPDATE public.user_settings
SET caregiver1_label = COALESCE(caregiver1_label, 'Mom'),
    caregiver1_emoji = COALESCE(caregiver1_emoji, '💗'),
    caregiver2_label = COALESCE(caregiver2_label, 'Dad'),
    caregiver2_emoji = COALESCE(caregiver2_emoji, '💙'),
    both_label = COALESCE(both_label, 'Both'),
    both_emoji = COALESCE(both_emoji, '💜')
WHERE caregiver1_label IS NULL OR caregiver2_label IS NULL OR both_label IS NULL;

-- Note: The parent_preferences table uses 'mom', 'dad', 'both', 'neither' as internal codes
-- The labels above are just for display purposes
-- This maintains backward compatibility while allowing customization

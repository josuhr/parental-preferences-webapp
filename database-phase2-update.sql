-- Phase 2 Schema Update: Add Preference Level
-- This adds the missing "preference_level" dimension to match Google Sheets functionality

-- Add preference_level column to activities table
ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS preference_level TEXT DEFAULT 'drop_anything' 
CHECK (preference_level IN ('drop_anything', 'sometimes', 'on_your_own'));

-- Update existing activities to have default preference level
UPDATE public.activities
SET preference_level = 'drop_anything'
WHERE preference_level IS NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_activities_preference_level 
    ON public.activities(preference_level);

-- Note: This column indicates HOW MUCH parents like the activity:
-- 'drop_anything' = "💚 Drop Anything - Love to do!"
-- 'sometimes' = "💛 Sometimes - Sounds fun!"
-- 'on_your_own' = "⭐ On Your Own - You can do this!"

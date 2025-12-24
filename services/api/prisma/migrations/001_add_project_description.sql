-- Migration: Add description field to Project table
-- This migration adds an optional description field to the Project table

-- Add description column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Project' AND column_name = 'description'
    ) THEN
        ALTER TABLE "Project" ADD COLUMN "description" TEXT;
    END IF;
END $$;

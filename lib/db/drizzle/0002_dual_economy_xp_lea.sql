-- Add dual economy columns: xp (experience points) and lea_balance (cashback)
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lea_balance NUMERIC(10,2) NOT NULL DEFAULT '0.00';

-- Backfill xp from existing total_points for all users
UPDATE users SET xp = total_points WHERE xp = 0 AND total_points > 0;

-- Backfill lea_balance based on XP_TO_LEA_RATE = 0.01
UPDATE users SET lea_balance = (total_points * 0.01) WHERE lea_balance = 0 AND total_points > 0;

-- Owner confirmed the business flyer values in the 2026-11-05 development discussion.
-- This classification update is for synthetic local UAT reference events only.
UPDATE `uat_scenario_entries` SET `source`='OWNER_CONFIRMED_FLYER' WHERE `source`='UNVERIFIED_FLYER';
ALTER TABLE `uat_scenario_entries` MODIFY `source` VARCHAR(32) NOT NULL DEFAULT 'OWNER_CONFIRMED_FLYER';

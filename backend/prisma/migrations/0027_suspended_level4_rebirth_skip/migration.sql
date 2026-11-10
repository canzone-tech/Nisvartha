-- A permanently skipped level-4 rebirth is an immutable position event.
-- Historical completed positions retain NULL; no old earnings/placements change.
-- A level-5 completion may legitimately have three rebirths when its level-4
-- source event was skipped during member suspension.
ALTER TABLE `matrix_positions`
 ADD COLUMN `level4RebirthSkippedAt` DATETIME(3) NULL;

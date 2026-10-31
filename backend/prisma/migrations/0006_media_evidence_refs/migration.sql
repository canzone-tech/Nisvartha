-- P1 FR-021/023: attach private rights/consent register IDs to media approval.
-- Nullable for pre-existing uploaded media; new upload and new approval require both.
-- Do not store consent documents, personal data, or public URLs in these columns.
ALTER TABLE `cms_media`
 ADD COLUMN `rightsEvidenceRef` VARCHAR(120) NULL,
 ADD COLUMN `consentEvidenceRef` VARCHAR(120) NULL;

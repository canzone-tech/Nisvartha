# Nisvartha FR-021/023 — Private local media operations

## Locked storage decision

Media lives on the **same Nisvartha host/project deployment** in a durable, private filesystem directory, not in S3 or an external bucket. Example location: `/srv/nisvartha/shared/media`. Set its **absolute** path using backend `MEDIA_STORAGE_ROOT`. The directory must persist across releases and container restarts; for containers bind-mount the same host directory to the exact configured path. Do not use GitHub, `frontend/public`, temporary CI storage, the Docker writable container layer or the Next.js deployment directory as the durable store. Version-control rules exclude conventional local `storage/` paths.

Keep the volume under the application's dedicated Unix account, owner-only permissions (0700 dirs, 0600 files), outside all static web roots and behind a quota/monitoring alert. Only NestJS can read/write it. Ensure Node's process account can create `.incoming/` and `objects/`. Names are UUID-derived; original filenames and untrusted paths are discarded.

MySQL 8.4 owns **media identity, metadata, rights confirmation, actor/audit, review and publication state**. Image bytes live in the private volume. **Back up and restore both**, from the same consistent backup window. A database backup alone does not recover the gallery.

## Accepted formats and safety boundaries

- P1 supports JPEG, PNG and WebP **images only**, maximum 5 MiB source and 16 megapixels. Videos, SVG and arbitrary documents are not accepted.
- Original uploads are written to private `.incoming/` with exclusive creation, passed to the local scanner and then sanitized through Sharp/libvips into a maximum 1920×1920 WebP image, stripping original EXIF, GPS data and source format. Original staging is deleted on success/failure.
- **Production uploads fail closed without local ClamAV** (`clamscan` on the host, updated signature database). `MEDIA_SCANNER_BIN` is forced to `clamscan` when `NODE_ENV=production`. Availability, signature updates, scanner timeout and disk capacity must be monitored. A scan error returns a safe error and must never publish the input.
- `scripts/ci-media-scanner.sh` is a scanner **test double only** to verify the integration contract and fail-closed behavior in isolated CI; it is **not antivirus software and must never be deployed as the production scanner**.
- Uploads require authenticated EDITOR/ADMIN, nonempty accessible alt text, a title, asserted rights and consent **plus opaque references to both records in the Foundation's controlled private evidence register**. These IDs are checked by the approver; a checkbox or register ID is not itself legal proof. Existing pre-migration rows remain readable, but cannot receive a new approval if references are missing. Never place consent documents, participant names, phone numbers or private URLs in the reference fields. Status lifecycle is DRAFT → SUBMITTED → APPROVED/REJECTED, with independent approver. Uploader cannot self-approve.
- Images are served from NestJS only when approved. Public Next.js `/gallery` lists approved records; `/api/media/:id` proxies only approved sanitized WebP. Neither the original nor an unapproved image has a public storage URL. Archive revokes listing and future reads; response caching is disabled on the Next.js proxy.
- Before each approved-file HTTP response, NestJS opens the **generated local filename** with `O_NOFOLLOW`, verifies the opened descriptor is a regular file with the exact recorded length, reads up to the established 5 MiB processed-image limit, and compares SHA-256 with the authoritative MySQL `cms_media` record. Missing, tampered or symlink-backed files return 404 **before any bytes are streamed**. The per-read integrity check closes the gap between periodic operator reconciliation runs. The production media directory and its ancestors must remain under trusted operator ownership; this does not replace disk permissions, consent verification, ClamAV or an approved backup policy.


## Activation

1. Provision private persistent disk and an **updated local ClamAV installation** before enabling media uploads. Keep Node server `MEDIA_STORAGE_ROOT` and OS ownership correct, with image upload size limits in reverse proxy as well as NestJS.
2. Configure `API_INTERNAL_URL` on Next.js and the existing `CMS_PUBLIC_CONTENT_ENABLED` publication flag after editorial approval. The separate `PUBLIC_CONTENT_APPROVED` SEO gate remains intact.
3. Enforce HTTPS, independent staff approvals and actual documented image-rights/participant-consent evidence. The UI checkbox is **an assertion, not proof of consent**: retain external evidence in the Foundation's controlled register. No face recognition, automatic consent inference or media publication by uploader.
4. Operator should arrange image capacity alerts, secure scanning signatures, backup encryption, rotation, periodic restores and media orphan/DB reconciliation. Failed scanner or missing persistent directory must block uploads, not silently redirect to ephemeral storage.
5. No S3/environment-wide external media service; any hosting or backup changes require owner approval.

## Backup/restore gates

Before taking a backup, make a point-in-time MySQL backup with `mysqldump --single-transaction` (or a supported consistent database snapshot) and take an image of `MEDIA_STORAGE_ROOT/objects` in the same quiesced interval. Keep encrypted copies off the one storage disk; the backup target is a recovery concern, **not a live media bucket**. A crash between disk write and DB insert can leave an unreferenced sanitized image; reconcile by ID/sha256, do not serve by file path.

Recovery in an isolated staging environment: restore database, restore `objects/` into a private owner-only volume, verify every approved `cms_media.fileKey` exists, size and SHA-256 match `cms_media.sha256`, then run the gallery and archived-image smoke. Never blindly overwrite the authoritative production data. The automated synthetic backup/restore and image tests validate mechanics, not the Foundation's eventual external backup service-level objective.

The local verification entry point remains `npm run verify`; it uses an isolated test filesystem and test scanner. It does **not** set up a production host or claim antivirus-signature coverage.

## Known limitations

P1 is **images-only**; gallery category/collection grouping, video upload/transcode, actual consent document attachment, media replacement/version history, malware-signature update monitoring and an official encrypted backup policy remain open requirements. Do not declare all media operations production-ready until those gates are approved and independently checked.

# Client HTML v1.1 — exact design and content preview

Client-supplied ZIP: `nisvartha-foundation-html-website-bundle-v1.1.zip` (30 October 2026). Its **18 HTML documents and original CSS/JavaScript** are stored without text changes in three lossless Brotli/base64 parts, with independently validated SHA-256 digests in `frontend/vendor/client-bundle-v1.1.manifest.json`. No headings, content, warnings, form labels, text or template styling are rewritten.

## Run exact visual preview

On a clean checkout of this draft feature branch, run:

```sh
NISVARTHA_UAT_CLIENT_TEMPLATE=exact npm run uat:local
```

Open `http://127.0.0.1:3102/` and client paths such as `/about`, `/activities`, `/membership`, `/gallery`, `/contact`, `/privacy-policy`, and `/auto-pool-plan` (**review-only**). Original `.html` links also work; CSS and JS are byte-identical. Interactive local UAT now defaults to the approved client design. Use `NISVARTHA_UAT_CLIENT_TEMPLATE=off npm run uat:local` only for baseline verification. Preview still requires localhost HTTP with `PUBLIC_CONTENT_APPROVED=false`.

## Safety and functionality

This is an **exact client visual-content preview**, not a live replacement for Next.js public/CMS-rendered routes. Normal `npm run verify` and production builds preserve the existing frontend and backend. Preview rewrites only the supplied public pages; Admin and `/member/*` keep their protected Next.js routes.

The Contact and Volunteer pages contain **demo forms**; unchanged client JavaScript never stores or transmits submissions. The client Login/Register links still point to their external placeholder portal. Client copy includes an unverified phone number, draft privacy/terms, external Unsplash illustrative photos and an Auto Pool Plan marked review-pending. These are client-provided text, **not** confirmed facts or permission to accept payments, issue paid E-PINs or pay referral/matrix commissions. Do not use the preview for real registrations.

Before production launch, the Foundation must approve legal/contact facts, photo rights, policy wording, actual member URLs and CMS-to-template integration. A later functionality-preserving Next.js adaptation can keep verified client text/design unchanged and connect live CMS/form data without disabling their authoritative backend contracts.

## Regression contract

`node scripts/test-client-bundle.mjs` verifies all 20 original source files. `npm run verify` and Web CI compile the exact public template and compare every HTML response against the source, along with CSS/JS, noindex and secure Admin/member routes; they rebuild with the feature OFF afterward. Production preflight rejects the preview flag.

No database schema, applied migration or financial module is changed by this client-design PR.

## Unified Next.js shell

The shared SiteHeader and footer now reproduce the client's navy bar, logo treatment, page labels, navigation and footer content. Admin, CMS, E-PIN policy preview, member login/register use the same navy/green/gold tokens, typography, cards, forms and responsive menu. Backend RBAC, member flag gates and all financial HOLD contracts remain unchanged. The 18 client source HTML pages and original CSS/JS remain byte-identical. Next.js member links are routed internally; the static client HTML continues to use the client's exact original external URLs.

## Integrated member navigation

Only generated local UAT HTML link `href` attributes are adapted from the supplied external member portal to the existing `/member/login` and `/member/register` routes. The original source pages remain hash-verifiable and text/CSS/JS remains byte-identical; no `Login` or `Register` copy is rewritten. Route guards still decide whether the actual member pages are available. The regression test reverses link rewrites and compares the complete HTML documents with the client originals, preventing accidental text changes.

## Production-compatible source-aligned public rendering

All normal Next.js public routes now render the client v1.1 main-page copy from one hash-verified compressed source. The original text, headings, photo references and page structure are preserved; server-side layout uses the same client CSS. Published CMS project, activity, news, gallery and page records remain visible as separately approved dynamic sections, and `/projects/[slug]` retains its guarded detail route. Contact and Volunteer keep the original non-transmitting demo form until independently approved privacy flags enable the authoritative real enquiry form (at which point the demo form is visually hidden, not used for submission). Client `/login` and `/register` copy remains informational; working user authentication is on `/member/login` and `/member/register` when approved flags permit. The proposed Auto Pool Plan remains 404 outside isolated client prototype UAT. This is no authority for live financial operations.

The original static-only preview is still available for byte-level visual comparisons; normal Next.js public rendering is no longer dependent on it. The generated client-content JSON is verified byte-for-byte against the immutable vendor archive in `npm run verify`.

### Mobile diagram correction

Original client `how-it-works.html` placed nine second-row circles slightly wider than a 390px screen. The runtime Next.js CSS and generated static local UAT add a narrow-only `<style>` correction without changing the source HTML, diagram labels, wording, or any payment behavior. Regression checks reverse this presentation-only adapter to establish exact source integrity.

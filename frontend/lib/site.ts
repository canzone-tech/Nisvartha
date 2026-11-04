export const siteName = 'Nisvartha Foundation';
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3102';
export const contentApproved = process.env.PUBLIC_CONTENT_APPROVED === 'true';

export type PublicPage = {
  slug: string;
  title: string;
  lead: string;
  description: string;
  sections: { title: string; body: string }[];
  publication: 'PENDING' | 'INFORMATIONAL';
};

export const pages: PublicPage[] = [
  { slug: 'about', title: 'About the Foundation', lead: 'Our identity and governance', description: 'Foundation profile and governance information.', publication: 'PENDING', sections: [
    { title: 'Verified information first', body: 'Our legal identity, registration information and governance profile will appear after authorized verification.' },
    { title: 'Our objectives', body: 'A formal statement of our vision, mission and objectives is being prepared for publication.' }] },
  { slug: 'activities', title: 'Activities', lead: 'Our areas of activity', description: 'Learn about Foundation activities.', publication: 'PENDING', sections: [
    { title: 'Activity updates', body: 'Activities will be listed here when their details, dates and supporting information have been approved.' }] },
  { slug: 'go-green', title: 'Go Green', lead: 'Environmental initiatives', description: 'Environmental initiatives and campaigns.', publication: 'PENDING', sections: [
    { title: 'Environmental participation', body: 'Details of verified campaigns, volunteer opportunities and outcomes will be published here after review.' }] },
  { slug: 'projects', title: 'Projects', lead: 'Work in progress', description: 'Approved Foundation projects and outcomes.', publication: 'PENDING', sections: [
    { title: 'Project directory', body: 'No project records have been approved for public publication yet. Dates, locations and impact figures will only appear once evidenced.' }] },
  { slug: 'volunteer', title: 'Volunteer with us', lead: 'Offer your time and skills', description: 'Send your interest in volunteering.', publication: 'INFORMATIONAL', sections: [
    { title: 'Volunteer enquiries', body: 'Share your interests and availability. Submitting an enquiry does not create membership or guarantee an assignment.' }] },
  { slug: 'donate', title: 'Donations', lead: 'Information before giving', description: 'Donation policy and verified channels.', publication: 'PENDING', sections: [
    { title: 'No payment collection', body: 'Donation instructions and tax-related claims will appear only after authorized verification. This website does not collect payments.' }] },
  { slug: 'membership', title: 'Membership', lead: 'Understand the programme', description: 'Membership information and enquiries.', publication: 'PENDING', sections: [
    { title: 'Membership is not a donation', body: 'Eligibility, benefits, cancellation and refund terms are pending approval. No membership purchase or entitlement is offered here.' }] },
  { slug: 'how-it-works', title: 'How it works', lead: 'A clear path to participation', description: 'Learn how to engage with the Foundation.', publication: 'INFORMATIONAL', sections: [
    { title: 'Explore', body: 'Read published information about activities and projects.' },
    { title: 'Connect', body: 'Send a contact or volunteer enquiry once the privacy notice and submission service are approved.' },
    { title: 'Follow up', body: 'Keep the reference number returned after a successful submission.' }] },
  { slug: 'gallery', title: 'Gallery', lead: 'Documenting our activities', description: 'Approved Foundation media.', publication: 'PENDING', sections: [
    { title: 'Media approval', body: 'Photos and videos will be published only after rights, captions and participant consent are verified.' }] },
  { slug: 'news-events', title: 'News & events', lead: 'Latest verified updates', description: 'Published news and events.', publication: 'PENDING', sections: [
    { title: 'Announcements', body: 'No announcements have been approved for publication. Event times and locations will be displayed only when confirmed.' }] },
  { slug: 'contact', title: 'Contact us', lead: 'Get in touch', description: 'Contact the Foundation.', publication: 'INFORMATIONAL', sections: [
    { title: 'Official contact details', body: 'The official contact channels are awaiting authorized confirmation.' }] },
  { slug: 'login', title: 'Member login', lead: 'Not yet available', description: 'Member portal release status.', publication: 'PENDING', sections: [
    { title: 'No demo login', body: 'Member authentication is planned for a separately approved phase.' }] },
  { slug: 'register', title: 'Registration', lead: 'Not yet available', description: 'Member registration release status.', publication: 'PENDING', sections: [
    { title: 'No registration', body: 'Member registration and activation require a future approved workflow. This site is not enrolling members.' }] },
  { slug: 'privacy-policy', title: 'Privacy policy', lead: 'Formal policy pending approval', description: 'Privacy policy publication status.', publication: 'PENDING', sections: [
    { title: 'Review required', body: 'The formal privacy notice and data rights contact must be authorized before enabling personal-data forms.' }] },
  { slug: 'terms', title: 'Terms of use', lead: 'Formal terms pending approval', description: 'Terms publication status.', publication: 'PENDING', sections: [
    { title: 'Review required', body: 'Website and programme-specific terms must be reviewed by the Foundation before publication.' }] },
  { slug: 'faq', title: 'Frequently Asked Questions', lead: 'Questions and answers', description: 'Information about the Foundation.', publication: 'INFORMATIONAL', sections: [] },
  { slug: 'accessibility', title: 'Accessibility', lead: 'An accessible experience', description: 'Accessibility information.', publication: 'INFORMATIONAL', sections: [
    { title: 'Our approach', body: 'This website targets keyboard access, visible focus indicators, semantic headings and responsive layout. Independent accessibility assessment remains required.' }] },
];

export const pageBySlug = new Map(pages.map((page) => [page.slug, page]));
export const navLinks = [
  ['/', 'Home'], ['/about', 'About'], ['/activities', 'Activities'],
  ['/go-green', 'Go Green'], ['/projects', 'Projects'],
  ['/volunteer', 'Volunteer'], ['/contact', 'Contact'],
] as const;
export function canonical(path: string) { return new URL(path, siteUrl).toString(); }

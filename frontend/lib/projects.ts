/**
 * P0 publication contract. Content must be approved by the Foundation before
 * it is added here. A missing approved record must never become a sample claim.
 */
export type Project = {
  slug: string;
  title: string;
  summary: string;
  objectives: string[];
  progress: string;
  category: 'COMMUNITY' | 'ENVIRONMENT' | 'EDUCATION' | 'OTHER';
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
  location?: string;
  startDate?: string;
  endDate?: string;
  outcomes?: string[];
  cover?: { src: string; alt: string; rightsConfirmed: true; consentConfirmed: true };
  approved: true;
  publishedAt: string;
};

// No projects are in this registry until evidence and publication approval arrive.
const entries: readonly Project[] = [];
export function publishedProjects(): readonly Project[] {
  return entries.filter(item => item.approved === true && Boolean(item.publishedAt));
}
export function getPublishedProject(slug: string): Project | undefined {
  return publishedProjects().find(item => item.slug === slug);
}

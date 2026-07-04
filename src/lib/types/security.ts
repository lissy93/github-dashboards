import type { Vulnerability, VulnSeverity } from './supply-chain';

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'na';
export type SecurityCheck = {
	name: string;
	status: CheckStatus;
	detail: string;
	hint?: string;
	url: string | null;
	weight: number;
};
export type BranchRules = { labels: string[]; approvals: number | null };
export type SecurityAlerts = {
	counts: Record<VulnSeverity, number>;
	total: number;
	top: Vulnerability[];
};
export type SecurityAdvisory = {
	id: string;
	summary: string;
	severity: VulnSeverity;
	publishedAt: string | null;
	url: string;
};
export type GradeLetter = 'A' | 'B' | 'C' | 'D' | 'F';
export type SecurityGrade = { score: number; letter: GradeLetter };
export type RepoSecurity = {
	checks: SecurityCheck[];
	passed: number;
	applicable: number;
	grade: SecurityGrade;
	alerts: SecurityAlerts | null;
	advisories: SecurityAdvisory[];
};

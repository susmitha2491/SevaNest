import {
  ReportItem,
  ReportCategory,
  ExportResult,
  IReportRepository,
  ReportFilterCriteria,
} from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';

export class MockReportRepository implements IReportRepository {
  private reports: ReportItem[] = [
    {
      id: 'REP-01',
      name: 'New Customer Acquisition by Period & Locality',
      category: 'Growth',
      description: 'Tracks customer onboarding velocity, mobile app signups, and neighborhood cluster penetration across Hyderabad.',
      lastRun: 'Recent Baseline',
      metricsSummary: [
        { label: 'Total Signups', value: '1,248', change: '+14.2%', isPositive: true },
        { label: 'Top Cluster', value: 'HITEC City (38%)' },
        { label: 'Signup-to-Booking Conversion', value: '42.8%', change: '+3.1%', isPositive: true },
      ],
      previewColumns: ['Locality Cluster', 'New Accounts', 'Active Bookers', 'Repeat Booking %'],
      previewRows: [
        { 'Locality Cluster': 'HITEC City', 'New Accounts': 480, 'Active Bookers': 210, 'Repeat Booking %': '43.7%' },
        { 'Locality Cluster': 'Madhapur', 'New Accounts': 310, 'Active Bookers': 135, 'Repeat Booking %': '43.5%' },
        { 'Locality Cluster': 'Gachibowli', 'New Accounts': 260, 'Active Bookers': 105, 'Repeat Booking %': '40.3%' },
        { 'Locality Cluster': 'Kondapur', 'New Accounts': 198, 'Active Bookers': 84, 'Repeat Booking %': '42.4%' },
      ],
    },
    {
      id: 'REP-02',
      name: 'Worker Registration & Onboarding Drop-off Funnel',
      category: 'Workforce',
      description: 'Analyzes friction stages in worker onboarding from initial mobile OTP to full KYC document submission.',
      lastRun: 'Recent Baseline',
      metricsSummary: [
        { label: 'Initiated Registrations', value: '840' },
        { label: 'Document Submissions', value: '620', change: '73.8% step rate' },
        { label: 'Complete Dossiers', value: '512', change: '60.9% full funnel' },
      ],
      previewColumns: ['Funnel Stage', 'Worker Count', 'Stage Conversion %', 'Drop-off Reasons'],
      previewRows: [
        { 'Funnel Stage': '1. Phone OTP Verified', 'Worker Count': 840, 'Stage Conversion %': '100%', 'Drop-off Reasons': 'N/A' },
        { 'Funnel Stage': '2. Skill Profile Selected', 'Worker Count': 750, 'Stage Conversion %': '89.2%', 'Drop-off Reasons': 'Incomplete Category Details' },
        { 'Funnel Stage': '3. Aadhaar Uploaded', 'Worker Count': 620, 'Stage Conversion %': '73.8%', 'Drop-off Reasons': 'Document Clarity Issues' },
        { 'Funnel Stage': '4. References Submitted', 'Worker Count': 512, 'Stage Conversion %': '60.9%', 'Drop-off Reasons': 'Awaiting Employer Contacts' },
      ],
    },
    {
      id: 'REP-03',
      name: 'Verification Conversion & Approval Ratio',
      category: 'Trust & Safety',
      description: 'Audit of 6-point verification pass rates, rejection breakdowns, and average document turnaround time.',
      lastRun: 'Recent Baseline',
      metricsSummary: [
        { label: 'Approved Dossiers', value: '468', change: '91.4% pass' },
        { label: 'Rejected Dossiers', value: '44', change: '8.6% fail' },
        { label: 'Avg Turnaround', value: '18.4 Hours' },
      ],
      previewColumns: ['Verification Check', 'Checks Conducted', 'Approved', 'Rejected', 'Pass Rate %'],
      previewRows: [
        { 'Verification Check': '1. Aadhaar ID & Photo', 'Checks Conducted': 512, Approved: 492, Rejected: 20, 'Pass Rate %': '96.1%' },
        { 'Verification Check': '2. Address Proof', 'Checks Conducted': 512, Approved: 485, Rejected: 27, 'Pass Rate %': '94.7%' },
        { 'Verification Check': '3. Emergency Contact Vetting', 'Checks Conducted': 512, Approved: 476, Rejected: 36, 'Pass Rate %': '92.9%' },
        { 'Verification Check': '4. Prior Employer Reference', 'Checks Conducted': 512, Approved: 470, Rejected: 42, 'Pass Rate %': '91.8%' },
        { 'Verification Check': '5. Police Clearance Certificate', 'Checks Conducted': 512, Approved: 468, Rejected: 44, 'Pass Rate %': '91.4%' },
      ],
    },
    {
      id: 'REP-04',
      name: 'Booking Requests vs Confirmed Conversion',
      category: 'Marketplace',
      description: 'End-to-end booking funnel from initial search request to active service commencement.',
      lastRun: 'Recent Baseline',
      metricsSummary: [
        { label: 'Total Booking Requests', value: '620' },
        { label: 'Interviews Scheduled', value: '510', change: '82.2%' },
        { label: 'Active Placements', value: '442', change: '71.3% conversion' },
      ],
      previewColumns: ['Service Category', 'Total Inquiries', 'Trial Scheduled', 'Service Confirmed', 'Net Conversion %'],
      previewRows: [
        { 'Service Category': 'House Maid', 'Total Inquiries': 280, 'Trial Scheduled': 240, 'Service Confirmed': 210, 'Net Conversion %': '75.0%' },
        { 'Service Category': 'Cook', 'Total Inquiries': 150, 'Trial Scheduled': 120, 'Service Confirmed': 102, 'Net Conversion %': '68.0%' },
        { 'Service Category': 'Driver', 'Total Inquiries': 110, 'Trial Scheduled': 88, 'Service Confirmed': 76, 'Net Conversion %': '69.1%' },
        { 'Service Category': 'Babysitter', 'Total Inquiries': 80, 'Trial Scheduled': 62, 'Service Confirmed': 54, 'Net Conversion %': '67.5%' },
      ],
    },
    {
      id: 'REP-05',
      name: 'Category-Wise Demand Distribution',
      category: 'Marketplace',
      description: 'Market share and volume analysis across all 6 active domestic service categories.',
      lastRun: 'Recent Baseline',
      metricsSummary: [
        { label: 'Dominant Category', value: 'House Maid (45.1%)' },
        { label: 'Fastest Growing', value: 'Cook (+22% MoM)' },
      ],
      previewColumns: ['Category', 'Active Bookings', 'Demand Share %', 'Avg Monthly Wage (INR)'],
      previewRows: [
        { Category: 'House Maid', 'Active Bookings': 210, 'Demand Share %': '45.1%', 'Avg Monthly Wage (INR)': '₹12,500' },
        { Category: 'Cook', 'Active Bookings': 102, 'Demand Share %': '21.9%', 'Avg Monthly Wage (INR)': '₹16,000' },
        { Category: 'Driver', 'Active Bookings': 76, 'Demand Share %': '16.3%', 'Avg Monthly Wage (INR)': '₹22,000' },
        { Category: 'Babysitter', 'Active Bookings': 54, 'Demand Share %': '11.6%', 'Avg Monthly Wage (INR)': '₹18,500' },
        { Category: 'Elderly Care Helper', 'Active Bookings': 24, 'Demand Share %': '5.1%', 'Avg Monthly Wage (INR)': '₹20,000' },
      ],
    },
    {
      id: 'REP-06',
      name: 'Area-Wise Demand & Cluster Heatmap',
      category: 'Marketplace',
      description: 'Geographic concentration of booking requests and supply density across operational clusters.',
      lastRun: 'Recent Baseline',
      metricsSummary: [
        { label: 'High Demand Zone', value: 'HITEC City & Gachibowli' },
        { label: 'Supply Surplus Cluster', value: 'Kukatpally' },
      ],
      previewColumns: ['Cluster Name', 'Open Demand', 'Active Supply', 'Match Ratio', 'Status'],
      previewRows: [
        { 'Cluster Name': 'HITEC City', 'Open Demand': 180, 'Active Supply': 142, 'Match Ratio': '0.78', Status: 'High Utilization' },
        { 'Cluster Name': 'Gachibowli', 'Open Demand': 140, 'Active Supply': 135, 'Match Ratio': '0.96', Status: 'Balanced' },
        { 'Cluster Name': 'Madhapur', 'Open Demand': 110, 'Active Supply': 118, 'Match Ratio': '1.07', Status: 'Balanced' },
        { 'Cluster Name': 'Kondapur', 'Open Demand': 90, 'Active Supply': 96, 'Match Ratio': '1.06', Status: 'Balanced' },
        { 'Cluster Name': 'Kukatpally', 'Open Demand': 40, 'Active Supply': 64, 'Match Ratio': '1.60', Status: 'Supply Surplus' },
      ],
    },
    {
      id: 'REP-07',
      name: 'Worker Utilization & Active Roster Ratio',
      category: 'Workforce',
      description: 'Proportion of verified workforce placed in active household engagements vs idle roster capacity.',
      lastRun: 'Recent Baseline',
      metricsSummary: [
        { label: 'Total Verified Roster', value: '468' },
        { label: 'Actively Engaged', value: '384', change: '82.1% utilization' },
        { label: 'Available for Dispatch', value: '84', change: '17.9% ready' },
      ],
      previewColumns: ['Skill Category', 'Total Roster', 'Engaged Workers', 'Available Workers', 'Utilization %'],
      previewRows: [
        { 'Skill Category': 'House Maid', 'Total Roster': 210, 'Engaged Workers': 180, 'Available Workers': 30, 'Utilization %': '85.7%' },
        { 'Skill Category': 'Cook', 'Total Roster': 115, 'Engaged Workers': 98, 'Available Workers': 17, 'Utilization %': '85.2%' },
        { 'Skill Category': 'Driver', 'Total Roster': 85, 'Engaged Workers': 68, 'Available Workers': 17, 'Utilization %': '80.0%' },
        { 'Skill Category': 'Babysitter', 'Total Roster': 58, 'Engaged Workers': 38, 'Available Workers': 20, 'Utilization %': '65.5%' },
      ],
    },
    {
      id: 'REP-08',
      name: 'Interview-to-Confirmation Conversion Rate',
      category: 'Marketplace',
      description: 'Evaluates trial outcome success rates, instant confirmations, and customer rematch triggers.',
      lastRun: 'Recent Baseline',
      metricsSummary: [
        { label: 'Total Trials', value: '510' },
        { label: 'Passed 1st Trial', value: '432', change: '84.7% success' },
        { label: 'Required 2nd Trial', value: '78', change: '15.3% rematch' },
      ],
      previewColumns: ['Trial Outcome', 'Instances', 'Percentage Share %', 'Primary Feedback Factors'],
      previewRows: [
        { 'Trial Outcome': 'Accepted & Confirmed', Instances: 432, 'Percentage Share %': '84.7%', 'Primary Feedback Factors': 'Punctuality, Clear Communication' },
        { 'Trial Outcome': 'Dietary/Skill Mismatch', Instances: 42, 'Percentage Share %': '8.2%', 'Primary Feedback Factors': 'Cook regional cuisine preference' },
        { 'Trial Outcome': 'Timing/Commute Incompatibility', Instances: 24, 'Percentage Share %': '4.7%', 'Primary Feedback Factors': 'Early morning start conflict' },
        { 'Trial Outcome': 'Customer Unresponsive', Instances: 12, 'Percentage Share %': '2.4%', 'Primary Feedback Factors': 'Customer cancelled post-schedule' },
      ],
    },
    {
      id: 'REP-09',
      name: 'Booking Cancellation Rate Analysis',
      category: 'Operations',
      description: 'Systematic review of booking cancellation causes across pre-trial, post-trial, and operational stages.',
      lastRun: 'Recent Baseline',
      metricsSummary: [
        { label: 'Total Placements', value: '480' },
        { label: 'Cancellations', value: '38', change: '7.9% cancellation rate' },
      ],
      previewColumns: ['Cancellation Stage', 'Count', 'Share %', 'Key Cause Category'],
      previewRows: [
        { 'Cancellation Stage': 'Pre-Interview Cancellation', Count: 14, 'Share %': '36.8%', 'Key Cause Category': 'Customer relocation / Change of plan' },
        { 'Cancellation Stage': 'Trial Rejection No Rematch', Count: 16, 'Share %': '42.1%', 'Key Cause Category': 'Candidate preference mismatch' },
        { 'Cancellation Stage': 'Operational Unavailability', Count: 8, 'Share %': '21.1%', 'Key Cause Category': 'Worker personal/medical emergency' },
      ],
    },
    {
      id: 'REP-10',
      name: 'Replacement Rate & Early Attrition Trends',
      category: 'Operations',
      description: 'Measures 30-day replacement requests, worker attrition triggers, and rematch turnaround times.',
      lastRun: 'Recent Baseline',
      metricsSummary: [
        { label: '30-Day Guarantee Claims', value: '28' },
        { label: 'Successful Rematches', value: '26', change: '92.8% fulfillment' },
        { label: 'Avg Rematch Time', value: '34 Hours' },
      ],
      previewColumns: ['Dispute Trigger', 'Replacement Count', 'Rematch Succeeded', 'Avg Resolution (Hrs)'],
      previewRows: [
        { 'Dispute Trigger': 'Attendance / Unannounced Absences', 'Replacement Count': 14, 'Rematch Succeeded': 13, 'Avg Resolution (Hrs)': '28.5' },
        { 'Dispute Trigger': 'Skill / Quality Mismatch', 'Replacement Count': 8, 'Rematch Succeeded': 8, 'Avg Resolution (Hrs)': '32.0' },
        { 'Dispute Trigger': 'Household Relocation', 'Replacement Count': 4, 'Rematch Succeeded': 3, 'Avg Resolution (Hrs)': '48.0' },
        { 'Dispute Trigger': 'Behavioral Friction', 'Replacement Count': 2, 'Rematch Succeeded': 2, 'Avg Resolution (Hrs)': '24.0' },
      ],
    },
    {
      id: 'REP-11',
      name: 'Complaint Frequency by Category & Resolution Turnaround',
      category: 'Support',
      description: 'Support grievance intake volume, dispute categorization, and SLA resolution performance.',
      lastRun: 'Recent Baseline',
      metricsSummary: [
        { label: 'Total Grievances', value: '74' },
        { label: 'Resolved within SLA', value: '68', change: '91.9% SLA compliance' },
        { label: 'Escalated to Ops', value: '6', change: '8.1% escalation rate' },
      ],
      previewColumns: ['Complaint Category', 'Tickets Logged', 'Resolved via Support', 'Escalated to Ops', 'Avg Turnaround (Hrs)'],
      previewRows: [
        { 'Complaint Category': 'Attendance Breach', 'Tickets Logged': 32, 'Resolved via Support': 28, 'Escalated to Ops': 4, 'Avg Turnaround (Hrs)': '4.2' },
        { 'Complaint Category': 'Payment & Payout Clarifications', 'Tickets Logged': 22, 'Resolved via Support': 22, 'Escalated to Ops': 0, 'Avg Turnaround (Hrs)': '1.8' },
        { 'Complaint Category': 'Replacement Rematch Demands', 'Tickets Logged': 14, 'Resolved via Support': 12, 'Escalated to Ops': 2, 'Avg Turnaround (Hrs)': '6.5' },
        { 'Complaint Category': 'Conduct / Misconduct Review', 'Tickets Logged': 6, 'Resolved via Support': 6, 'Escalated to Ops': 0, 'Avg Turnaround (Hrs)': '3.0' },
      ],
    },
    {
      id: 'REP-12',
      name: 'Gross Booking Value, Fee Realization & Refunds',
      category: 'Finance',
      description: 'Financial ledger analytics summarizing booking fees, placement commissions, subscriptions, and audited refunds.',
      lastRun: 'Recent Baseline',
      metricsSummary: [
        { label: 'Gross Platform Collections', value: '₹4,82,600' },
        { label: 'Platform Net Commission', value: '₹1,24,500' },
        { label: 'Total Refund Realization', value: '₹14,970', change: '3.1% refund rate' },
      ],
      previewColumns: ['Fee Classification', 'Gross Invoiced', 'Settled (INR)', 'Refunds Issued (INR)', 'Net Realization (INR)'],
      previewRows: [
        { 'Fee Classification': 'Booking / Matching Fees', 'Gross Invoiced': '₹1,80,000', 'Settled (INR)': '₹1,74,500', 'Refunds Issued (INR)': '₹5,500', 'Net Realization (INR)': '₹1,69,000' },
        { 'Fee Classification': 'Placement Commission', 'Gross Invoiced': '₹2,10,000', 'Settled (INR)': '₹2,02,000', 'Refunds Issued (INR)': '₹8,000', 'Net Realization (INR)': '₹1,94,000' },
        { 'Fee Classification': 'Monthly Subscriptions', 'Gross Invoiced': '₹72,600', 'Settled (INR)': '₹71,130', 'Refunds Issued (INR)': '₹1,470', 'Net Realization (INR)': '₹69,660' },
        { 'Fee Classification': 'Replacement Plan Add-ons', 'Gross Invoiced': '₹20,000', 'Settled (INR)': '₹20,000', 'Refunds Issued (INR)': '₹0', 'Net Realization (INR)': '₹20,000' },
      ],
    },
  ];

  async getReports(category?: ReportCategory, search?: string): Promise<ReportItem[]> {
    let result = this.reports;
    if (category && category !== 'ALL') {
      result = result.filter((r) => r.category === category);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
    }
    return JSON.parse(JSON.stringify(result));
  }

  async getReportById(id: string): Promise<ReportItem | null> {
    const rep = this.reports.find((r) => r.id === id);
    return rep ? JSON.parse(JSON.stringify(rep)) : null;
  }

  async generateExport(reportId: string, format: 'CSV' | 'PDF'): Promise<ExportResult> {
    const report = this.reports.find((r) => r.id === reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found.`);
    }

    let csvContent = '';
    if (format === 'CSV') {
      const headers = report.previewColumns.join(',');
      const rows = report.previewRows.map((row) =>
        report.previewColumns.map((col) => `"${row[col] || ''}"`).join(',')
      );
      csvContent = [headers, ...rows].join('\n');
    }

    return {
      fileName: `SevaNest_${report.id}_Export.${format.toLowerCase()}`,
      csvContent,
      format,
      rowCount: report.previewRows.length,
      generatedAt: 'Recent Export',
    };
  }
}

export class RealReportRepository implements IReportRepository {
  async getReports(category?: ReportCategory, search?: string): Promise<ReportItem[]> {
    try {
      const res = await httpClient.get<{ success: boolean; data: Record<string, unknown>[] }>('/admin/reports');
      const catalog = Array.isArray(res.data.data) ? res.data.data : [];

      let items: ReportItem[] = catalog.map((raw: Record<string, unknown>) => ({
        id: String(raw.code || raw.id || 'REP'),
        name: String(raw.title || raw.name || 'Report'),
        category: (raw.category as Exclude<ReportCategory, 'ALL'>) || 'Operations',
        description: String(raw.description || ''),
        lastRun: String(raw.lastRun || 'Recent Baseline'),
        metricsSummary: Array.isArray(raw.metricsSummary)
          ? (raw.metricsSummary as ReportItem['metricsSummary'])
          : [{ label: 'Data Points', value: String(raw.totalRecords || 'Available') }],
        previewColumns: Array.isArray(raw.columns) ? (raw.columns as string[]) : ['Metric', 'Value'],
        previewRows: Array.isArray(raw.previewRows) ? (raw.previewRows as ReportItem['previewRows']) : [],
      }));

      if (category && category !== 'ALL') {
        items = items.filter((r) => r.category === category);
      }
      if (search) {
        const q = search.toLowerCase();
        items = items.filter(
          (r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
        );
      }

      return items;
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getReportById(id: string, criteria?: ReportFilterCriteria): Promise<ReportItem | null> {
    try {
      const from = '2026-01-01';
      const to = '2026-12-31';
      const params: Record<string, unknown> = {
        from,
        to,
        interval: criteria?.period === 'LAST_7_DAYS' ? 'day' : 'month',
      };

      // If id matches a specific report endpoint code, query that endpoint
      const endpoint =
        id.startsWith('REP-01') || id.toLowerCase().includes('customer')
          ? '/admin/reports/new-customers'
          : id.startsWith('REP-02') || id.toLowerCase().includes('worker')
          ? '/admin/reports/worker-registrations'
          : id.startsWith('REP-04') || id.toLowerCase().includes('funnel')
          ? '/admin/reports/booking-funnel'
          : '/admin/reports';

      const res = await httpClient.get<{ success: boolean; data: Record<string, unknown> | Record<string, unknown>[] }>(endpoint, { params });
      const raw = res.data.data;

      return {
        id,
        name: (!Array.isArray(raw) && raw?.title) ? String(raw.title) : id,
        category: 'Operations',
        description: (!Array.isArray(raw) && raw?.description) ? String(raw.description) : 'Detailed operational report breakdown',
        lastRun: 'Live Data',
        metricsSummary: [
          { label: 'Data Points', value: Array.isArray(raw) ? raw.length : 1 },
        ],
        previewColumns: ['Date Bucket', 'Count'],
        previewRows: Array.isArray(raw)
          ? raw.map((r: Record<string, unknown>) => ({
              'Date Bucket': String(r.bucket || r.date || 'Period'),
              Count: Number(r.count || r.value || 0),
            }))
          : [],
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async generateExport(
    reportId: string,
    format: 'CSV' | 'PDF',
    criteria?: ReportFilterCriteria
  ): Promise<ExportResult> {
    try {
      const report = await this.getReportById(reportId, criteria);
      if (!report) {
        throw new Error(`Report ${reportId} not found.`);
      }

      let csvContent = '';
      if (format === 'CSV') {
        const headers = report.previewColumns.join(',');
        const rows = report.previewRows.map((row) =>
          report.previewColumns.map((col) => `"${row[col] ?? ''}"`).join(',')
        );
        csvContent = [headers, ...rows].join('\n');
      }

      return {
        fileName: `SevaNest_${report.id}_Export.${format.toLowerCase()}`,
        csvContent,
        format,
        rowCount: report.previewRows.length,
        generatedAt: new Date().toISOString(),
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }
}

export { RealReportRepository as ReportRepositoryImpl };

export const createReportRepository = (
  useMock: boolean = env.VITE_USE_MOCK_AUTH
): IReportRepository => {
  return useMock ? new MockReportRepository() : new RealReportRepository();
};

export const reportRepository = createReportRepository();

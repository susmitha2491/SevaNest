import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Workbook } from 'exceljs';
import { ReportsDashboardPage } from '../features/reports/presentation/ReportsDashboardPage';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import {
  generateProfessionalExcel,
  generateCleanCsv,
  getReportCanonicalFilename,
} from '../features/reports/utils/reportExportGenerator';
import { createReportRepository, RealReportRepository } from '../features/reports/data/reportRepository';
import { clearReportEnrichmentCache } from '../features/reports/data/reportDetailEnricher';
import { ReportItem } from '../features/reports/domain/types';
import { httpClient } from '../core/api/httpClient';
import { vi } from 'vitest';

function renderWithProviders(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Operational Reports & Analytics Workflows', () => {
  beforeEach(() => {
    clearReportEnrichmentCache();
    useAuthStore.setState({
      user: {
        id: 'STAFF-SUPER-01',
        name: 'Super Administrator',
        email: 'superadmin@sevanest.local',
        role: 'SUPER_ADMIN',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.REPORTS_VIEW,
          PERMISSIONS.EXPORTS_GENERATE,
        ],
      },
      isAuthenticated: true,
    });
  });

  it('renders reports catalogue with all standard PRD reports and filter controls', async () => {
    renderWithProviders(<ReportsDashboardPage />);

    expect(
      await screen.findByRole('heading', { name: /Reports & Analytics/i })
    ).toBeInTheDocument();

    expect(screen.getByText('All Reports')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search reports by title, requirement code, or description/i)).toBeInTheDocument();

    // Verify presence of standard PRD reports
    expect(await screen.findByText('FR-RPT-001')).toBeInTheDocument();
    expect(screen.getByText(/New Customer Acquisition by Period/i)).toBeInTheDocument();
    expect(screen.getByText('FR-RPT-010')).toBeInTheDocument();
    expect(screen.getByText('Payment Collections & Fee Realization')).toBeInTheDocument();

    // Verify presence of a single Export button per catalogue row
    const exportButtons = screen.getAllByRole('button', { name: /^Export:/i });
    expect(exportButtons).toHaveLength(12);
    expect(screen.queryByRole('button', { name: /^Export CSV:/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Export Excel:/i })).not.toBeInTheDocument();
  });

  it('renders single direct Export button (Excel .xlsx) when user has canonical backend report.view permission', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      user: {
        id: 'STAFF-BACKEND-01',
        name: 'Operations Admin',
        email: 'ops@sevanest.internal',
        role: 'OPERATIONS_ADMIN',
        permissions: ['report.view', 'dashboard.view'],
      },
      isAuthenticated: true,
    });

    renderWithProviders(<ReportsDashboardPage />);

    expect(await screen.findByRole('heading', { name: /Reports & Analytics/i })).toBeInTheDocument();
    const exportButtons = await screen.findAllByRole('button', { name: /^Export:/i });
    expect(exportButtons.length).toBeGreaterThan(0);

    await user.click(exportButtons[0]);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(await screen.findByText(/Excel \(\.xlsx\) exported successfully/i)).toBeInTheDocument();
  });

  it('filters reports catalogue by category pill and search query', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportsDashboardPage />);

    const financePill = await screen.findByRole('button', { name: /^Finance$/i });
    await user.click(financePill);

    expect(await screen.findByText('FR-RPT-010')).toBeInTheDocument();
    expect(screen.queryByText('FR-RPT-001')).not.toBeInTheDocument();

    // Search within finance
    const searchInput = screen.getByPlaceholderText(/Search reports by title, requirement code, or description/i);
    await user.type(searchInput, 'Realization');
    expect(screen.getByText('Payment Collections & Fee Realization')).toBeInTheDocument();
  });

  it('opens report view displaying KPI indicators, dataset table, triggers direct Excel export via single Export button, and navigates back', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportsDashboardPage />);

    // Click View Report on New Customers
    const viewButtons = await screen.findAllByRole('button', { name: /View Report/i });
    expect(viewButtons.length).toBeGreaterThan(0);
    await user.click(viewButtons[0]);

    // Check report view contents
    expect(await screen.findByText(/AUTHORITATIVE SPECIFICATION & METRIC DEFINITION/i)).toBeInTheDocument();
    expect(screen.getByText(/Total New Customers/i)).toBeInTheDocument();
    expect(screen.getByText(/Tabular Dataset/i)).toBeInTheDocument();
    expect(screen.getByText('2026-10-01')).toBeInTheDocument();

    // Trigger direct Excel (.xlsx) Export via single Export button
    const exportBtn = screen.getByRole('button', { name: /^Export$/i });
    await user.click(exportBtn);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(await screen.findByText(/Excel \(\.xlsx\) exported successfully/i)).toBeInTheDocument();

    // Navigate back to reports catalogue
    const backBtn = screen.getByRole('button', { name: /Back to Reports/i });
    await user.click(backBtn);

    expect(await screen.findByRole('heading', { name: /Reports & Analytics/i })).toBeInTheDocument();
    expect(screen.getByText('FR-RPT-001')).toBeInTheDocument();
    expect(screen.getByText('12 PRD Reports')).toBeInTheDocument();
  });

  it('allows drilling into unified FR-RPT-012 and toggling between Top-Rated Workers and Repeat Customers', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportsDashboardPage />);

    // Click on FR-RPT-012
    const viewButtons = await screen.findAllByRole('button', { name: /View Report: Top-Rated Workers & Repeat Customers/i });
    expect(viewButtons.length).toBeGreaterThan(0);
    await user.click(viewButtons[0]);

    // Check FR-RPT-012 title and tabs
    expect(await screen.findByRole('heading', { name: /Top-Rated Workers & Repeat Customers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Top-Rated Domestic Workers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Repeat Customer Retention/i })).toBeInTheDocument();

    // Check default Top-Rated Workers view
    expect(screen.getByText(/Ranked Workers/i)).toBeInTheDocument();
    expect(screen.getByText(/Shabana Begum/i)).toBeInTheDocument();

    // Toggle to Repeat Customers sub-tab
    const repeatTab = screen.getByRole('button', { name: /Repeat Customer Retention/i });
    await user.click(repeatTab);

    // Verify Repeat Customers dataset renders
    expect(await screen.findByText(/Rohan Rao/i)).toBeInTheDocument();
    expect(screen.getByText(/Repeat Booker/i)).toBeInTheDocument();
  });

  it('displays NoAccessView when user lacks reports.view permission', async () => {
    useAuthStore.setState({
      user: {
        id: 'STAFF-VE-01',
        name: 'Verification Officer',
        email: 've@sevanest.local',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.VERIFICATION_REVIEW],
      },
      isAuthenticated: true,
    });

    renderWithProviders(<ReportsDashboardPage />);

    expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
    expect(screen.getByText(/reports\.view/i)).toBeInTheDocument();
  });

  describe('Professional Excel & Clean CSV Export Generation Engine', () => {
    it('generates canonical filenames according to PRD requirement IDs and sub-reports', () => {
      expect(
        getReportCanonicalFilename({ requirement: 'FR-RPT-001', name: 'New Customer Acquisition by Period & Locality' }, 'xlsx')
      ).toBe('FR-RPT-001_New_Customer_Acquisition.xlsx');

      expect(
        getReportCanonicalFilename({ requirement: 'FR-RPT-001', name: 'New Customer Acquisition by Period & Locality' }, 'csv')
      ).toBe('FR-RPT-001_New_Customer_Acquisition.csv');

      expect(
        getReportCanonicalFilename({ requirement: 'FR-RPT-012', id: 'top-rated-workers-repeat-customers', name: 'Top-Rated Workers & Repeat Customers' }, 'xlsx', 'top-rated-workers')
      ).toBe('FR-RPT-012_Top_Rated_Domestic_Workers.xlsx');

      expect(
        getReportCanonicalFilename({ requirement: 'FR-RPT-012', id: 'top-rated-workers-repeat-customers', name: 'Top-Rated Workers & Repeat Customers' }, 'xlsx', 'repeat-customers')
      ).toBe('FR-RPT-012_Repeat_Customer_Retention.xlsx');
    });

    it('generates standard RFC 4180 CSV with UTF-8 BOM and properly escaped characters', () => {
      const csv = generateCleanCsv(
        ['Worker Name', 'Notes', 'Amount'],
        [{ 'Worker Name': 'Shabana, "Lead"', Notes: 'Line 1\nLine 2', Amount: '₹1,500' }]
      );
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('Worker Name,Notes,Amount');
      expect(csv).toContain('"Shabana, ""Lead"""');
      expect(csv).toContain('"Line 1\nLine 2"');
    });

    it('generates genuine typed OpenXML Excel spreadsheet (.xlsx) with ExcelJS', async () => {
      const mockReport: ReportItem = {
        id: 'new-customers',
        requirement: 'FR-RPT-001',
        name: 'New Customer Acquisition',
        category: 'Growth',
        description: 'Customer accounts created in period',
        cadence: 'Monthly',
        metricsSummary: [{ label: 'Total New Customers', value: 30 }],
        previewColumns: ['Period', 'Count', 'Growth Rate %', 'Gross Collections (₹)'],
        previewRows: [
          { Period: '2026-10-01', Count: 20, 'Growth Rate %': '66.7%', 'Gross Collections (₹)': '₹10,000.00' },
          { Period: '2026-11-01', Count: 10, 'Growth Rate %': '33.3%', 'Gross Collections (₹)': '₹5,000.00' },
        ],
      };

      const buffer = await generateProfessionalExcel(mockReport, { from: '2026-01-01', to: '2026-11-05', interval: 'month' });
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.byteLength).toBeGreaterThan(1000);

      // Verify that standard spreadsheet parsers & ExcelJS read widths, filters, merges & yyyy-mm-dd dates
      const parsedWorkbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellNF: true });
      expect(parsedWorkbook.SheetNames).toContain('FR-RPT-001');
      const sheet = parsedWorkbook.Sheets['FR-RPT-001'];
      expect(sheet).toBeDefined();
      expect(sheet['!merges']?.length).toBeGreaterThanOrEqual(5);
      expect(sheet['!autofilter']).toBeDefined();
      const csvView = XLSX.utils.sheet_to_csv(sheet);
      expect(csvView).toContain('2026-10-01');
      expect(csvView).toContain('2026-11-01');
      expect(csvView).toContain('Reporting Period: 2026-01-01 to 2026-11-05');

      const verifyWb = new Workbook();
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
      await verifyWb.xlsx.load(arrayBuffer);
      const excelSheet = verifyWb.getWorksheet('FR-RPT-001');
      expect(excelSheet).toBeDefined();
      for (let colIdx = 1; colIdx <= 4; colIdx += 1) {
        expect(excelSheet?.getColumn(colIdx).width ?? 0).toBeGreaterThanOrEqual(16);
      }
      expect(excelSheet?.autoFilter).toBeDefined();

      // Verify first period row uses a genuine Date cell with yyyy-mm-dd number format
      let foundFormattedDate = false;
      excelSheet?.eachRow((row) => {
        const cell = row.getCell(1);
        if (cell.value instanceof Date && cell.numFmt === 'yyyy-mm-dd') {
          foundFormattedDate = true;
        }
      });
      expect(foundFormattedDate).toBe(true);
    });

    it('exports proper XLSX and CSV using reportRepository for all sub-tabs of FR-RPT-012', async () => {
      const repo = createReportRepository(true);

      const topRatedExp = await repo.generateExport('top-rated-workers-repeat-customers', 'XLSX', { subTab: 'top-rated-workers' });
      expect(topRatedExp.format).toBe('XLSX');
      expect(topRatedExp.fileName).toBe('FR-RPT-012_Top_Rated_Domestic_Workers.xlsx');
      expect(topRatedExp.xlsxBuffer).toBeDefined();

      const repeatExp = await repo.generateExport('top-rated-workers-repeat-customers', 'XLSX', { subTab: 'repeat-customers' });
      expect(repeatExp.format).toBe('XLSX');
      expect(repeatExp.fileName).toBe('FR-RPT-012_Repeat_Customer_Retention.xlsx');
      expect(repeatExp.xlsxBuffer).toBeDefined();

      const repeatCsv = await repo.generateExport('top-rated-workers-repeat-customers', 'CSV', { subTab: 'repeat-customers' });
      expect(repeatCsv.format).toBe('CSV');
      expect(repeatCsv.fileName).toBe('FR-RPT-012_Repeat_Customer_Retention.csv');
      expect(repeatCsv.csvContent).toContain('Customer Name,Customer User ID');
      expect(repeatCsv.csvContent).toContain('Rohan Rao');
    });
  });

  describe('Real Backend Report Accuracy & Export Parity', () => {
    it('maps payment-collections backend feeCode and payments fields accurately and matches CSV export', async () => {
      const paymentPayload = {
        data: {
          report: 'payment-collections',
          definition: 'Payments paid in the period by fee type.',
          notes: [],
          from: '2026-01-01',
          to: '2026-11-12',
          data: {
            interval: 'month',
            totalsByFeeType: [
              { feeCode: 'BOOKING_FEE', currency: 'INR', payments: 14, grossMinor: 700000, refundedMinor: 0 },
            ],
            series: [
              { period: '2026-10-01', feeCode: 'BOOKING_FEE', currency: 'INR', payments: 7, grossMinor: 350000, refundedMinor: 0 },
              { period: '2026-11-01', feeCode: 'BOOKING_FEE', currency: 'INR', payments: 7, grossMinor: 350000, refundedMinor: 0 },
            ],
          },
        },
      };

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValue(paymentPayload as unknown as Awaited<ReturnType<typeof httpClient.get>>);
      const repo = new RealReportRepository();
      const report = await repo.getReportById('payment-collections', { from: '2026-01-01', to: '2026-11-12', interval: 'month' });

      expect(report?.metricsSummary).toEqual([
        { label: 'Gross Settled Collections', value: '₹7,000.00' },
        { label: 'Refunded Realizations', value: '₹0.00' },
        { label: 'Total Payments Recorded', value: 14 },
      ]);
      expect(report?.previewRows).toEqual([
        { Period: '2026-10-01', 'Fee Classification': 'BOOKING_FEE', 'Payments Count': 7, 'Gross Collections (₹)': '₹3,500.00', 'Refunded Amount (₹)': '₹0.00' },
        { Period: '2026-11-01', 'Fee Classification': 'BOOKING_FEE', 'Payments Count': 7, 'Gross Collections (₹)': '₹3,500.00', 'Refunded Amount (₹)': '₹0.00' },
      ]);

      const exportedCsv = await repo.generateExport('payment-collections', 'CSV', { from: '2026-01-01', to: '2026-11-12', interval: 'month' });
      expect(exportedCsv.csvContent).toContain('2026-10-01,BOOKING_FEE,7,"₹3,500.00",₹0.00');
      expect(exportedCsv.csvContent).toContain('2026-11-01,BOOKING_FEE,7,"₹3,500.00",₹0.00');
      getSpy.mockRestore();
    });

    it('maps demand-by-area city field and repeat-customers Bookings Count accurately without invented fields', async () => {
      const getSpy = vi
        .spyOn(httpClient, 'get')
        .mockResolvedValueOnce({
          data: {
            report: 'demand-by-area',
            data: [{ areaId: 'a-1', name: 'Madhapur', city: 'Hyderabad', requests: 19 }],
            meta: { page: 1, limit: 100, total: 1 },
          },
        } as unknown as Awaited<ReturnType<typeof httpClient.get>>)
        .mockResolvedValueOnce({
          data: {
            report: 'repeat-customers',
            data: [{ customerUserId: 'c-1', name: 'Ajay Nagirikanti', bookings: 9 }],
            meta: { page: 1, limit: 100, total: 1 },
          },
        } as unknown as Awaited<ReturnType<typeof httpClient.get>>);

      const repo = new RealReportRepository();
      const areaReport = await repo.getReportById('demand-by-area');
      expect(areaReport?.previewColumns).toContain('City');
      expect(areaReport?.previewRows[0].City).toBe('Hyderabad');

      const repeatReport = await repo.getReportById('top-rated-workers-repeat-customers', { subTab: 'repeat-customers' });
      expect(repeatReport?.previewColumns).toEqual(['Customer Name', 'Customer User ID', 'Bookings Count']);
      expect(repeatReport?.previewRows[0]).toEqual({
        'Customer Name': 'Ajay Nagirikanti',
        'Customer User ID': 'c-1',
        'Bookings Count': 9,
      });
      getSpy.mockRestore();
    });

    it('renders genuine zero utilization without falling back to hardcoded values', async () => {
      const repo = new RealReportRepository();
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          report: 'worker-utilization',
          data: { verifiedWorkers: 10, workersWithActiveBooking: 0, utilization: 0 },
        },
      } as unknown as Awaited<ReturnType<typeof httpClient.get>>);

      const report = await repo.getReportById('worker-utilization');
      expect(report?.metricsSummary.find((m) => m.label === 'Workers with Active Booking')?.value).toBe(0);
      expect(report?.metricsSummary.find((m) => m.label === 'Current Utilization Rate')?.value).toBe('0.00%');

      // Point-in-time Excel export must not falsely stamp YTD date filter boundaries
      const utilExport = await generateProfessionalExcel(report!, { from: '2026-01-01', to: '2026-11-12', interval: 'month' });
      const wb = XLSX.read(utilExport, { type: 'buffer' });
      const sheetCsv = XLSX.utils.sheet_to_csv(wb.Sheets['FR-RPT-006']);
      expect(sheetCsv).toContain('Point-in-Time Snapshot');
      expect(sheetCsv).not.toContain('2026-01-01 to 2026-11-12');
      getSpy.mockRestore();
    });

    it('omits technical developer notes from FR-RPT-001 Excel sheets and preserves real months without fabricating Jan-Sep', async () => {
      const repo = new RealReportRepository();
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          report: 'new-customers',
          definition: 'Customer accounts created per day/week/month.',
          notes: ['Counts accounts, not completed profiles.', 'Counts only what is recorded; nothing is estimated or back-filled.'],
          from: '2026-01-01',
          to: '2026-11-12',
          data: {
            interval: 'month',
            total: 48,
            series: [
              { period: '2026-10-01', count: 20 },
              { period: '2026-11-01', count: 28 },
            ],
          },
        },
      } as unknown as Awaited<ReturnType<typeof httpClient.get>>);

      const exp = await repo.generateExport('new-customers', 'XLSX', { from: '2026-01-01', to: '2026-11-12', interval: 'month' });
      expect(exp.rowCount).toBe(2);
      const wb = XLSX.read(exp.xlsxBuffer, { type: 'buffer' });
      const sheetCsv = XLSX.utils.sheet_to_csv(wb.Sheets['FR-RPT-001']);
      expect(sheetCsv).not.toContain('Backend Data Scope Notes');
      expect(sheetCsv).not.toContain('Record Enrichment & Scope');
      expect(sheetCsv).not.toContain('/admin/');
      expect(sheetCsv).toContain('Customer accounts created per day/week/month.');
      expect(sheetCsv).toContain('2026-10-01');
      expect(sheetCsv).toContain('2026-11-01');
      expect(sheetCsv).not.toContain('2026-01-01,0');
      getSpy.mockRestore();
    });

    it('includes Periodic Volume worksheet in FR-RPT-011 support-tickets Excel export', async () => {
      const repo = new RealReportRepository();
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          report: 'support-tickets',
          from: '2026-01-01',
          to: '2026-11-12',
          data: {
            interval: 'month',
            created: 20,
            closed: 6,
            averageResolutionSeconds: 317586,
            byStatus: [
              { status: 'CLOSED', count: 6 },
              { status: 'ESCALATED', count: 9 },
              { status: 'OPEN', count: 5 },
            ],
            series: [
              { period: '2026-10-01', count: 12 },
              { period: '2026-11-01', count: 8 },
            ],
          },
        },
      } as unknown as Awaited<ReturnType<typeof httpClient.get>>);

      const exp = await repo.generateExport('support-tickets', 'XLSX', { from: '2026-01-01', to: '2026-11-12', interval: 'month' });
      expect(exp.rowCount).toBe(5);
      const wb = XLSX.read(exp.xlsxBuffer, { type: 'buffer' });
      expect(wb.SheetNames).toContain('FR-RPT-011');
      expect(wb.SheetNames).toContain('Periodic Volume');
      const periodicCsv = XLSX.utils.sheet_to_csv(wb.Sheets['Periodic Volume']);
      expect(periodicCsv).toContain('2026-10-01,12');
      expect(periodicCsv).toContain('2026-11-01,8');
      getSpy.mockRestore();
    });

    it('exports both top-rated workers and repeat customers when FR-RPT-012 is exported without subTab', async () => {
      const repo = createReportRepository(true);

      const combinedXlsx = await repo.generateExport('top-rated-workers-repeat-customers', 'XLSX');
      expect(combinedXlsx.fileName).toBe('FR-RPT-012_Top_Rated_Workers_and_Repeat_Customers.xlsx');
      expect(combinedXlsx.rowCount).toBe(2);
      const wb = XLSX.read(combinedXlsx.xlsxBuffer, { type: 'buffer' });
      expect(wb.SheetNames).toContain('FR-RPT-012');
      expect(wb.SheetNames).toContain('Repeat Customers');
      expect(XLSX.utils.sheet_to_csv(wb.Sheets['Repeat Customers'])).toContain('Rohan Rao');

      const combinedCsv = await repo.generateExport('top-rated-workers-repeat-customers', 'CSV');
      expect(combinedCsv.fileName).toBe('FR-RPT-012_Top_Rated_Workers_and_Repeat_Customers.csv');
      expect(combinedCsv.rowCount).toBe(2);
      expect(combinedCsv.csvContent).toContain('Top-Rated Workers,Shabana Begum');
      expect(combinedCsv.csvContent).toContain('Repeat Customers,Rohan Rao');
    });

    it('generates valid Excel (.xlsx) and CSV exports across all 12 PRD report definitions', async () => {
      const repo = createReportRepository(true);
      const catalog = await repo.getReports();
      expect(catalog).toHaveLength(12);

      for (const item of catalog) {
        const xlsx = await repo.generateExport(item.id, 'XLSX');
        expect(xlsx.fileName.endsWith('.xlsx')).toBe(true);
        expect(xlsx.xlsxBuffer).toBeInstanceOf(Uint8Array);
        const wb = XLSX.read(xlsx.xlsxBuffer, { type: 'buffer' });
        expect(wb.SheetNames.length).toBeGreaterThanOrEqual(1);

        const csv = await repo.generateExport(item.id, 'CSV');
        expect(csv.fileName.endsWith('.csv')).toBe(true);
        expect(csv.csvContent?.startsWith('\uFEFF')).toBe(true);
      }
    });

    it('enriches new-customers via detail endpoint for unmasked Excel text phones, addresses, and clean sheets', async () => {
      const repo = new RealReportRepository();
      const getSpy = vi.spyOn(httpClient, 'get').mockImplementation(async (url, config) => {
        if (url === '/admin/reports/new-customers') {
          return {
            data: {
              report: 'new-customers',
              from: '2026-01-01',
              to: '2026-11-12',
              data: {
                interval: 'month',
                total: 2,
                series: [{ period: '2026-11-01', count: 2 }],
              },
            },
          } as unknown as Awaited<ReturnType<typeof httpClient.get>>;
        }
        if (url === '/admin/customers') {
          const page = Number((config as { params?: { page?: number } })?.params?.page || 1);
          return {
            data: {
              data: page === 1
                ? [{ id: 'CUST-1', name: 'Priya Singh', mobile: '+91******7410', accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED', createdAt: '2026-11-10T10:00:00Z' }]
                : [{ id: 'CUST-2', name: 'Rohan Rao', mobile: '+91******5555', accountStatus: 'ACTIVE', verificationStatus: 'PENDING', createdAt: '2026-11-11T10:00:00Z' }],
              meta: { page, limit: 1, total: 2 },
            },
          } as unknown as Awaited<ReturnType<typeof httpClient.get>>;
        }
        if (url === '/admin/customers/CUST-1') {
          return {
            data: {
              data: {
                id: 'CUST-1',
                name: 'Priya Singh',
                mobile: '+919638527410',
                addresses: [{ area: 'Banjara Hills', city: 'Hyderabad', isDefault: true }],
              },
            },
          } as unknown as Awaited<ReturnType<typeof httpClient.get>>;
        }
        if (url === '/admin/customers/CUST-2') {
          return {
            data: {
              data: {
                id: 'CUST-2',
                name: 'Rohan Rao',
                mobile: '+919848055555',
                addresses: [],
              },
            },
          } as unknown as Awaited<ReturnType<typeof httpClient.get>>;
        }
        return { data: [] } as unknown as Awaited<ReturnType<typeof httpClient.get>>;
      });

      const detailed = await repo.getReportById('new-customers', {
        from: '2026-01-01',
        to: '2026-11-12',
        interval: 'month',
        includeDetailedRecords: true,
      });

      expect(detailed?.detailDataset?.title).toBe('Customer Registrations');
      expect(detailed?.detailDataset?.rows).toHaveLength(2);
      expect(detailed?.detailDataset?.rows[0]['Mobile Number']).toBe('+91 96385 27410');
      expect(detailed?.detailDataset?.rows[0].Locality).toBe('Banjara Hills, Hyderabad');
      expect(detailed?.detailDataset?.rows[1]['Mobile Number']).toBe('+91 98480 55555');
      expect(detailed?.detailDataset?.rows[1].Locality).toBe('No Address Added');

      const xlsx = await repo.generateExport('new-customers', 'XLSX', {
        from: '2026-01-01',
        to: '2026-11-12',
        interval: 'month',
        includeDetailedRecords: true,
      });
      const verifyWb = new Workbook();
      const buf = xlsx.xlsxBuffer!;
      const arrayBuf = buf instanceof Uint8Array
        ? (buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)
        : buf;
      await verifyWb.xlsx.load(arrayBuf);
      const detailWs = verifyWb.getWorksheet('Customer Registrations');
      expect(detailWs).toBeDefined();

      // Verify phone column is stored strictly as Excel Text ('@') with unmasked '+91 96385 27410' and width >= 18
      let foundTextPhone = false;
      detailWs?.eachRow((row) => {
        row.eachCell((cell) => {
          if (cell.value === '+91 96385 27410') {
            expect(typeof cell.value).toBe('string');
            expect(cell.numFmt).toBe('@');
            foundTextPhone = true;
          }
        });
      });
      expect(foundTextPhone).toBe(true);
      expect(detailWs?.getColumn(3).width ?? 0).toBeGreaterThanOrEqual(18);

      const wb = XLSX.read(xlsx.xlsxBuffer, { type: 'buffer' });
      const detailCsvSheet = XLSX.utils.sheet_to_csv(wb.Sheets['Customer Registrations']);
      expect(detailCsvSheet).not.toContain('Record Enrichment & Scope');
      expect(detailCsvSheet).not.toContain('/admin/');
      expect(detailCsvSheet).toContain('Banjara Hills, Hyderabad');

      getSpy.mockRestore();
    });

    it('resolves customer names on FR-RPT-003 bookings via /admin/bookings/{id} and complainant names on FR-RPT-011 support tickets', async () => {
      const repo = new RealReportRepository();
      const getSpy = vi.spyOn(httpClient, 'get').mockImplementation(async (url) => {
        if (url === '/admin/reports/booking-funnel') {
          return {
            data: {
              report: 'booking-funnel',
              from: '2026-01-01',
              to: '2026-11-12',
              data: { countsByStatus: [{ status: 'CONFIRMED', count: 1 }], total: 1 },
            },
          } as unknown as Awaited<ReturnType<typeof httpClient.get>>;
        }
        if (url === '/admin/reports/support-tickets') {
          return {
            data: {
              report: 'support-tickets',
              from: '2026-01-01',
              to: '2026-11-12',
              data: { created: 1, closed: 1, averageResolutionSeconds: 3600, byStatus: [{ status: 'CLOSED', count: 1 }], series: [] },
            },
          } as unknown as Awaited<ReturnType<typeof httpClient.get>>;
        }
        if (url === '/admin/bookings') {
          return {
            data: {
              data: [
                {
                  id: 'BKG-1',
                  status: 'CONFIRMED',
                  category: { id: 'c1', name: 'Cook' },
                  area: { id: 'a1', name: 'Madhapur' },
                  workerId: 'WRK-1',
                  createdAt: '2026-11-10T10:00:00Z',
                  updatedAt: '2026-11-10T11:00:00Z',
                },
              ],
              meta: { page: 1, limit: 100, total: 1 },
            },
          } as unknown as Awaited<ReturnType<typeof httpClient.get>>;
        }
        if (url === '/admin/bookings/BKG-1') {
          return {
            data: {
              data: {
                id: 'BKG-1',
                customerUserId: 'CUST-1',
                timeline: [{ at: '2026-11-10T11:00:00Z', note: 'Confirmed by ops', actorUserId: 'ADMIN-1' }],
              },
            },
          } as unknown as Awaited<ReturnType<typeof httpClient.get>>;
        }
        if (url === '/admin/customers') {
          return {
            data: {
              data: [{ id: 'CUST-1', name: 'Priya Singh', mobile: '+91******7410' }],
              meta: { page: 1, limit: 100, total: 1 },
            },
          } as unknown as Awaited<ReturnType<typeof httpClient.get>>;
        }
        if (url === '/admin/workers') {
          return {
            data: {
              data: [{ id: 'WRK-1', name: 'Shabana Begum', mobile: '+91******3210' }],
              meta: { page: 1, limit: 100, total: 1 },
            },
          } as unknown as Awaited<ReturnType<typeof httpClient.get>>;
        }
        if (url === '/admin/payments') {
          return { data: { data: [], meta: { page: 1, limit: 100, total: 0 } } } as unknown as Awaited<ReturnType<typeof httpClient.get>>;
        }
        if (url === '/admin/support/tickets') {
          return {
            data: {
              data: [
                {
                  id: 'TKT-1',
                  status: 'CLOSED',
                  creatorUserId: 'CUST-1',
                  creatorKind: 'CUSTOMER',
                  category: { id: 'tc-1', name: 'Delay' },
                  priority: null,
                  createdAt: '2026-11-10T09:00:00Z',
                  closedAt: '2026-11-10T10:00:00Z',
                },
              ],
              meta: { page: 1, limit: 100, total: 1 },
            },
          } as unknown as Awaited<ReturnType<typeof httpClient.get>>;
        }
        return { data: { data: [] } } as unknown as Awaited<ReturnType<typeof httpClient.get>>;
      });

      const bookingReport = await repo.getReportById('booking-funnel', {
        from: '2026-01-01',
        to: '2026-11-12',
        includeDetailedRecords: true,
      });
      expect(bookingReport?.detailDataset?.rows[0].Customer).toBe('Priya Singh');
      expect(bookingReport?.detailDataset?.rows[0].Worker).toBe('Shabana Begum');

      const ticketReport = await repo.getReportById('support-tickets', {
        from: '2026-01-01',
        to: '2026-11-12',
        includeDetailedRecords: true,
      });
      expect(ticketReport?.detailDataset?.rows[0]['Complainant Name']).toBe('Priya Singh');
      expect(ticketReport?.detailDataset?.rows[0]['User Type']).toBe('CUSTOMER');
      expect(ticketReport?.detailDataset?.rows[0]['Resolution Time']).toBe('1.0 hrs');

      getSpy.mockRestore();
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { ReportsDashboardPage } from '../features/reports/presentation/ReportsDashboardPage';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import {
  generateProfessionalExcel,
  generateCleanCsv,
  getReportCanonicalFilename,
} from '../features/reports/utils/reportExportGenerator';
import { createReportRepository } from '../features/reports/data/reportRepository';
import { ReportItem } from '../features/reports/domain/types';

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

    // Verify presence of Export actions in the catalogue rows
    const exportCsvButtons = screen.getAllByRole('button', { name: /^Export CSV:/i });
    const exportExcelButtons = screen.getAllByRole('button', { name: /^Export Excel:/i });
    expect(exportCsvButtons.length).toBeGreaterThan(0);
    expect(exportExcelButtons.length).toBeGreaterThan(0);
  });

  it('renders Export Excel and Export CSV buttons when user has only canonical backend report.view permission', async () => {
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
    const exportCsvButtons = await screen.findAllByRole('button', { name: /^Export CSV:/i });
    const exportExcelButtons = await screen.findAllByRole('button', { name: /^Export Excel:/i });
    expect(exportCsvButtons.length).toBeGreaterThan(0);
    expect(exportExcelButtons.length).toBeGreaterThan(0);
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

  it('opens report view displaying KPI indicators, dataset table, triggers CSV export, and navigates back', async () => {
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

    // Trigger CSV Export
    const exportCsvBtn = screen.getByRole('button', { name: /Export CSV/i });
    await user.click(exportCsvBtn);

    expect(await screen.findByText(/CSV exported successfully/i)).toBeInTheDocument();

    // Trigger Excel (.xlsx) Export
    const exportXlsxBtn = screen.getByRole('button', { name: /Export Excel/i });
    await user.click(exportXlsxBtn);

    expect(await screen.findByText(/XLSX exported successfully/i)).toBeInTheDocument();

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

      // Verify that standard spreadsheet parsers can read the generated binary buffer
      const parsedWorkbook = XLSX.read(buffer, { type: 'buffer' });
      expect(parsedWorkbook.SheetNames).toContain('FR-RPT-001');
      const sheet = parsedWorkbook.Sheets['FR-RPT-001'];
      expect(sheet).toBeDefined();
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
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ConfigurationMastersPage } from '../features/configuration/presentation/ConfigurationMastersPage';
import { configurationRepository } from '../features/configuration/data/configurationRepository';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { OperationalAreaItem, IConfigurationRepository } from '../features/configuration/domain/types';

function renderWithProviders(ui: React.ReactElement, initialRoute: string = '/configuration?tab=areas') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

const mockExistingAreas: OperationalAreaItem[] = [
  {
    id: '01a11ef1-2a77-71e7-91a3-0522f8b9cfca',
    clusterName: 'Madhapur',
    cityName: 'Hyderabad',
    pincodes: ['500081', '500086'],
    status: 'ACTIVE',
    activeWorkersCount: 21,
    etag: 'etag-madhapur-1',
  },
  {
    id: '01a11ef1-332a-772b-abde-71e625e89c0f',
    clusterName: 'Gachibowli',
    cityName: 'Hyderabad',
    pincodes: ['500032'],
    status: 'ACTIVE',
    activeWorkersCount: 15,
    etag: 'etag-gachibowli-1',
  },
];

describe('Operational Areas & Clusters Configuration Form', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'ADMIN-SUPER-01',
        name: 'Super Administrator',
        email: 'superadmin@sevanest.local',
        role: 'SUPER_ADMIN',
        permissions: Object.values(PERMISSIONS),
      },
      isAuthenticated: true,
    });

    vi.spyOn(configurationRepository, 'getOperationalAreas').mockResolvedValue([...mockExistingAreas]);
  });

  it('1. Creates an operational area successfully with multiple valid PIN codes', async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(configurationRepository as Required<IConfigurationRepository>, 'createOperationalArea').mockResolvedValue({
      id: '01a22000-new-cluster-uuid',
      clusterName: 'Financial District',
      cityName: 'Hyderabad',
      pincodes: ['500032', '500075'],
      status: 'ACTIVE',
      activeWorkersCount: 0,
    });

    renderWithProviders(<ConfigurationMastersPage />);

    // Open modal
    const addBtn = await screen.findByRole('button', { name: /Add Operational Area/i });
    await user.click(addBtn);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /Add New Operational Area/i })).toBeInTheDocument();

    // Enter required Cluster Name and City Name
    const nameInput = within(dialog).getByLabelText(/Cluster \/ Locality Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Financial District');

    const cityInput = within(dialog).getByLabelText(/City Name/i);
    await user.clear(cityInput);
    await user.type(cityInput, 'Hyderabad');

    // Add first PIN code
    const pinInput = within(dialog).getByPlaceholderText(/e\.g\. 500081/i);
    await user.type(pinInput, '500032');
    const addPinBtn = within(dialog).getByRole('button', { name: /Add Pincode/i });
    await user.click(addPinBtn);

    expect(within(dialog).getByText('500032')).toBeInTheDocument();

    // Add second PIN code
    await user.type(pinInput, '500075');
    await user.click(addPinBtn);

    expect(within(dialog).getByText('500075')).toBeInTheDocument();

    // Submit form
    const saveBtn = within(dialog).getByRole('button', { name: /Save Area/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        name: 'Financial District',
        city: 'Hyderabad',
        pincodes: ['500032', '500075'],
      });
    });

    // Modal closes and success toast appears
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Add New Operational Area/i })).not.toBeInTheDocument();
      expect(screen.getByText(/Operational area cluster provisioned successfully/i)).toBeInTheDocument();
    });
  });

  it('2. Loads real existing backend values when editing an operational area and saves updates without duplicates', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.spyOn(configurationRepository, 'saveOperationalArea').mockResolvedValue({
      id: '01a11ef1-2a77-71e7-91a3-0522f8b9cfca',
      clusterName: 'Madhapur Core',
      cityName: 'Hyderabad',
      pincodes: ['500081', '500086', '500087'],
      status: 'ACTIVE',
      activeWorkersCount: 21,
      etag: 'etag-madhapur-2',
    });

    renderWithProviders(<ConfigurationMastersPage />);

    expect(await screen.findByText('Madhapur')).toBeInTheDocument();

    // Click Edit button for Madhapur
    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    await user.click(editBtns[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /Edit Operational Area: Madhapur/i })).toBeInTheDocument();

    // Verify existing fields are pre-populated
    const nameInput = within(dialog).getByLabelText(/Cluster \/ Locality Name/i);
    expect(nameInput).toHaveValue('Madhapur');

    const cityInput = within(dialog).getByLabelText(/City Name/i);
    expect(cityInput).toHaveValue('Hyderabad');

    expect(within(dialog).getByText('500081')).toBeInTheDocument();
    expect(within(dialog).getByText('500086')).toBeInTheDocument();

    // Update locality name
    await user.clear(nameInput);
    await user.type(nameInput, 'Madhapur Core');

    // Add another PIN code
    const pinInput = within(dialog).getByPlaceholderText(/e\.g\. 500081/i);
    await user.type(pinInput, '500087');
    await user.click(within(dialog).getByRole('button', { name: /Add Pincode/i }));

    expect(within(dialog).getByText('500087')).toBeInTheDocument();

    // Save changes
    const saveBtn = within(dialog).getByRole('button', { name: /Save Area/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '01a11ef1-2a77-71e7-91a3-0522f8b9cfca',
          clusterName: 'Madhapur Core',
          cityName: 'Hyderabad',
          pincodes: ['500081', '500086', '500087'],
        }),
        'Operational area cluster update'
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Edit Operational Area/i })).not.toBeInTheDocument();
      expect(screen.getByText(/Operational cluster configuration updated successfully/i)).toBeInTheDocument();
    });
  });

  it('3. Allows adding and removing PIN codes interactively before saving', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigurationMastersPage />);

    const addBtn = await screen.findByRole('button', { name: /Add Operational Area/i });
    await user.click(addBtn);

    const dialog = await screen.findByRole('dialog');
    const pinInput = within(dialog).getByPlaceholderText(/e\.g\. 500081/i);
    const addPinBtn = within(dialog).getByRole('button', { name: /Add Pincode/i });

    // Add 500081 and 500082
    await user.type(pinInput, '500081');
    await user.click(addPinBtn);
    expect(within(dialog).getByText('500081')).toBeInTheDocument();

    await user.type(pinInput, '500082');
    await user.click(addPinBtn);
    expect(within(dialog).getByText('500082')).toBeInTheDocument();

    // Remove 500081
    const removeFirstPinBtn = within(dialog).getByRole('button', { name: /Remove PIN code 500081/i });
    await user.click(removeFirstPinBtn);

    expect(within(dialog).queryByText('500081')).not.toBeInTheDocument();
    expect(within(dialog).getByText('500082')).toBeInTheDocument();
  });

  it('4. Validates required fields and displays clear error messages on empty inputs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigurationMastersPage />);

    const addBtn = await screen.findByRole('button', { name: /Add Operational Area/i });
    await user.click(addBtn);

    const dialog = await screen.findByRole('dialog');
    const nameInput = within(dialog).getByLabelText(/Cluster \/ Locality Name/i);
    const cityInput = within(dialog).getByLabelText(/City Name/i);
    const saveBtn = within(dialog).getByRole('button', { name: /Save Area/i });

    // 1. Empty cluster name
    await user.clear(nameInput);
    await user.click(saveBtn);
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/Cluster \/ Locality Name is required/i);

    // 2. Short cluster name (< 2 characters)
    await user.type(nameInput, 'X');
    await user.click(saveBtn);
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/Cluster \/ Locality Name must be at least 2 characters/i);

    // 3. Valid cluster name, empty city
    await user.type(nameInput, ' Jubilee Hills');
    await user.clear(cityInput);
    await user.click(saveBtn);
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/City Name is required/i);

    // 4. Valid city name, no PIN codes for an unknown cluster
    await user.type(cityInput, 'Hyderabad');
    await user.clear(nameInput);
    await user.type(nameInput, 'Custom Unknown Zone');
    await user.click(saveBtn);
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/At least one valid PIN code is required/i);
  });

  it('5. Validates PIN code format and rejects invalid or malformed values', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigurationMastersPage />);

    const addBtn = await screen.findByRole('button', { name: /Add Operational Area/i });
    await user.click(addBtn);

    const dialog = await screen.findByRole('dialog');
    const pinInput = within(dialog).getByPlaceholderText(/e\.g\. 500081/i);
    const addPinBtn = within(dialog).getByRole('button', { name: /Add Pincode/i });

    // Less than 6 digits
    await user.type(pinInput, '50008');
    await user.click(addPinBtn);
    expect(within(dialog).getByText(/PIN code must be exactly 6 digits/i)).toBeInTheDocument();

    // Starting with 0
    await user.clear(pinInput);
    await user.type(pinInput, '050081');
    await user.click(addPinBtn);
    expect(within(dialog).getByText(/PIN code cannot start with 0/i)).toBeInTheDocument();
  });

  it('6. Prevents duplicate PIN codes within the same operational area', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigurationMastersPage />);

    const addBtn = await screen.findByRole('button', { name: /Add Operational Area/i });
    await user.click(addBtn);

    const dialog = await screen.findByRole('dialog');
    const pinInput = within(dialog).getByPlaceholderText(/e\.g\. 500081/i);
    const addPinBtn = within(dialog).getByRole('button', { name: /Add Pincode/i });

    // Add 500034
    await user.type(pinInput, '500034');
    await user.click(addPinBtn);
    expect(within(dialog).getByText('500034')).toBeInTheDocument();

    // Attempt to add 500034 again
    await user.type(pinInput, '500034');
    await user.click(addPinBtn);

    expect(within(dialog).getByText(/PIN code 500034 is already added/i)).toBeInTheDocument();
    // Only one badge should exist inside dialog
    expect(within(dialog).getAllByText('500034')).toHaveLength(1);
  });

  it('7. Handles backend failure by displaying clear error message and preserving entered work without closing modal', async () => {
    const user = userEvent.setup();
    vi.spyOn(configurationRepository as Required<IConfigurationRepository>, 'createOperationalArea').mockRejectedValue(
      new Error('Database conflict: Cluster name already registered in city.')
    );

    renderWithProviders(<ConfigurationMastersPage />);

    const addBtn = await screen.findByRole('button', { name: /Add Operational Area/i });
    await user.click(addBtn);

    const dialog = await screen.findByRole('dialog');
    const nameInput = within(dialog).getByLabelText(/Cluster \/ Locality Name/i);
    await user.type(nameInput, 'Existing Cluster');

    const pinInput = within(dialog).getByPlaceholderText(/e\.g\. 500081/i);
    await user.type(pinInput, '500081');
    await user.click(within(dialog).getByRole('button', { name: /Add Pincode/i }));

    const saveBtn = within(dialog).getByRole('button', { name: /Save Area/i });
    await user.click(saveBtn);

    // Modal must remain open and display the error message inside dialog
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /Database conflict: Cluster name already registered in city/i
    );
    expect(within(dialog).getByRole('heading', { name: /Add New Operational Area/i })).toBeInTheDocument();

    // Input values must be preserved
    expect(within(dialog).getByLabelText(/Cluster \/ Locality Name/i)).toHaveValue('Existing Cluster');
    expect(within(dialog).getByText('500081')).toBeInTheDocument();
  });

  it('8. Closes modal on Cancel button click and resets errors', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigurationMastersPage />);

    const addBtn = await screen.findByRole('button', { name: /Add Operational Area/i });
    await user.click(addBtn);

    const dialog = await screen.findByRole('dialog');
    const cancelBtn = within(dialog).getByRole('button', { name: /^Cancel$/i });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Add New Operational Area/i })).not.toBeInTheDocument();
    });
  });
});

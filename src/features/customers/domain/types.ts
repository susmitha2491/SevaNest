export interface CustomerBookingSummary {
  bookingId: string;
  category: string;
  workerName?: string;
  status: string;
  date: string;
}

export interface Customer {
  id: string;
  name: string;
  maskedPhone: string;
  maskedEmail: string;
  locality: string;
  status: 'ACTIVE' | 'SUSPENDED';
  totalBookings: number;
  registeredDate: string;
}

export interface CustomerDetail extends Customer {
  unmaskedPhone?: string;
  unmaskedEmail?: string;
  fullAddress: string;
  activeBookings: number;
  totalSpendINR: number;
  openGrievances: number;
  bookings: CustomerBookingSummary[];
  notes: string[];
}

export interface CustomerFilterCriteria {
  searchTerm?: string;
  status?: 'ALL' | 'ACTIVE' | 'SUSPENDED';
  locality?: string;
}

export interface ICustomerRepository {
  getCustomers(filter?: CustomerFilterCriteria): Promise<Customer[]>;
  getCustomerById(id: string): Promise<CustomerDetail | null>;
  revealPII(customerId: string, reason: string): Promise<{ phone: string; email: string }>;
  suspendCustomer(customerId: string, remarks: string): Promise<void>;
  reactivateCustomer(customerId: string): Promise<void>;
}

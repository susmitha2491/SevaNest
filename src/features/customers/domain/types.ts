export interface CustomerBookingSummary {
  bookingId: string;
  category: string;
  workerName?: string;
  status: string;
  date: string;
}

export interface CustomerComplaintSummary {
  ticketId: string;
  disputeCategory: string;
  serviceCategory?: string;
  status: string;
  createdAt: string;
  description?: string;
}

export interface Customer {
  id: string;
  userId?: string;
  name: string;
  maskedPhone: string;
  maskedEmail: string;
  locality: string;
  status: 'ACTIVE' | 'SUSPENDED';
  verificationStatus?: 'VERIFIED' | 'PENDING' | 'REJECTED';
  totalBookings: number;
  registeredDate: string;
  preferredLanguage?: string;
}

export interface CustomerDetail extends Customer {
  etag?: string;
  unmaskedPhone?: string;
  unmaskedEmail?: string;
  fullAddress: string;
  activeBookings: number;
  totalSpendINR: number;
  openGrievances: number;
  bookings: CustomerBookingSummary[];
  complaints?: CustomerComplaintSummary[];
  notes: string[];
}

export interface CustomerPageResult {
  items: Customer[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CustomerFilterCriteria {
  searchTerm?: string;
  status?: 'ALL' | 'ACTIVE' | 'SUSPENDED';
  locality?: string;
  page?: number;
  limit?: number;
}

export interface ICustomerRepository {
  getCustomers(filter?: CustomerFilterCriteria): Promise<Customer[]>;
  getCustomersPage(filter?: CustomerFilterCriteria, page?: number, limit?: number): Promise<CustomerPageResult>;
  getCustomerById(id: string): Promise<CustomerDetail | null>;
  revealPII(customerId: string, reason: string): Promise<{ phone: string; email: string }>;
  suspendCustomer(customerId: string, remarks: string): Promise<void>;
  reactivateCustomer(customerId: string): Promise<void>;
  addCustomerNote(customerId: string, note: string): Promise<void>;
}



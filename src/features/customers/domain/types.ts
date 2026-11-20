export interface CustomerAddress {
  id: string;
  line: string;
  line2?: string | null;
  area: string;
  city: string;
  state?: string | null;
  pincode: string;
  label?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface CustomerNote {
  id: string;
  authorId: string;
  note: string;
  createdAt: string;
}

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
  phone?: string;
  unmaskedPhone?: string;
  email?: string;
  unmaskedEmail?: string;
}

export interface CustomerDetail extends Customer {
  etag?: string;
  unmaskedPhone?: string;
  unmaskedEmail?: string;
  fullAddress: string;
  addresses?: CustomerAddress[];
  activeBookings: number;
  totalSpendINR: number;
  openGrievances: number;
  bookings: CustomerBookingSummary[];
  complaints?: CustomerComplaintSummary[];
  notes: Array<string | CustomerNote>;
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
  verificationStatus?: 'ALL' | 'PENDING' | 'VERIFIED';
  locality?: string;
  page?: number;
  limit?: number;
}

export interface ICustomerRepository {
  getCustomers(filter?: CustomerFilterCriteria): Promise<Customer[]>;
  getCustomersPage(filter?: CustomerFilterCriteria, page?: number, limit?: number): Promise<CustomerPageResult>;
  getCustomerById(id: string): Promise<CustomerDetail | null>;
  getCustomerNotes(customerId: string): Promise<CustomerNote[]>;
  revealPII(customerId: string, reason: string): Promise<{ phone: string; email: string }>;
  suspendCustomer(customerId: string, remarks: string): Promise<void>;
  reactivateCustomer(customerId: string): Promise<void>;
  updateCustomerVerificationStatus(customerId: string, status: 'PENDING' | 'VERIFIED', note?: string): Promise<void>;
  addCustomerNote(customerId: string, note: string): Promise<void>;
}



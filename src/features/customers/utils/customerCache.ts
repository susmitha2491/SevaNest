import { InfiniteData, QueryClient } from '@tanstack/react-query';
import { Customer, CustomerDetail, CustomerPageResult } from '../domain/types';

/**
 * Updates a single customer's account lifecycle status in all cached infinite list pages
 * and detail dossier without refetching or reordering the list.
 */
export function updateCustomerStatusInCache(
  queryClient: QueryClient,
  customerId: string,
  nextStatus: Customer['status']
): void {
  queryClient.setQueriesData<InfiniteData<CustomerPageResult>>(
    { queryKey: ['customers', 'infinite'] },
    (oldData) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === customerId ? { ...item, status: nextStatus } : item
          ),
        })),
      };
    }
  );

  queryClient.setQueryData<CustomerDetail | null>(
    ['customers', 'detail', customerId],
    (oldDetail) => (oldDetail ? { ...oldDetail, status: nextStatus } : oldDetail)
  );
}


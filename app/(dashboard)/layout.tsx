import { AppLayout } from '@/components/layout/app-layout';
import { DepartmentGate } from '@/components/layout/department-gate';
import { ViewAsProvider } from '@/lib/auth/view-as-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewAsProvider>
      <AppLayout>
        <DepartmentGate>{children}</DepartmentGate>
      </AppLayout>
    </ViewAsProvider>
  );
}

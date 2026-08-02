import { AuthGate } from '@/components/console/AuthGate';
import { ConsoleShell } from '@/components/console/ConsoleShell';

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <ConsoleShell>{children}</ConsoleShell>
    </AuthGate>
  );
}

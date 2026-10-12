import AppShell from "@/components/AppShell";
import ChequeForm from "@/components/ChequeForm";
import GeometricBackground from "@/components/GeometricBackground";

export default function SystemPage() {
  return (
    <>
      <GeometricBackground />
      <AppShell>
        <div className="flex flex-col items-center justify-center py-4">
          <ChequeForm />
        </div>
      </AppShell>
    </>
  );
}

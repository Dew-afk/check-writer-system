import AppShell from "@/components/AppShell";
import CalibratePanel from "@/components/CalibratePanel";
import GeometricBackground from "@/components/GeometricBackground";

export default function CalibratePage() {
  return (
    <>
      <GeometricBackground />
      <AppShell>
        <div className="flex flex-col items-center justify-center py-4">
          <CalibratePanel />
        </div>
      </AppShell>
    </>
  );
}
